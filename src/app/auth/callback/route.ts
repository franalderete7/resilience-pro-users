import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  console.log('🔄 Auth callback - Starting');
  const requestUrl = new URL(request.url);
  console.log('🔍 Auth callback - URL:', requestUrl.toString());
  
  const code = requestUrl.searchParams.get('code');
  const error = requestUrl.searchParams.get('error');
  const error_description = requestUrl.searchParams.get('error_description');

  if (error) {
    console.error('❌ Auth callback - Error from provider:', {
      error,
      description: error_description
    });
    return NextResponse.redirect(new URL('/login', requestUrl.origin));
  }

  if (code) {
    console.log('🔑 Auth callback - Received code');
    
    try {
      // Create a supabase client with the cookies handler
      const cookieStore = cookies();
      const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
      
      console.log('🔄 Auth callback - Exchanging code for session');
      
      // Exchange the code for a session
      const { data: { session }, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      
      if (exchangeError) {
        console.error('❌ Auth callback - Error exchanging code:', exchangeError);
        return NextResponse.redirect(new URL('/login', requestUrl.origin));
      }

      console.log('✅ Auth callback - Session created successfully');

      // Redirect to the home page
      return NextResponse.redirect(new URL('/', requestUrl.origin));
    } catch (error) {
      console.error('❌ Auth callback - Unexpected error:', error);
      return NextResponse.redirect(new URL('/login', requestUrl.origin));
    }
  }

  console.log('❌ Auth callback - No code provided');
  // If no code is provided, redirect to login
  return NextResponse.redirect(new URL('/login', requestUrl.origin));
} 