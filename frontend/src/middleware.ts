import { NextRequest, NextResponse } from 'next/server';

// Exact-match public paths (landing pages — no auth required)
const PUBLIC_EXACT = new Set(['/', '/about', '/peppol', '/services', '/contact']);

// Always public — accessible whether logged in or not (no redirect either way)
const ALWAYS_PUBLIC = ['/activate', '/verify-email', '/buyer/accept-invite'];

// Public for unauthenticated users — authenticated users get bounced to dashboard
const GUEST_ONLY = ['/login', '/register', '/mfa-verify', '/mfa-setup', '/forgot-password', '/reset-password'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const access = request.cookies.get('access_token')?.value;

  const isPublic =
    PUBLIC_EXACT.has(pathname) ||
    ALWAYS_PUBLIC.some((p) => pathname.startsWith(p)) ||
    GUEST_ONLY.some((p) => pathname.startsWith(p));

  // Unauthenticated user hitting a protected route → send to login
  if (!isPublic && !access) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Authenticated user hitting login/register → send to dashboard
  // /verify-email and /activate are intentionally NOT redirected —
  // users need these pages even while authenticated (email not verified yet)
  const isGuestOnly = GUEST_ONLY.some((p) => pathname.startsWith(p));
  if (isGuestOnly && access) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
};
