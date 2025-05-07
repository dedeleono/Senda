'use client';

import { useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Button } from '../ui/button';
import { useState, useCallback } from 'react';
import { Icons } from '../icons';
import { useRouter } from 'next/navigation';

export default function GoogleSignInButton() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl');
  const [isLoading, setIsLoading] = useState(false);
  
  const router = useRouter();
  

  const handleSignIn = useCallback(async () => {
    if (isLoading) return;

    setIsLoading(true);
    try {
      

      // Use the callback URL if provided, or default to the wallet dashboard with locale
      let callbackUrlValue = callbackUrl || `/home`;

      const result = await signIn('google', {
        callbackUrl: callbackUrlValue,
        redirect: false,
      });
      
      if (!result) {
        throw new Error('Sign in failed - no result returned');
      }

      if (result.error) {
        throw new Error(result.error);
      }

      if (result.url) {
        router.push(result.url);
      }
    } catch (error) {
      console.error('Sign in error:', error instanceof Error ? error.message : 'Unknown error occurred');
      // You might want to show this error to the user via a toast notification
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, callbackUrl, router]);

  return (
    <Button
      variant="outline"
      type="button"
      onClick={handleSignIn}
      disabled={isLoading}
      className="w-full h-11 border-muted-foreground/20 hover:bg-muted/30 bg-transparent"
    >
      {isLoading ? (
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-500 border-t-transparent" />
      ) : (
        <Icons.google className="h-5 w-5" />
      )}
      <span className="ml-2">
        {isLoading ? 'Signing in...' : 'Continue with Google'}
      </span>
    </Button>
  );
}
