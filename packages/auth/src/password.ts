import * as bcrypt from 'bcryptjs';

const COMMON = new Set(['password', 'password1', 'password123', '12345678', '123456789', 'qwerty123', 'welcome1', 'admin123', 'iloveyou']);

/** Returns a list of problems; empty means acceptable. bcrypt only reads 72 bytes, so cap there. */
export function passwordProblems(password: string): string[] {
  const out: string[] = [];
  if (password.length < 10) out.push('Use at least 10 characters');
  if (Buffer.byteLength(password) > 72) out.push('Use at most 72 bytes');
  if (!/[a-zA-Z]/.test(password) || !/[^a-zA-Z]/.test(password)) out.push('Mix letters with numbers or symbols');
  if (COMMON.has(password.toLowerCase())) out.push('This password is too common');
  return out;
}

export const hashPassword = (password: string): Promise<string> => bcrypt.hash(password, 12);

const DUMMY = bcrypt.hashSync('timing-equaliser', 12);

/** Always runs one bcrypt compare so unknown accounts take the same time. */
export async function verifyPassword(password: string, hash: string | null | undefined): Promise<boolean> {
  const ok = await bcrypt.compare(password, hash ?? DUMMY);
  return ok && Boolean(hash);
}
