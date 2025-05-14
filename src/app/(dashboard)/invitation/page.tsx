'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Toaster } from '@/components/ui/sonner';
import { Loader2 } from 'lucide-react';
import { signIn } from 'next-auth/react';
import { toast, useSonner } from 'sonner';
import { trpc } from '@/app/_trpc/client';

interface VerificationData {
    email: string;
    amount?: string;
    token?: string;
    escrowId?: string;
}

interface VerificationResponse {
    success: boolean;
    data?: VerificationData;
    error?: string;
}

export default function InvitationPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [isLoading, setIsLoading] = useState(true);
  const [verificationData, setVerificationData] = useState<VerificationResponse['data']>();
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const verificationQuery = trpc.userRouter.verifyInvitation.useQuery(
    { token: token! },
    {
      enabled: !!token,
      retry: false
    }
  );

  useEffect(() => {
    if (verificationQuery.data?.success && verificationQuery.data.data) {
      setVerificationData(verificationQuery.data.data);
    }
    if (verificationQuery.error) {
      toast.error('Invalid invitation');
      router.push('/');
    }
    if (!verificationQuery.isLoading) {
      setIsLoading(false);
    }
  }, [verificationQuery.data, verificationQuery.error, verificationQuery.isLoading, router]);

  useEffect(() => {
    if (!token) {
      toast.error('No invitation token provided.');
      router.push('/');
    }
  }, [token, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationData?.email || !password) return;

    setIsSubmitting(true);
    try {
      const result = await signIn('credentials', {
        email: verificationData.email,
        password,
        token,
        callbackUrl: '/home',
        redirect: false,
      });

      if (result?.error) {
        throw new Error(result.error);
      }

      toast.success('Welcome to Senda!');

      router.push('/home');
    } catch (error) {
      toast.error('Failed to create account');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Welcome to Senda!</CardTitle>
          <CardDescription>
            {verificationData?.amount && verificationData?.token ? (
              <>
                You have received {verificationData.amount} {verificationData.token}. Create your account to access your funds.
              </>
            ) : (
              'Create your account to get started.'
            )}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={verificationData?.email}
                disabled
                className="bg-muted"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Create Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter a secure password"
                required
                minLength={8}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Account...
                </>
              ) : (
                'Create Account & Access Funds'
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
} 