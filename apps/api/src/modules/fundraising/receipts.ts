import { BadRequestException, Controller, Get, Inject, Injectable, NotFoundException, Param, Post, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Prisma, ReceiptKind } from '@prisma/client';
import { FieldCipher, safeEqual } from '@vashundhara-foundation/auth';
import { CASH_80G_LIMIT_MINOR, fiscalYear, formatMinor, rupeesInWords } from '@vashundhara-foundation/shared';
import type { Response } from 'express';
import { z } from 'zod';
import { ENV, Env } from '../../env';
import { AuditService } from '../../common/audit/audit.service';
import { requireTenant, requireUser } from '../../common/context/context';
import { Can, PageQuery, Paging, Public, SelfService, ZBody, ZQuery } from '../../common/http/decorators';
import { TextPdf } from '../../common/pdf/pdf-text';
import { PrismaService } from '../../common/prisma/prisma.module';

const PREFIX: Record<ReceiptKind, string> = { GENERAL: 'R', SECTION_80G: '80G', FCRA: 'FC' };

interface Snapshot {
  ngo: { name: string; pan: string | null; address: string; registrationNo: string | null; reg80G: string | null; fcraNo: string | null; signatoryName: string | null; signatoryTitle: string | null };
  donor: { name: string; address: string; panEnc: string | null };
  donation: { id: string; amountMinor: number; currency: string; method: string; date: string; reference: string | null; campaign: string | null };
}
type Tx = Prisma.TransactionClient;
const oneLine = (a: unknown) => (a && typeof a === 'object' ? Object.values(a as Record<string, string>).filter(Boolean).join(', ') : '');

@Injectable()
export class ReceiptsService {
  readonly cipher: FieldCipher;
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService, @Inject(ENV) env: Env) { this.cipher = new FieldCipher(env.ENCRYPTION_KEY); }

  /** Must run in the transaction that completes the donation. Numbers are gap-free per NGO, kind and year. */
  async issue(tx: Tx, donationId: string) {
    const existing = await tx.receipt.findFirst({ where: { donationId, status: 'ISSUED' } });
    if (existing) return existing;
    const tenantId = requireTenant().id;
    const d = await tx.donation.findFirstOrThrow({ where: { id: donationId }, include: { donor: true, campaign: true } });
    const c = await tx.complianceProfile.findFirst();
    const at = d.completedAt ?? new Date();
    const net = d.amountMinor - d.refundedMinor;
    const valid80G = Boolean(c?.reg80G && c.pan && (!c.reg80GValidFrom || c.reg80GValidFrom <= at) && (!c.reg80GValidUntil || c.reg80GValidUntil >= at));
    const eligible = d.wants80G && valid80G && d.donor.panEnc && d.currency === 'INR' && (d.campaign?.is80GEligible ?? true) && d.method !== 'IN_KIND' && !(d.method === 'CASH' && d.amountMinor > CASH_80G_LIMIT_MINOR);
    const kind: ReceiptKind = d.fund === 'FCRA' ? 'FCRA' : eligible ? 'SECTION_80G' : 'GENERAL';
    const fy = fiscalYear(at);
    // Single statement, so concurrent donations queue on the row instead of sharing a number.
    const [{ lastSeq }] = await tx.$queryRaw<{ lastSeq: number }[]>`
      INSERT INTO receipt_counters ("tenantId", kind, "fiscalYear", "lastSeq") VALUES (${tenantId}, ${kind}::"ReceiptKind", ${fy}, 1)
      ON CONFLICT ("tenantId", kind, "fiscalYear") DO UPDATE SET "lastSeq" = receipt_counters."lastSeq" + 1 RETURNING "lastSeq"`;
    const t = requireTenant();
    const snapshot: Snapshot = {
      ngo: { name: c?.legalName ?? t.name, pan: c?.pan ?? null, address: oneLine(c?.address), registrationNo: c?.registrationNo ?? null, reg80G: c?.reg80G ?? null, fcraNo: c?.fcraNo ?? null, signatoryName: c?.signatoryName ?? null, signatoryTitle: c?.signatoryTitle ?? null },
      donor: { name: d.donor.fullName, address: oneLine(d.donor.address), panEnc: kind === 'SECTION_80G' ? d.donor.panEnc : null },
      donation: { id: d.id, amountMinor: Number(net), currency: d.currency, method: d.method, date: at.toISOString(), reference: d.reference, campaign: d.campaign?.title ?? null }
    };
    return tx.receipt.create({ data: { tenantId, donationId, kind, fiscalYear: fy, seq: lastSeq, number: `${PREFIX[kind]}/${fy}/${String(lastSeq).padStart(5, '0')}`, snapshot: snapshot as unknown as Prisma.InputJsonValue } });
  }
  async void(tx: Tx, donationId: string, reason: string) {
    await tx.receipt.updateMany({ where: { donationId, status: 'ISSUED' }, data: { status: 'VOID', voidedAt: new Date(), voidReason: reason } });
  }

  async pdf(receipt: { number: string; kind: ReceiptKind; status: string; issuedAt: Date; snapshot: Prisma.JsonValue; tenantId: string }): Promise<Buffer> {
    const s = receipt.snapshot as unknown as Snapshot;
    const pan = s.donor.panEnc ? this.cipher.decrypt(s.donor.panEnc, `pan:${receipt.tenantId}`) : null;
    const pdf = await TextPdf.create({ size: 'A4', margin: 56, info: { Title: `Receipt ${receipt.number}`, Author: s.ngo.name } });
    const { doc } = pdf;
    const amount = formatMinor(s.donation.amountMinor, s.donation.currency as 'INR');
    if (receipt.status === 'VOID') {
      doc.save().rotate(-35, { origin: [300, 420] });
      pdf.text('VOID', { x: 130, y: 230, width: 400, size: 110, color: '#e5b8b8', bold: true });
      doc.restore();
      doc.y = 56;
    }
    const grey = '#444';
    pdf.text(s.ngo.name, { size: 18, bold: true });
    if (s.ngo.address) pdf.text(s.ngo.address, { size: 9, color: grey });
    const ids = [s.ngo.registrationNo && `Reg. No. ${s.ngo.registrationNo}`, s.ngo.pan && `PAN ${s.ngo.pan}`].filter(Boolean).join(', ');
    if (ids) pdf.text(ids, { size: 9, color: grey });
    doc.y += 18;
    pdf.text(receipt.kind === 'SECTION_80G' ? 'Donation receipt (Section 80G)' : receipt.kind === 'FCRA' ? 'Foreign contribution receipt' : 'Donation receipt', { size: 14, bold: true, gap: 10 });
    const rows: [string, string][] = [
      ['Receipt number', receipt.number], ['Date of donation', new Date(s.donation.date).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'long', year: 'numeric' })],
      ['Received from', s.donor.name], ...(s.donor.address ? [['Address', s.donor.address] as [string, string]] : []), ...(pan ? [['Donor PAN', pan] as [string, string]] : []),
      ['Amount', amount], ...(s.donation.currency === 'INR' ? [['In words', rupeesInWords(s.donation.amountMinor)] as [string, string]] : []),
      ['Payment method', s.donation.method.replace(/_/g, ' ').toLowerCase()], ...(s.donation.reference ? [['Reference', s.donation.reference] as [string, string]] : []),
      ...(s.donation.campaign ? [['Towards', s.donation.campaign] as [string, string]] : [])
    ];
    for (const [k, v] of rows) {
      const { y } = doc;
      const page = doc.page;
      pdf.text(k, { x: 56, y, width: 130, size: 10, bold: true });
      const label = doc.y;
      pdf.text(v, { x: 190, y: doc.page === page ? y : doc.page.margins.top, width: 349, size: 10 });
      doc.y = Math.max(doc.y, doc.page === page ? label : 0) + 4;
    }
    doc.y += 12;
    if (receipt.kind === 'SECTION_80G') pdf.text(`This donation is eligible for deduction under section 80G of the Income-tax Act, 1961, subject to its conditions. 80G registration: ${s.ngo.reg80G}. Form 10BE is issued separately after the annual filing.`, { x: 56, size: 9 });
    if (receipt.kind === 'FCRA') pdf.text(`Received under the Foreign Contribution (Regulation) Act. FCRA registration: ${s.ngo.fcraNo}.`, { x: 56, size: 9 });
    if (receipt.kind === 'GENERAL') pdf.text('This receipt does not by itself make the donation eligible for a tax deduction.', { x: 56, size: 9 });
    doc.y += 22;
    pdf.text(`For ${s.ngo.name}`, { x: 56, size: 9, bold: true });
    if (s.ngo.signatoryName) { doc.y += 14; pdf.text(`${s.ngo.signatoryName}${s.ngo.signatoryTitle ? `, ${s.ngo.signatoryTitle}` : ''}`, { x: 56, size: 9 }); }
    doc.y += 10;
    pdf.text('Computer generated receipt.', { x: 56, size: 8, color: '#666' });
    return pdf.buffer();
  }
  async send(res: Response, r: Parameters<ReceiptsService['pdf']>[0]) {
    const body = await this.pdf(r);
    res.setHeader('content-type', 'application/pdf').setHeader('cache-control', 'private, no-store').setHeader('content-disposition', `attachment; filename="receipt-${r.number.replace(/\W+/g, '-')}.pdf"`).send(body);
  }
}

const VoidSchema = z.object({ reason: z.string().min(5).max(300) });

@ApiTags('receipts')
@Controller('receipts')
export class ReceiptsController {
  constructor(private readonly prisma: PrismaService, private readonly receipts: ReceiptsService, private readonly audit: AuditService) {}
  @Get() @Can('receipts:read')
  async list(@ZQuery(PageQuery) p: Paging) {
    const where: Prisma.ReceiptWhereInput = p.q ? { OR: [{ number: { contains: p.q, mode: 'insensitive' } }, { donation: { donor: { fullName: { contains: p.q, mode: 'insensitive' } } } }] } : {};
    const [items, total] = await Promise.all([
      this.prisma.receipt.findMany({ where, orderBy: { issuedAt: 'desc' }, skip: (p.page - 1) * p.limit, take: p.limit, omit: { snapshot: true }, include: { donation: { select: { amountMinor: true, currency: true, donor: { select: { fullName: true } } } } } }),
      this.prisma.receipt.count({ where })
    ]);
    return { items, total, page: p.page, limit: p.limit };
  }
  @Get('mine/:id') @SelfService()
  async mine(@Param('id') id: string, @Res() res: Response) {
    const me = requireUser();
    const r = await this.prisma.receipt.findFirst({ where: { id, donation: { donor: { OR: [{ userId: me.id }, ...(me.emailVerified ? [{ userId: null, email: me.email }] : [])] } } } });
    if (!r) throw new NotFoundException('Receipt not found');
    await this.receipts.send(res, r);
  }
  /** Link sent by email. The donation's long random token is the credential. */
  @Get('public/:donationId') @Public()
  async publicPdf(@Param('donationId') donationId: string, @Query('token') token: string, @Res() res: Response) {
    const d = await this.prisma.donation.findFirst({ where: { id: donationId }, include: { receipts: { where: { status: 'ISSUED' } } } });
    if (!d || !safeEqual(d.publicToken, String(token ?? '')) || !d.receipts[0]) throw new NotFoundException('Receipt not found');
    await this.receipts.send(res, d.receipts[0]);
  }
  @Get(':id/pdf') @Can('receipts:read')
  async download(@Param('id') id: string, @Res() res: Response) {
    const r = await this.prisma.receipt.findFirst({ where: { id } });
    if (!r) throw new NotFoundException('Receipt not found');
    await this.receipts.send(res, r);
  }
  /** Voids and issues a corrected receipt with a new number. */
  @Post(':id/reissue') @Can('receipts:manage')
  async reissue(@Param('id') id: string, @ZBody(VoidSchema) b: { reason: string }) {
    const r = await this.prisma.receipt.findFirst({ where: { id, status: 'ISSUED' }, include: { donation: true } });
    if (!r) throw new NotFoundException('Receipt not found');
    if (!['COMPLETED', 'PARTIALLY_REFUNDED'].includes(r.donation.status)) throw new BadRequestException('This donation cannot have a receipt');
    const next = await this.prisma.$transaction(async (tx) => {
      await this.receipts.void(tx, r.donationId, b.reason);
      return this.receipts.issue(tx, r.donationId);
    });
    await this.audit.log('UPDATE', 'receipt', id, { number: r.number }, { number: next.number, reason: b.reason });
    return { id: next.id, number: next.number };
  }
}
