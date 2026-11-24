/**
 * Auth Controller for Vashundhara Foundation API
 */

import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';

import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import type { JwtPayload } from '../../guards/jwt-auth.guard';

import { AuthService } from './auth.service';
import type { SanitizedUser } from './auth.service';

interface AuthenticatedRequest extends Request {
  user: (JwtPayload & { id: string }) | undefined;
  cookies: Record<string, string>;
  body: Record<string, unknown>;
}

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ============================================
  // Login / Logout
  // ============================================

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 900000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'User login' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(
    @Body() body: { email: string; password: string; tenantSlug?: string; rememberMe?: boolean },
    @Res({ passthrough: true }) res: Response
  ): Promise<{ user: SanitizedUser; accessToken: string; expiresIn: number; tokenType: string }> {
    const result = await this.authService.login(body);

    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: (result.expiresIn || 900) * 1000
    });

    return {
      user: result.user,
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
      tokenType: result.tokenType
    };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'User logout' })
  @ApiResponse({ status: 200, description: 'Logout successful' })
  logout(@Req() req: AuthenticatedRequest, @Res({ passthrough: true }) res: Response) {
    const userId = req.user?.id;
    if (userId) {
      this.authService.revokeTokens(userId);
    }

    res.clearCookie('refreshToken');
    return { success: true, message: 'Logged out successfully' };
  }

  @Post('refresh')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Token refreshed' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refresh(@Req() req: AuthenticatedRequest, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.refreshToken || (req.body?.refreshToken as string | undefined);

    if (!refreshToken) {
      return { success: false, error: 'Refresh token required' };
    }

    const result = await this.authService.refreshTokens(refreshToken);

    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: result.expiresIn * 1000
    });

    return {
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
      tokenType: result.tokenType
    };
  }

  // ============================================
  // Registration
  // ============================================

  @Post('register')
  @Throttle({ default: { limit: 3, ttl: 900000 } })
  @ApiOperation({ summary: 'User registration' })
  @ApiResponse({ status: 201, description: 'Registration successful' })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  async register(@Body() body: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    tenantSlug?: string;
    tenantName?: string;
  }): Promise<{ user: SanitizedUser; accessToken: string; expiresIn: number; tokenType: string }> {
    return this.authService.register(body);
  }

  // ============================================
  // Password Management
  // ============================================

  @Post('password/reset-request')
  @Throttle({ default: { limit: 2, ttl: 3600000 } })
  @ApiOperation({ summary: 'Request password reset' })
  @ApiResponse({ status: 200, description: 'Reset email sent if account exists' })
  async requestPasswordReset(@Body() body: { email: string }) {
    return this.authService.requestPasswordReset(body.email);
  }

  @Post('password/reset')
  @ApiOperation({ summary: 'Reset password with token' })
  @ApiResponse({ status: 200, description: 'Password reset successful' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async resetPassword(@Body() body: { token: string; password: string }) {
    return this.authService.resetPassword(body.token, body.password);
  }

  @Post('password/change')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change password (authenticated)' })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  @ApiResponse({ status: 401, description: 'Current password incorrect' })
  async changePassword(
    @Req() req: AuthenticatedRequest,
    @Body() body: { currentPassword: string; newPassword: string }
  ) {
    const userId = req.user!.id;
    return this.authService.changePassword(userId, body.currentPassword, body.newPassword);
  }

  // ============================================
  // Email Verification
  // ============================================

  @Post('email/verify-request')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 3, ttl: 3600000 } })
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Request email verification' })
  @ApiResponse({ status: 200, description: 'Verification email sent' })
  async requestEmailVerification(@Req() req: AuthenticatedRequest) {
    const userId = req.user!.id;
    return this.authService.requestEmailVerification(userId);
  }

  @Post('email/verify')
  @ApiOperation({ summary: 'Verify email with token' })
  @ApiResponse({ status: 200, description: 'Email verified successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async verifyEmail(@Body() body: { token: string }) {
    return this.authService.verifyEmail(body.token);
  }

  // ============================================
  // MFA
  // ============================================

  @Post('mfa/setup')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Setup MFA' })
  @ApiResponse({ status: 200, description: 'MFA setup initiated' })
  setupMFA(@Req() req: AuthenticatedRequest) {
    const userId = req.user!.id;
    return this.authService.setupMFA(userId);
  }

  @Post('mfa/verify')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify MFA code' })
  @ApiResponse({ status: 200, description: 'MFA verified' })
  verifyMFA(@Req() req: AuthenticatedRequest, @Body() body: { code: string }) {
    const userId = req.user!.id;
    return this.authService.verifyMFA(userId, body.code);
  }

  @Post('mfa/disable')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Disable MFA' })
  @ApiResponse({ status: 200, description: 'MFA disabled' })
  disableMFA(@Req() req: AuthenticatedRequest) {
    const userId = req.user!.id;
    return this.authService.disableMFA(userId);
  }

  // ============================================
  // API Keys
  // ============================================

  @Post('api-keys')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create API key' })
  @ApiResponse({ status: 201, description: 'API key created' })
  async createApiKey(
    @Req() req: AuthenticatedRequest,
    @Body() body: { name: string; permissions?: string[]; expiresAt?: string }
  ) {
    const userId = req.user!.id;
    return this.authService.createApiKey(
      userId,
      body.name,
      body.permissions,
      body.expiresAt ? new Date(body.expiresAt) : undefined
    );
  }

  @Get('api-keys')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List API keys' })
  @ApiResponse({ status: 200, description: 'List of API keys' })
  async listApiKeys(@Req() req: AuthenticatedRequest) {
    const userId = req.user!.id;
    return this.authService.listApiKeys(userId);
  }

  @Post('api-keys/:id/revoke')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke API key' })
  @ApiResponse({ status: 200, description: 'API key revoked' })
  async revokeApiKey(@Req() req: AuthenticatedRequest, @Body() body: { id: string }) {
    const userId = req.user!.id;
    return this.authService.revokeApiKey(userId, body.id);
  }

  // ============================================
  // Current User
  // ============================================

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Current user profile' })
  // eslint-disable-next-line @typescript-eslint/require-await
  async me(@Req() req: AuthenticatedRequest) {
    return req.user;
  }
}