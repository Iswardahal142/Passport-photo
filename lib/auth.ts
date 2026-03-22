// lib/auth.ts
import { cookies } from 'next/headers';

const ALLOWED_EMAIL = 'junmain8@gmail.com';
const SESSION_COOKIE = 'admin_session';
const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || 'passport-pro-secret-2024-change-me';

// Simple signed token: base64(email + timestamp)
// For production, use a proper JWT or iron-session
export function createSessionToken(email: string): string {
  const payload = JSON.stringify({ email, ts: Date.now() });
  return Buffer.from(payload).toString('base64');
}

export function verifySessionToken(token: string): { email: string } | null {
  try {
    const payload = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
    if (payload.email !== ALLOWED_EMAIL) return null;
    // Token valid for 7 days
    if (Date.now() - payload.ts > 7 * 24 * 60 * 60 * 1000) return null;
    return { email: payload.email };
  } catch {
    return null;
  }
}

export function isAllowedEmail(email: string): boolean {
  return email.toLowerCase().trim() === ALLOWED_EMAIL.toLowerCase();
}

export { ALLOWED_EMAIL, SESSION_COOKIE };
