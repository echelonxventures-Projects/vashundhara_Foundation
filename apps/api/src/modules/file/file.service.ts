/**
 * File Service for Vashundhara Foundation API
 */

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException
} from '@nestjs/common';
import type { Prisma } from '@vashundhara-foundation/database';
import { v4 as uuidv4 } from 'uuid';

import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { TenantContextService } from '../../tenant/tenant-context.service';

// File type definitions
export interface File {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: bigint;
  path: string;
  bucket: string;
  checksum: string;
  isPublic: boolean;
  expiresAt: Date | null;
  tenantId: string;
  uploadedById: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

interface FileWhereInput {
  deletedAt?: null | { not: null };
  tenantId?: string;
  mimeType?: string;
  uploadedById?: string;
  createdAt?: { gte?: Date; lte?: Date };
}

@Injectable()
export class FileService {
  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
  private readonly ALLOWED_MIME_TYPES = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf', 'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly tenantContext: TenantContextService
  ) {}

  private getTypedPrisma(): PrismaService & {
    file: {
      findMany<T = File[]>(args: { where?: FileWhereInput; skip?: number; take?: number; orderBy?: Prisma.FileOrderByWithRelationInput; include?: Prisma.FileInclude }): Promise<T>;
      count(args: { where?: FileWhereInput }): Promise<number>;
      findUnique<T = File | null>(args: { where: Prisma.FileWhereUniqueInput; include?: Prisma.FileInclude }): Promise<T>;
      create<T = File>(args: { data: Prisma.FileCreateInput }): Promise<T>;
      update<T = File>(args: { where: Prisma.FileWhereUniqueInput; data: Prisma.FileUpdateInput }): Promise<T>;
    };
  } {
    return this.prisma as PrismaService & {
      file: {
        findMany<T = File[]>(args: { where?: FileWhereInput; skip?: number; take?: number; orderBy?: Prisma.FileOrderByWithRelationInput; include?: Prisma.FileInclude }): Promise<T>;
        count(args: { where?: FileWhereInput }): Promise<number>;
        findUnique<T = File | null>(args: { where: Prisma.FileWhereUniqueInput; include?: Prisma.FileInclude }): Promise<T>;
        create<T = File>(args: { data: Prisma.FileCreateInput }): Promise<T>;
        update<T = File>(args: { where: Prisma.FileWhereUniqueInput; data: Prisma.FileUpdateInput }): Promise<T>;
      };
    };
  }

  async findAll(params: {
    tenantId?: string;
    mimeType?: string;
    uploadedById?: string;
    page?: number;
    limit?: number;
    startDate?: Date;
    endDate?: Date;
  }) {
    const context = this.tenantContext.getContext();
    const targetTenantId = params.tenantId || context?.tenantId;
    const isSystemAdmin = context?.isSystemAdmin;

    const { mimeType, uploadedById, page = 1, limit = 20, startDate, endDate } = params;
    const skip = (page - 1) * limit;

    const where: FileWhereInput = { deletedAt: null };

    if (!isSystemAdmin) {
      where.tenantId = targetTenantId;
    } else if (targetTenantId) {
      where.tenantId = targetTenantId;
    }

    if (mimeType) where.mimeType = mimeType;
    if (uploadedById) where.uploadedById = uploadedById;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const typedPrisma = this.getTypedPrisma();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const [data, total] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      typedPrisma.file.findMany({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          uploadedBy: { select: { id: true, email: true, firstName: true, lastName: true } }
        }
      }),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      typedPrisma.file.count({ where })
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string) {
    const typedPrisma = this.getTypedPrisma();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const file = await typedPrisma.file.findUnique({
      where: { id, deletedAt: null },
      include: {
        uploadedBy: { select: { id: true, email: true, firstName: true, lastName: true } }
      }
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    return file;
  }

  async createUploadUrl(data: {
    filename: string;
    mimeType: string;
    size: number;
    isPublic?: boolean;
    expiresAt?: Date;
  }) {
    const context = this.tenantContext.getContext();
    const tenantId = context?.tenantId;
    const userId = context?.userId;

    if (!tenantId) {
      throw new ForbiddenException('Tenant context required');
    }

    // Validate file
    this.validateFile(data.filename, data.mimeType, data.size);

    // Generate storage path
    const fileId = uuidv4();
    const extension = data.filename.split('.').pop() || '';
    const storagePath = `${tenantId}/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${fileId}.${extension}`;

    const typedPrisma = this.getTypedPrisma();

    // Create file record
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const file = await typedPrisma.file.create({
      data: {
        filename: `${fileId}.${extension}`,
        originalName: data.filename,
        mimeType: data.mimeType,
        size: BigInt(data.size),
        path: storagePath,
        bucket: 'vashundhara-files',
        checksum: '', // Will be set after upload
        isPublic: data.isPublic || false,
        expiresAt: data.expiresAt,
        tenant: { connect: { id: tenantId } },
        uploadedBy: userId ? { connect: { id: userId } } : undefined
      }
    });

    // Generate presigned upload URL (would use S3, GCS, etc.)
    const uploadUrl = await this.generatePresignedUploadUrl(storagePath, data.mimeType);

    return {
      uploadUrl,
      file
    };
  }

  async completeUpload(fileId: string, checksum: string): Promise<File> {
    const file = await this.findById(fileId);

    const typedPrisma = this.getTypedPrisma();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    await typedPrisma.file.update({
      where: { id: fileId },
      data: { checksum }
    });

    return file;
  }

  async delete(id: string) {
    const context = this.tenantContext.getContext();
    const isSystemAdmin = context?.isSystemAdmin;

    const file = await this.findById(id);

    if (file.tenantId && !isSystemAdmin && context?.tenantId !== file.tenantId) {
      throw new ForbiddenException('Cannot delete files from other tenants');
    }

    const typedPrisma = this.getTypedPrisma();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    await typedPrisma.file.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    // In production, also delete from storage
    // await storageService.delete(file.path);

    return { success: true };
  }

  async getDownloadUrl(id: string) {
    const file = await this.findById(id);

    // Generate presigned download URL
    const downloadUrl = await this.generatePresignedDownloadUrl(file.path);

    return { downloadUrl, filename: file.originalName };
  }

  private validateFile(filename: string, mimeType: string, size: number) {
    if (size > this.MAX_FILE_SIZE) {
      throw new BadRequestException(`File size exceeds maximum allowed (${this.MAX_FILE_SIZE / 1024 / 1024} MB)`);
    }

    if (!this.ALLOWED_MIME_TYPES.includes(mimeType)) {
      throw new BadRequestException(`File type ${mimeType} is not allowed`);
    }

    const extension = filename.split('.').pop()?.toLowerCase();
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'csv', 'xls', 'xlsx'];

    if (!extension || !allowedExtensions.includes(extension)) {
      throw new BadRequestException('File extension not allowed');
    }
  }

  private generatePresignedUploadUrl(path: string, mimeType: string): Promise<string> {
    // In production, integrate with S3/GCS/Azure Blob Storage
    // For now, return a placeholder
    return Promise.resolve(`https://storage.example.com/upload?path=${encodeURIComponent(path)}&type=${encodeURIComponent(mimeType)}`);
  }

  private generatePresignedDownloadUrl(path: string): Promise<string> {
    // In production, integrate with S3/GCS/Azure Blob Storage
    return Promise.resolve(`https://storage.example.com/download?path=${encodeURIComponent(path)}`);
  }
}