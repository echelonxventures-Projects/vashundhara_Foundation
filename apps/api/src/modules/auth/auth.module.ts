import { Controller, Delete, Get, Global, HttpCode, Module, NotFoundException, Param, Post, Put, Query, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { getCtx, requireUser } from '../../common/context/context';
import { Public, RateLimit, SelfService, ZBody } from '../../common/http/decorators';
import { REFRESH_COOKIE } from '../../common/http/guards';
import { PrismaService } from '../../common/prisma/prisma.module';
import { AuthService } from './auth.service';

export const Email = z.string().trim().toLowerCase().pipe(z.email().max(200));
const Name = z.string().trim().min(1).max(80);
const Password = z.string().min(1).max(200);
export const Slug = z.string().regex(/^[a-z0-9](?:[a-z0-9-]{1,40}[a-z0-9])$/, 'Use 3 to 42 lowercase letters, numbers or hyphens')
  .refine((s) => !['www', 'api', 'app', 'admin', 'docs', 'mail', 'static', 'cdn', 'help', 'support', 'status', 'localhost'].includes(s), 'That address is reserved');
const Token = z.string().min(20).max(200);

const S = {
  register: z.object({ email: Email, password: Password, firstName: Name, lastName: Name, role: z.string().default('donor'), locale: z.string().max(2).optional(), acceptTerms: z.literal(true) }),
  ngo: z.object({ ngoName: z.string().trim().min(3).max(150), slug: Slug, email: Email, password: Password, firstName: Name, lastName: Name, acceptTerms: z.literal(true) }),
  login: z.object({ email: Email, password: Password, rememberMe: z.boolean().optional() }),
  mfaLogin: z.object({ challenge: z.string().max(2000), code: z.string().min(6).max(20) }),
  email: z.object({ email: Email }),
  token: z.object({ token: Token }),
  reset: z.object({ token: Token, password: Password }),
  change: z.object({ current: Password, next: Password }),
  pw: z.object({ password: Password }),
  code: z.object({ code: z.string().min(6).max(20) }),
  pwcode: z.object({ password: Password, code: z.string().min(6).max(20) }),
  accept: z.object({ token: Token, password: Password.optional(), firstName: Name.optional(), lastName: Name.optional() }),
  role: z.object({ role: z.string().max(30) }),
  profile: z.object({ firstName: Name, lastName: Name, phone: z.string().regex(/^\+?[0-9 -]{7,16}$/).nullish(), locale: z.enum(['en', 'hi', 'bn', 'ta', 'te', 'mr', 'gu', 'kn', 'ml', 'or', 'pa', 'as', 'ur']) }).partial()
};

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly prisma: PrismaService) {}

  @Post('register') @Public() @HttpCode(200) @RateLimit(10, 3600, 'email')
  register(@ZBody(S.register) b: z.infer<typeof S.register>) { return this.auth.register(b); }
  @Post('register-ngo') @Public() @HttpCode(200) @RateLimit(5, 3600)
  registerNgo(@ZBody(S.ngo) b: z.infer<typeof S.ngo>) { return this.auth.registerNgo(b); }
  @Post('login') @Public() @HttpCode(200) @RateLimit(20, 900, 'email')
  login(@ZBody(S.login) b: z.infer<typeof S.login>, @Res({ passthrough: true }) res: Response) { return this.auth.login(b, res); }
  @Post('login/mfa') @Public() @HttpCode(200) @RateLimit(10, 300, 'challenge')
  mfa(@ZBody(S.mfaLogin) b: z.infer<typeof S.mfaLogin>, @Res({ passthrough: true }) res: Response) { return this.auth.loginMfa(b.challenge, b.code, res); }
  @Post('refresh') @Public() @HttpCode(200) @RateLimit(60, 60)
  refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.auth.refresh((req.cookies as Record<string, string>)?.[REFRESH_COOKIE] ?? (req.body as { refreshToken?: string } | undefined)?.refreshToken, res);
  }
  @Post('logout') @Public() @HttpCode(200)
  logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) { return this.auth.logout((req.cookies as Record<string, string>)?.[REFRESH_COOKIE], res); }
  @Post('verify-email') @Public() @HttpCode(200) @RateLimit(20, 600)
  verify(@ZBody(S.token) b: { token: string }) { return this.auth.verifyEmail(b.token); }
  @Post('verify-email/resend') @Public() @HttpCode(200) @RateLimit(3, 3600, 'email')
  resend(@ZBody(S.email) b: { email: string }) { return this.auth.resendVerification(b.email); }
  @Post('password/forgot') @Public() @HttpCode(200) @RateLimit(5, 3600, 'email')
  forgot(@ZBody(S.email) b: { email: string }) { return this.auth.requestReset(b.email); }
  @Post('password/reset') @Public() @HttpCode(200) @RateLimit(10, 600)
  reset(@ZBody(S.reset) b: { token: string; password: string }) { return this.auth.reset(b.token, b.password); }
  @Post('password/change') @SelfService() @HttpCode(200) @RateLimit(10, 600)
  change(@ZBody(S.change) b: { current: string; next: string }) { return this.auth.changePassword(b.current, b.next); }
  @Post('mfa/setup') @SelfService() @HttpCode(200) @RateLimit(10, 600)
  setup(@ZBody(S.pw) b: { password: string }) { return this.auth.mfaSetup(b.password); }
  @Post('mfa/enable') @SelfService() @HttpCode(200) @RateLimit(10, 600)
  enable(@ZBody(S.code) b: { code: string }) { return this.auth.mfaEnable(b.code); }
  @Post('mfa/disable') @SelfService() @HttpCode(200) @RateLimit(10, 600)
  disable(@ZBody(S.pwcode) b: { password: string; code: string }) { return this.auth.mfaDisable(b.password, b.code); }
  @Post('invitation/preview') @Public() @HttpCode(200) @RateLimit(20, 600)
  preview(@ZBody(S.token) b: { token: string }) { return this.auth.previewInvitation(b.token); }
  @Post('invitation/accept') @Public() @HttpCode(200) @RateLimit(20, 600)
  accept(@ZBody(S.accept) b: z.infer<typeof S.accept>) { return this.auth.acceptInvitation(b); }
  @Get('google') @Public() @RateLimit(20, 600)
  async google(@Res() res: Response) { res.redirect(await this.auth.googleStart(res)); }
  @Get('google/callback') @Public() @RateLimit(20, 600)
  async callback(@Query('code') code: string, @Query('state') state: string, @Req() req: Request, @Res() res: Response) {
    res.redirect(await this.auth.googleFinish(String(code), String(state), (req.cookies as Record<string, string>)?.vf_go, res));
  }
  @Get('session') @Public()
  session() { return this.auth.me(); }
  @Post('roles') @SelfService() @HttpCode(200)
  role(@ZBody(S.role) b: { role: string }) { return this.auth.addRole(b.role); }

  @Get('profile') @SelfService()
  profile() {
    return this.prisma.user.findUnique({ where: { id: requireUser().id }, select: { id: true, email: true, firstName: true, lastName: true, phone: true, locale: true, mfaEnabled: true, createdAt: true } });
  }
  @Put('profile') @SelfService()
  updateProfile(@ZBody(S.profile) b: z.infer<typeof S.profile>) {
    return this.prisma.user.update({ where: { id: requireUser().id }, data: b, select: { id: true, email: true, firstName: true, lastName: true, phone: true, locale: true } });
  }
  @Get('sessions') @SelfService()
  async sessions() {
    const rows = await this.prisma.session.findMany({ where: { userId: requireUser().id, revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { updatedAt: 'desc' }, select: { id: true, ipAddress: true, userAgent: true, createdAt: true, updatedAt: true } });
    return rows.map((r) => ({ ...r, current: r.id === getCtx()?.sessionId }));
  }
  @Delete('sessions/:id') @SelfService()
  async end(@Param('id') id: string) {
    const { count } = await this.prisma.session.updateMany({ where: { id, userId: requireUser().id, revokedAt: null }, data: { revokedAt: new Date() } });
    if (!count) throw new NotFoundException('Session not found');
    return { ok: true };
  }
}

@Global()
@Module({ controllers: [AuthController], providers: [AuthService], exports: [AuthService] })
export class AuthModule {}
