import { BadRequestException, Controller, Delete, Get, Global, Inject, Injectable, Module, NotFoundException, OnModuleInit, Param, Post, Res, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { File } from '@prisma/client';
import { randomUUID } from 'crypto';
import type { Response } from 'express';
import { connect } from 'net';
import { Readable } from 'stream';
import { z } from 'zod';
import { ENV, Env } from '../../env';
import { AuditService } from '../../common/audit/audit.service';
import { getCtx, requireTenant, requireUser } from '../../common/context/context';
import { hasPermission } from '@vashundhara-foundation/shared';
import { Can, PageQuery, Paging, Public, SelfService, ZBody, ZQuery } from '../../common/http/decorators';
import { JobsService } from '../../common/jobs/jobs.module';
import { PrismaService } from '../../common/prisma/prisma.module';

const TYPES: Record<string, { ext: string; magic: (b: Buffer) => boolean }> = {
  'image/jpeg': { ext: 'jpg', magic: (b) => b.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) },
  'image/png': { ext: 'png', magic: (b) => b.subarray(1, 4).toString() === 'PNG' },
  'image/webp': { ext: 'webp', magic: (b) => b.subarray(8, 12).toString() === 'WEBP' },
  'application/pdf': { ext: 'pdf', magic: (b) => b.subarray(0, 5).toString() === '%PDF-' },
  'text/csv': { ext: 'csv', magic: (b) => !b.includes(0) },
  'audio/mpeg': { ext: 'mp3', magic: (b) => b.subarray(0, 3).toString() === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) },
  'video/mp4': { ext: 'mp4', magic: (b) => b.subarray(4, 8).toString() === 'ftyp' },
  'application/epub+zip': { ext: 'epub', magic: (b) => b.subarray(0, 2).toString() === 'PK' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { ext: 'docx', magic: (b) => b.subarray(0, 2).toString() === 'PK' },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { ext: 'xlsx', magic: (b) => b.subarray(0, 2).toString() === 'PK' }
};
const MAX = 25 * 1024 * 1024;

/** ClamAV INSTREAM protocol. Resolves to null when clean, or the signature name. */
export function clamScan(host: string, port: number, data: Readable): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const s = connect(port, host);
    let reply = '';
    s.setTimeout(60_000, () => s.destroy(new Error('Virus scanner timed out')));
    s.on('error', reject);
    s.on('data', (d) => (reply += d.toString()));
    s.on('close', () => {
      const text = reply.replace(/\0/g, '').trim();
      if (/OK$/.test(text)) resolve(null);
      else if (/FOUND$/.test(text)) resolve(text.replace(/^stream: /, '').replace(/ FOUND$/, ''));
      else reject(new Error(`Virus scanner: ${text || 'no reply'}`));
    });
    s.on('connect', async () => {
      try {
        s.write('zINSTREAM\0');
        for await (const chunk of data) {
          const b = Buffer.from(chunk as Buffer);
          const len = Buffer.alloc(4);
          len.writeUInt32BE(b.length);
          s.write(len);
          if (!s.write(b)) await new Promise((r) => s.once('drain', r));
        }
        s.write(Buffer.alloc(4));
      } catch (e) {
        s.destroy(e as Error);
      }
    });
  });
}

@Injectable()
export class FilesService implements OnModuleInit {
  readonly s3?: S3Client;
  constructor(private readonly prisma: PrismaService, private readonly jobs: JobsService, @Inject(ENV) private readonly env: Env) {
    if (env.S3_BUCKET) {
      this.s3 = new S3Client({
        region: env.S3_REGION, endpoint: env.S3_ENDPOINT, forcePathStyle: Boolean(env.S3_ENDPOINT),
        credentials: env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY ? { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY } : undefined
      });
    }
  }
  onModuleInit() {
    this.jobs.register('file.scan', ({ id }: { id: string }) => this.scan(id));
  }
  private storage() {
    if (!this.s3) throw new ServiceUnavailableException('File storage is not configured');
    return { s3: this.s3, Bucket: this.env.S3_BUCKET! };
  }

  async createUpload(b: { filename: string; mimeType: string; size: number; isPublic?: boolean }) {
    const { s3, Bucket } = this.storage();
    const tenantId = requireTenant().id;
    const id = randomUUID();
    const path = `${tenantId}/${new Date().toISOString().slice(0, 7)}/${id}.${TYPES[b.mimeType].ext}`;
    const f = await this.prisma.file.create({
      data: { id, tenantId, filename: `${id}.${TYPES[b.mimeType].ext}`, originalName: b.filename, mimeType: b.mimeType, size: b.size, path, bucket: Bucket, isPublic: b.isPublic ?? false, uploadedById: requireUser().id }
    });
    // The storage service itself enforces type and size.
    const upload = await createPresignedPost(s3, {
      Bucket, Key: path, Expires: 600, Fields: { 'Content-Type': b.mimeType },
      Conditions: [['content-length-range', 1, b.size], ['eq', '$Content-Type', b.mimeType]]
    });
    return { id: f.id, upload };
  }
  async complete(id: string) {
    const { s3, Bucket } = this.storage();
    const f = await this.prisma.file.findFirst({ where: { id, uploadedById: requireUser().id, status: 'PENDING' } });
    if (!f) throw new NotFoundException('Upload not found');
    const head = await s3.send(new HeadObjectCommand({ Bucket, Key: f.path })).catch(() => null);
    if (!head) throw new BadRequestException('The file has not arrived yet');
    await this.prisma.file.update({ where: { id }, data: { status: 'SCANNING', size: head.ContentLength ?? f.size } });
    await this.jobs.enqueue('file.scan', { id }, { tenantId: f.tenantId, dedupeKey: `scan:${id}` });
    return { id, status: 'SCANNING' };
  }
  private async scan(id: string) {
    const { s3, Bucket } = this.storage();
    const f = await this.prisma.file.findFirst({ where: { id, status: 'SCANNING' } });
    if (!f) return;
    const body = async () => (await s3.send(new GetObjectCommand({ Bucket, Key: f.path }))).Body as Readable;
    const first = await body();
    let head: Buffer = Buffer.alloc(0);
    for await (const c of first) { head = Buffer.concat([head, c as Buffer]); if (head.length >= 512) break; }
    first.destroy();
    const reject = async (reason: string) => {
      await s3.send(new DeleteObjectCommand({ Bucket, Key: f.path }));
      await this.prisma.file.update({ where: { id }, data: { status: 'INFECTED', scanResult: reason } });
    };
    if (!TYPES[f.mimeType]?.magic(head)) return reject('Content does not match its type');
    if (this.env.CLAMAV_HOST) {
      const virus = await clamScan(this.env.CLAMAV_HOST, this.env.CLAMAV_PORT, await body());
      if (virus) return reject(virus);
    } else if (this.env.NODE_ENV === 'production') {
      throw new Error('Virus scanner is not configured');
    }
    await this.prisma.file.update({ where: { id }, data: { status: 'CLEAN', scanResult: this.env.CLAMAV_HOST ? 'clean' : 'not scanned (development)' } });
  }
  /** Only scanned files are ever handed out. */
  async url(f: Pick<File, 'path' | 'status' | 'originalName' | 'mimeType'>, inline = false) {
    if (f.status !== 'CLEAN') throw new NotFoundException('File is not available');
    const { s3, Bucket } = this.storage();
    const name = encodeURIComponent(f.originalName);
    const safeInline = inline && /^(image|audio|video)\//.test(f.mimeType);
    return getSignedUrl(s3, new GetObjectCommand({ Bucket, Key: f.path, ResponseContentDisposition: `${safeInline ? 'inline' : 'attachment'}; filename*=UTF-8''${name}`, ResponseContentType: f.mimeType }), { expiresIn: 300 });
  }
}

const UploadSchema = z.object({ filename: z.string().min(1).max(200), mimeType: z.enum(Object.keys(TYPES) as [string, ...string[]]), size: z.number().int().min(1).max(MAX), isPublic: z.boolean().optional() });

@ApiTags('files')
@Controller('files')
export class FilesController {
  constructor(private readonly prisma: PrismaService, private readonly files: FilesService, private readonly audit: AuditService) {}
  @Get() @Can('files:read')
  async list(@ZQuery(PageQuery) p: Paging) {
    const where = { deletedAt: null, ...(p.q ? { originalName: { contains: p.q, mode: 'insensitive' as const } } : {}) };
    const [items, total] = await Promise.all([
      this.prisma.file.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (p.page - 1) * p.limit, take: p.limit, omit: { path: true, bucket: true } }),
      this.prisma.file.count({ where })
    ]);
    return { items, total, page: p.page, limit: p.limit };
  }
  /** Anyone signed in may upload (for example homework). Only staff may publish a file. */
  @Post('uploads') @SelfService()
  create(@ZBody(UploadSchema) b: z.infer<typeof UploadSchema>) {
    return this.files.createUpload({ ...b, isPublic: b.isPublic && hasPermission(getCtx()!.permissions, 'files:create') });
  }
  @Post('uploads/:id/complete') @SelfService()
  complete(@Param('id') id: string) { return this.files.complete(id); }

  @Get(':id/download') @SelfService()
  async download(@Param('id') id: string) {
    const staff = hasPermission(getCtx()!.permissions, 'files:read');
    const f = await this.prisma.file.findFirst({ where: { id, deletedAt: null, ...(staff ? {} : { OR: [{ uploadedById: requireUser().id }, { isPublic: true }] }) } });
    if (!f) throw new NotFoundException('File not found');
    return { url: await this.files.url(f), name: f.originalName };
  }
  @Get(':id/public') @Public()
  async publicFile(@Param('id') id: string, @Res() res: Response) {
    const f = await this.prisma.file.findFirst({ where: { id, isPublic: true, deletedAt: null } });
    if (!f) throw new NotFoundException('File not found');
    res.setHeader('cache-control', 'public, max-age=240');
    res.redirect(await this.files.url(f, true));
  }
  @Delete(':id') @Can('files:delete')
  async remove(@Param('id') id: string) {
    const { count } = await this.prisma.file.updateMany({ where: { id, deletedAt: null }, data: { deletedAt: new Date() } });
    if (!count) throw new NotFoundException('File not found');
    await this.audit.log('DELETE', 'file', id);
    return { ok: true };
  }
}

@Global()
@Module({ providers: [FilesService], controllers: [FilesController], exports: [FilesService] })
export class FilesModule {}
