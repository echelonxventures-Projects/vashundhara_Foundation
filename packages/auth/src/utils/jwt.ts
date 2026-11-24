/**
 * JWT utilities for Vashundhara Foundation Platform
 */

import { SignJWT, jwtVerify, exportJWK, generateKeyPair, type JWTPayload, type KeyLike  } from 'jose';

export interface TokenPayload extends JWTPayload {
  sub: string;
  email: string;
  tenantId: string;
  roles: string[];
  permissions: string[];
  type: 'access' | 'refresh';
}

export interface JWKSKey {
  kty: string;
  kid: string;
  use: string;
  alg: string;
  n: string;
  e: string;
}

let privateKey: KeyLike | null = null;
let publicKey: KeyLike | null = null;
let keyPairGenerated = false;

export async function generateKeyPairIfNeeded(): Promise<void> {
  if (keyPairGenerated) return;

  const { publicKey: pub, privateKey: priv } = await generateKeyPair('RS256', {
    extractable: true
  });

  publicKey = pub;
  privateKey = priv;
  keyPairGenerated = true;
}

export async function getPrivateKey(): Promise<KeyLike> {
  await generateKeyPairIfNeeded();
  return privateKey!;
}

export async function getPublicKey(): Promise<KeyLike> {
  await generateKeyPairIfNeeded();
  return publicKey!;
}

export async function exportPublicKeyAsJWK(): Promise<JWKSKey> {
  const pubKey = await getPublicKey();
  const jwk = await exportJWK(pubKey);
  return {
    kty: 'RSA',
    kid: 'vashundhara-key-1',
    use: 'sig',
    alg: 'RS256',
    n: jwk.n!,
    e: jwk.e!
  };
}

export async function createAccessToken(
  payload: Omit<TokenPayload, 'type' | 'exp' | 'iat'>,
  expiresIn: string = '15m'
): Promise<string> {
  const privateKey = await getPrivateKey();
  const now = Math.floor(Date.now() / 1000);
  const exp = now + parseDuration(expiresIn);

  return new SignJWT({
    ...payload,
    type: 'access'
  })
    .setProtectedHeader({ alg: 'RS256', kid: 'vashundhara-key-1' })
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .setIssuer('vashundhara-foundation')
    .setAudience('vashundhara-foundation')
    .sign(privateKey);
}

export async function createRefreshToken(
  payload: Omit<TokenPayload, 'type' | 'exp' | 'iat'>,
  expiresIn: string = '7d'
): Promise<string> {
  const privateKey = await getPrivateKey();
  const now = Math.floor(Date.now() / 1000);
  const exp = now + parseDuration(expiresIn);

  return new SignJWT({
    ...payload,
    type: 'refresh'
  })
    .setProtectedHeader({ alg: 'RS256', kid: 'vashundhara-key-1' })
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .setIssuer('vashundhara-foundation')
    .setAudience('vashundhara-foundation')
    .sign(privateKey);
}

export async function verifyToken(token: string): Promise<TokenPayload> {
  const publicKey = await getPublicKey();

  const { payload } = await jwtVerify(token, publicKey, {
    issuer: 'vashundhara-foundation',
    audience: 'vashundhara-foundation'
  });

  return payload as unknown as TokenPayload;
}

export async function decodeToken(token: string): Promise<TokenPayload | null> {
  try {
    return await verifyToken(token);
  } catch {
    return null;
  }
}

export function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) return 15 * 60; // default 15 minutes

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 60 * 60;
    case 'd': return value * 60 * 60 * 24;
    default: return 15 * 60;
  }
}

export function isTokenExpired(payload: TokenPayload): boolean {
  const now = Math.floor(Date.now() / 1000);
  return (payload.exp || 0) < now;
}

export function getTokenExpiry(payload: TokenPayload): Date | null {
  return payload.exp ? new Date(payload.exp * 1000) : null;
}

export function getTokenTimeRemaining(payload: TokenPayload): number {
  const now = Math.floor(Date.now() / 1000);
  return Math.max(0, (payload.exp || 0) - now);
}

export async function createTokenPair(
  payload: Omit<TokenPayload, 'type' | 'exp' | 'iat'>,
  accessExpiresIn: string = '15m',
  refreshExpiresIn: string = '7d'
): Promise<{ accessToken: string; refreshToken: string }> {
  const [accessToken, refreshToken] = await Promise.all([
    createAccessToken(payload, accessExpiresIn),
    createRefreshToken(payload, refreshExpiresIn)
  ]);

  return { accessToken, refreshToken };
}

export async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  try {
    const payload = await verifyToken(refreshToken);

    if (payload.type !== 'refresh') {
      return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { type: _type, exp: _exp, iat: _iat, ...tokenPayload } = payload;
    return createAccessToken(tokenPayload);
  } catch {
    return null;
  }
}

export function extractTokenFromHeader(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null;
  return authHeader.slice(7);
}