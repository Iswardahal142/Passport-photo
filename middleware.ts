import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Middleware runs on edge — only basic checks here
// Full auth is handled in the API routes
export function middleware(request: NextRequest) {
  // Allow all requests through — auth checked in API routes and page
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
