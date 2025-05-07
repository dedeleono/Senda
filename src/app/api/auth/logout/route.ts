import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';
import { prisma } from '@/lib/db';
import { cookies } from 'next/headers';

export async function POST() {
    try {
        const session = await auth();
        
        if (session?.user?.id) {
            // Clean up database sessions
            try {
                // Delete 2FA confirmation
                await prisma.twoFactorConfirmation.deleteMany({
                    where: { userId: session.user.id }
                });
                
                // Delete any session records if using database sessions
                await prisma.session.deleteMany({
                    where: { userId: session.user.id }
                }).catch(() => {
                    // Ignore errors if session table doesn't exist or is not accessible
                });
            } catch (dbError) {
                console.error('Error cleaning up database during logout:', dbError);
                // Continue with logout even if DB cleanup fails
            }
        }
    } catch (error) {
        console.error('Error clearing user session data:', error);
        // Don't throw - we want this endpoint to always return success
        // even if operations fail
    }

    // Create response with cleared cookies
    const response = NextResponse.json({ success: true });
    
    // Clear all auth-related cookies in the response
    // Focus on Next-Auth v5 cookie names
    const cookiesToClear = [
        // Next-Auth v5 cookie names
        'next-auth.session-token',
        'next-auth.csrf-token',
        'next-auth.callback-url',
        
        // Secure versions
        '__Secure-next-auth.session-token',
        '__Secure-next-auth.csrf-token',
        '__Secure-next-auth.callback-url',
        
        // Auth.js cookie names (new naming convention in v5)
        'authjs.session-token',
        'authjs.csrf-token',
        'authjs.callback-url',
        'authjs.pkce.code_verifier',
        'authjs.pkce.state',
        
        // Secure versions
        '__Secure-authjs.session-token',
        '__Secure-authjs.csrf-token',
        '__Secure-authjs.callback-url',
    ];
    
    // Set all cookies with expiration in the past to clear them
    for (const cookieName of cookiesToClear) {
        response.cookies.set({
            name: cookieName,
            value: '',
            expires: new Date(0),
            path: '/'
        });
    }

    return response;
}

// Support both GET and POST
export { POST as GET }; 