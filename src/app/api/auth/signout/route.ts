import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  console.log('API - /api/auth/signout - Starting server-side sign out');
  
  try {
    // Server-side signout is more reliable for clearing cookies
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    
    // Sign out the user server-side
    await supabase.auth.signOut();
    console.log('API - /api/auth/signout - Completed server-side sign out');
    
    // Return success with cookie-clearing headers
    return new NextResponse(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('API - /api/auth/signout - Error:', error);
    
    // Return error response
    return NextResponse.json(
      { error: 'Failed to sign out' },
      { status: 500 }
    );
  }
} 