import { BadGatewayException, Inject, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { Fund, PaymentProviderCode, SubscriptionInterval } from '@prisma/client';
import { FieldCipher, hmacSha256, randomToken, safeEqual } from '@vashundhara-foundation/auth';
import { ENV, Env } from '../../env';
import { requireTenant } from '../../common/context/context';
import { PrismaService } from '../../common/prisma/prisma.module';

export interface GatewayPayment { id: string; orderId: string | null; amountMinor: number; currency: string; status: 'captured' | 'failed' | 'pending'; feeMinor: number }
export interface GatewayRefund { id: string; status: 'processed' | 'pending' | 'failed' }

export interface Gateway {
  code: PaymentProviderCode;
  keyId: string;
  createOrder(amountMinor: number, currency: string, receipt: string): Promise<string>;
  verifyCheckout(orderId: string, paymentId: string, signature: string): boolean;
  fetchPayment(paymentId: string): Promise<GatewayPayment>;
  refund(paymentId: string, amountMinor: number, idempotencyKey: string): Promise<GatewayRefund>;
  createSubscription(amountMinor: number, currency: string, interval: SubscriptionInterval, name: string): Promise<string>;
  verifySubscription(subscriptionId: string, paymentId: string, signature: string): boolean;
  cancelSubscription(subscriptionId: string): Promise<void>;
  verifyWebhook(raw: Buffer, signature: string): boolean;
}

class Razorpay implements Gateway {
  readonly code = 'RAZORPAY' as const;
  constructor(readonly keyId: string, private readonly secret: string, private readonly webhookSecret: string) {}
  private async call<T>(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<T> {
    let r: Response;
    try {
      r = await fetch(`https://api.razorpay.com/v1/${path}`, {
        method, signal: AbortSignal.timeout(20_000), body: body ? JSON.stringify(body) : undefined,
        headers: { authorization: `Basic ${Buffer.from(`${this.keyId}:${this.secret}`).toString('base64')}`, 'content-type': 'application/json', ...headers }
      });
    } catch {
      throw new BadGatewayException({ code: 'GATEWAY_UNREACHABLE', message: 'The payment service did not respond' });
    }
    const json = (await r.json().catch(() => ({}))) as T & { error?: { description?: string } };
    if (!r.ok) throw new BadGatewayException({ code: r.status < 500 ? 'GATEWAY_REJECTED' : 'GATEWAY_ERROR', message: json.error?.description ?? 'The payment service refused the request' });
    return json;
  }
  async createOrder(amount: number, currency: string, receipt: string) {
    return (await this.call<{ id: string }>('POST', 'orders', { amount, currency, receipt: receipt.slice(0, 40), payment_capture: 1 })).id;
  }
  verifyCheckout(o: string, p: string, s: string) { return safeEqual(hmacSha256(`${o}|${p}`, this.secret), s); }
  verifySubscription(sub: string, p: string, s: string) { return safeEqual(hmacSha256(`${p}|${sub}`, this.secret), s); }
  verifyWebhook(raw: Buffer, s: string) { return safeEqual(hmacSha256(raw, this.webhookSecret), s); }
  async fetchPayment(id: string): Promise<GatewayPayment> {
    const p = await this.call<{ id: string; order_id: string | null; amount: number; currency: string; status: string; fee: number | null }>('GET', `payments/${encodeURIComponent(id)}`);
    return { id: p.id, orderId: p.order_id, amountMinor: p.amount, currency: p.currency, feeMinor: p.fee ?? 0, status: p.status === 'captured' || p.status === 'refunded' ? 'captured' : p.status === 'failed' ? 'failed' : 'pending' };
  }
  async refund(id: string, amount: number, key: string): Promise<GatewayRefund> {
    const r = await this.call<{ id: string; status: string }>('POST', `payments/${encodeURIComponent(id)}/refund`, { amount, notes: { key } }, { 'X-Refund-Idempotency': key });
    return { id: r.id, status: r.status === 'processed' ? 'processed' : r.status === 'failed' ? 'failed' : 'pending' };
  }
  async createSubscription(amount: number, currency: string, interval: SubscriptionInterval, name: string) {
    const [period, every, total] = interval === 'MONTHLY' ? ['monthly', 1, 120] : interval === 'QUARTERLY' ? ['monthly', 3, 40] : ['yearly', 1, 10];
    const plan = await this.call<{ id: string }>('POST', 'plans', { period, interval: every, item: { name: name.slice(0, 60), amount, currency } });
    return (await this.call<{ id: string }>('POST', 'subscriptions', { plan_id: plan.id, total_count: total, customer_notify: 1 })).id;
  }
  async cancelSubscription(id: string) { await this.call('POST', `subscriptions/${encodeURIComponent(id)}/cancel`, { cancel_at_cycle_end: 0 }); }
}

/** For development and automated tests only. */
class Mock implements Gateway {
  readonly code = 'MOCK' as const;
  static payments = new Map<string, GatewayPayment>();
  constructor(readonly keyId: string, private readonly secret: string, private readonly webhookSecret: string) {}
  async createOrder() { return `order_${randomToken(9)}`; }
  verifyCheckout(o: string, p: string, s: string) { return safeEqual(hmacSha256(`${o}|${p}`, this.secret), s); }
  verifySubscription(sub: string, p: string, s: string) { return safeEqual(hmacSha256(`${p}|${sub}`, this.secret), s); }
  verifyWebhook(raw: Buffer, s: string) { return safeEqual(hmacSha256(raw, this.webhookSecret), s); }
  async fetchPayment(id: string) {
    const p = Mock.payments.get(id);
    if (!p) throw new BadGatewayException('Unknown test payment');
    return p;
  }
  async refund(): Promise<GatewayRefund> { return { id: `rfnd_${randomToken(9)}`, status: 'processed' }; }
  async createSubscription() { return `sub_${randomToken(9)}`; }
  async cancelSubscription() {}
}
export const mockPayments = Mock.payments;

@Injectable()
export class GatewayService {
  private readonly cipher: FieldCipher;
  constructor(private readonly prisma: PrismaService, @Inject(ENV) private readonly env: Env) { this.cipher = new FieldCipher(env.ENCRYPTION_KEY); }

  private build(a: { tenantId: string; provider: PaymentProviderCode; fund: Fund; keyId: string; keySecretEnc: string; webhookSecretEnc: string }): Gateway {
    const aad = `pay:${a.tenantId}:${a.provider}:${a.fund}`;
    const args = [a.keyId, this.cipher.decrypt(a.keySecretEnc, aad), this.cipher.decrypt(a.webhookSecretEnc, aad)] as const;
    if (a.provider === 'RAZORPAY') return new Razorpay(...args);
    if (a.provider === 'MOCK' && this.env.NODE_ENV !== 'production') return new Mock(...args);
    throw new UnprocessableEntityException('Unsupported payment provider');
  }
  async active(fund: Fund): Promise<Gateway> {
    const a = await this.prisma.paymentAccount.findFirst({ where: { fund, isActive: true }, orderBy: { provider: 'asc' } });
    if (!a) throw new UnprocessableEntityException({ code: 'PAYMENTS_NOT_READY', message: 'Online donations are not set up yet' });
    return this.build(a);
  }
  async byProvider(provider: PaymentProviderCode, fund: Fund): Promise<Gateway> {
    const a = await this.prisma.paymentAccount.findFirst({ where: { provider, fund } });
    if (!a) throw new UnprocessableEntityException('Payment account not found');
    return this.build(a);
  }
  async forWebhook(provider: PaymentProviderCode, raw: Buffer, signature: string): Promise<{ gateway: Gateway; fund: Fund } | null> {
    for (const a of await this.prisma.paymentAccount.findMany({ where: { provider, tenantId: requireTenant().id } })) {
      const gateway = this.build(a);
      if (gateway.verifyWebhook(raw, signature)) return { gateway, fund: a.fund };
    }
    return null;
  }
}
