import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const AUTH_COOKIE_NAMES = [
  'next-auth.session-token',
  '__Secure-next-auth.session-token', 
  'authjs.session-token',
  '__Secure-authjs.session-token'
];

const PUBLIC_ROUTES = [
  '/login',
  '/verify-request',
  '/login/error',
  '/2fa-verify',
  '/about',
  '/contact',
  '/invitation',
];

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  
  const fromLogout = searchParams.get('from') === 'logout';
  if (fromLogout) {
    console.log('DEBUG MIDDLEWARE: Detected logout flow, skipping auth check');
    if (pathname === '/') {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return NextResponse.next();
  }
  
  console.log('DEBUG MIDDLEWARE: All cookies:', JSON.stringify(Object.fromEntries(request.cookies)));
  console.log('DEBUG MIDDLEWARE: Path requested:', pathname);
  
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/api/') ||
    pathname.match(/\.(jpg|jpeg|gif|png|svg|ico|webp|js|css)$/)
  ) {
    console.log('DEBUG MIDDLEWARE: Skipping middleware for asset/API:', pathname);
    return NextResponse.next();
  }

  if (pathname === '/') {
    const isAuthenticated = AUTH_COOKIE_NAMES.some(cookie => {
      const hasCookie = request.cookies.has(cookie);
      if (hasCookie) {
        const value = request.cookies.get(cookie)?.value;
        console.log(`DEBUG MIDDLEWARE: Found auth cookie ${cookie} with value: ${value ? value.substring(0, 10) + '...' : 'empty'}`);
        return !!value;
      }
      return false;
    });
    
    console.log('DEBUG MIDDLEWARE: Root path, authenticated:', isAuthenticated);
    
    if (isAuthenticated) {
      console.log('DEBUG MIDDLEWARE: Redirecting to /home');
      return NextResponse.redirect(new URL('/home', request.url));
    } else {
      console.log('DEBUG MIDDLEWARE: Redirecting to /login');
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  const isPublicPath = PUBLIC_ROUTES.some(path => 
    pathname === path || pathname.startsWith(`${path}/`)
  );

  const isAuthenticated = AUTH_COOKIE_NAMES.some(cookie => {
    const hasCookie = request.cookies.has(cookie);
    if (hasCookie) {
      const value = request.cookies.get(cookie)?.value;
      console.log(`DEBUG MIDDLEWARE: Found auth cookie ${cookie} with value: ${value ? value.substring(0, 10) + '...' : 'empty'}`);
      return !!value;
    }
    return false;
  });

  console.log(`DEBUG MIDDLEWARE: Path=${pathname}, Public=${isPublicPath}, Auth=${isAuthenticated}, Auth Cookie Names=${JSON.stringify(AUTH_COOKIE_NAMES)}`);

  if (isAuthenticated && pathname === '/login') {
    console.log('DEBUG MIDDLEWARE: Authenticated user trying to access login, redirecting to /home');
    return NextResponse.redirect(new URL('/home', request.url));
  }

  if (isPublicPath) {
    console.log('DEBUG MIDDLEWARE: Public path, allowing access:', pathname);
    return NextResponse.next();
  }

  if (!isAuthenticated) {
    const callbackUrl = encodeURIComponent(pathname);
    console.log('DEBUG MIDDLEWARE: Unauthenticated access to protected route, redirecting to login');
    return NextResponse.redirect(new URL(`/login?callbackUrl=${callbackUrl}`, request.url));
  }
  console.log('DEBUG MIDDLEWARE: Authenticated access to protected route, allowing');
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}; 