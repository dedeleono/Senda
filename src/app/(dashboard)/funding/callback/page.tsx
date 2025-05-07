'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { useSendaProgram } from '@/stores/use-senda-program';

export default function FundingCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [processingStatus, setProcessingStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const sendaProgram = useSendaProgram();
  
  useEffect(() => {
    async function processFundingCallback() {
      try {
        // Get parameters from the URL
        const status = searchParams.get('status');
        const transactionId = searchParams.get('transaction_id');
        const amount = searchParams.get('amount');
        const asset = searchParams.get('asset');
        const walletAddress = searchParams.get('wallet_address');
        
        if (!status || !transactionId || !amount || !asset || !walletAddress) {
          throw new Error('Missing required parameters');
        }
        
        if (status !== 'success') {
          throw new Error(`Funding failed with status: ${status}`);
        }
        
        // Record the successful funding transaction
        await fetch('/api/privy/record-funding', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            transactionId,
            walletAddress,
            amount: parseFloat(amount),
            asset,
            method: 'privy',
          }),
        });
        
        setProcessingStatus('success');
        
        // Show success message
        toast.success('Wallet funded successfully!');
        
        // Navigate back to the dashboard after a delay
        setTimeout(() => {
          router.push('/dashboard');
        }, 2000);
      } catch (error) {
        console.error('Error processing funding callback:', error);
        setProcessingStatus('error');
        toast.error('Failed to process funding');
      }
    }
    
    processFundingCallback();
  }, [searchParams, router]);
  
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-md p-6 bg-card rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold mb-6 text-center">
          {processingStatus === 'processing' && 'Processing Your Payment'}
          {processingStatus === 'success' && 'Payment Successful!'}
          {processingStatus === 'error' && 'Payment Processing Error'}
        </h1>
        
        <div className="flex items-center justify-center">
          {processingStatus === 'processing' && (
            <div className="animate-spin h-8 w-8 border-2 border-primary rounded-full border-t-transparent"></div>
          )}
          
          {processingStatus === 'success' && (
            <div className="text-green-500">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
          
          {processingStatus === 'error' && (
            <div className="text-red-500">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          )}
        </div>
        
        <p className="text-center mt-4">
          {processingStatus === 'processing' && 'Please wait while we confirm your payment...'}
          {processingStatus === 'success' && 'Your wallet has been funded. Redirecting to dashboard...'}
          {processingStatus === 'error' && 'There was an error processing your payment. Please try again.'}
        </p>
      </div>
    </div>
  );
} 