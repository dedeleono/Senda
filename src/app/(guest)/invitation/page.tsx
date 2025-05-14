'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Toaster } from '@/components/ui/sonner';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
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
  const [isSubmitting, setIsSubmitting] = useState(false);

  const verificationQuery = trpc.userRouter.verifyInvitation.useQuery(
    { token: token! },
    {
      enabled: !!token,
      retry: false
    }
  );

  const claimFundsMutation = trpc.transactionRouter.claimFunds.useMutation({
    onSuccess: () => {
      toast.success('Funds claimed successfully!');
      router.push('/success');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to claim funds');
      setIsSubmitting(false);
    }
  });

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

  const handleClaimFunds = async () => {
    if (!verificationData?.email || !token) return;

    setIsSubmitting(true);
    try {
      await claimFundsMutation.mutateAsync({
        token,
        email: verificationData.email
      });
    } catch (error) {
      // Error is handled by the mutation callbacks
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
                You have received {verificationData.amount} {verificationData.token}. Click below to claim your funds.
              </>
            ) : (
              'Click below to claim your funds.'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-500">
            Funds will be sent to your wallet associated with {verificationData?.email}.
          </p>
        </CardContent>
        <CardFooter>
          <Button
            onClick={handleClaimFunds}
            className="w-full"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Claiming Funds...
              </>
            ) : (
              'Claim Funds'
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
} 