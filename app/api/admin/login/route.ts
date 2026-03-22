import { NextRequest, NextResponse } from 'next/server';
import { isAllowedEmail, createSessionToken, SESSION_COOKIE } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!isAllowedEmail(email)) {
      return NextResponse.json({ error: 'Access denied. You are not authorized.' }, { status: 403 });
    }

    const adminPassword = process.env.ADMIN_PASSWORD || 'Iswardahal3154@';
    if (password !== adminPassword) {
      return NextResponse.json({ error: 'Wrong password.' }, { status: 401 });
    }

    const token = createSessionToken(email);

    const res = NextResponse.json({ success: true });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return res;
  } catch (e) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
