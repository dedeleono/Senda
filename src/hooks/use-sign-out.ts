'use client';

import { signOut } from 'next-auth/react';
import { deleteCookie, setCookie } from 'cookies-next';

export function useSignOut() {
    const handleSignOut = async () => {
        try {
            sessionStorage.setItem('in-logout-flow', 'true');

            setCookie('prevent-auto-signin', 'true', {
                maxAge: 10,
                path: '/',
                sameSite: 'lax'
            });

            const cookiesToDelete = [
                // Auth.js cookies
                'authjs.session-token',
                'authjs.csrf-token',
                'authjs.callback-url',
                'authjs.pkce.code_verifier',
                'authjs.pkce.state',
                '__Secure-next-auth.session-token',
                '__Secure-next-auth.csrf-token',
                '__Secure-next-auth.callback-url',
                'next-auth.session-token',
                'next-auth.csrf-token',
                'next-auth.callback-url',
                // Google specific cookies
                'g_state',
                'g_csrf_token'
            ];
            
            // Delete all cookies
            cookiesToDelete.forEach(cookie => {
                deleteCookie(cookie);
                deleteCookie(cookie, { path: '/' });
                deleteCookie(cookie, { path: '/api' });
                deleteCookie(cookie, { path: '/api/auth' });
            });
            
            fetch('/api/auth/logout', { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: AbortSignal.timeout(2000)
            }).catch(() => {});
            

            await signOut({ 
                redirect: true,
                callbackUrl: '/login'
            });
            
            try {
                localStorage.removeItem('next-auth.message');
                localStorage.removeItem('next-auth.state');
                // Clear our logout flag if we somehow get here
                sessionStorage.removeItem('in-logout-flow');
            } catch (e) {
                // Ignore localStorage errors
            }
        } catch (error) {
            console.error('Error during sign out:', error);
            // Fallback redirect
            window.location.href = '/login';
            return Promise.reject(error);
        }
    };

    return handleSignOut;
}