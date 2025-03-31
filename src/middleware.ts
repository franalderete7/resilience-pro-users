import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  console.log('🔒 Middleware - Starting request:', {
    path: req.nextUrl.pathname,
    method: req.method,
    cookies: req.cookies.getAll().map(c => ({
      name: c.name,
      value: c.value ? 'present' : 'empty',
    }))
  });

  // Clone the request headers to avoid modifying the original request
  const res = NextResponse.next();
  
  try {
    // Create a Supabase client for this request
    const supabase = createMiddlewareClient({ req, res });
    
    // Refresh the session if it exists and get the current session state
    const { data: { session }, error } = await supabase.auth.getSession();
    
    // Log the session information for debugging
    console.log('🔒 Middleware - Session check:', {
      hasSession: !!session,
      sessionUser: session?.user?.email,
      hasAccessToken: !!session?.access_token,
      hasRefreshToken: !!session?.refresh_token,
      error: error?.message,
      path: req.nextUrl.pathname,
      isLoginPage: req.nextUrl.pathname.startsWith('/login'),
      isCallbackPage: req.nextUrl.pathname.startsWith('/auth/callback')
    });
    
    // Always allow access to the auth callback route
    if (req.nextUrl.pathname.startsWith('/auth/callback')) {
      console.log('✅ Middleware - Allowing access to callback route');
      return res;
    }

    // Always allow access to public assets
    if (
      req.nextUrl.pathname.startsWith('/_next') ||
      req.nextUrl.pathname.startsWith('/favicon.ico') ||
      req.nextUrl.pathname.startsWith('/public')
    ) {
      return res;
    }
    
    // If there's no session and the user is trying to access a protected route
    if (!session && !req.nextUrl.pathname.startsWith('/login')) {
      console.log('🚫 Middleware - No session, redirecting to login');
      const redirectUrl = req.nextUrl.clone();
      redirectUrl.pathname = '/login';
      return NextResponse.redirect(redirectUrl);
    }
    
    // If there's a session and the user is trying to access the login page
    if (session && req.nextUrl.pathname.startsWith('/login')) {
      console.log('✅ Middleware - Has session, redirecting to home');
      const redirectUrl = req.nextUrl.clone();
      redirectUrl.pathname = '/';
      return NextResponse.redirect(redirectUrl);
    }
    
    // Return the response with any session cookies attached
    return res;
  } catch (err) {
    console.error('🔒 Middleware - Error:', err);
    return res;
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|\.svg).*)'],
}; 