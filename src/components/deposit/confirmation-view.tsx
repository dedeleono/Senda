'use client';

import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Image from 'next/image';
import usdcIcon from '@/public/usdc.svg';
import usdtIcon from '@/public/usdt-round.svg';
import { useDepositForm } from '@/stores/use-deposit-form';
import { useWalletStore } from '@/stores/use-wallet-store';
import { useSendaProgram } from '@/stores/use-senda-program';
import { toast } from 'sonner';
import type { CreateDepositResponse } from '@/types/transaction';
import { useAuth } from '@/hooks/use-auth';
import { SignatureType } from '@prisma/client';

interface ConfirmationViewProps {
  onComplete: (signature: string, depositId: string) => void;
}

const ConfirmationView = ({ onComplete }: ConfirmationViewProps) => {
  const { 
    formData, 
    isSubmitting, 
    prevStep, 
    setSubmitting, 
    setError,
    setStep 
  } = useDepositForm();
  const { publicKey } = useWalletStore();
  const sendaProgram = useSendaProgram();
  const { session } = useAuth()
  
  const { recipient, amount, authorization } = formData;
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };
  
  const getAuthorizationText = (auth: string) => {
    switch (auth) {
      case 'sender':
        return 'Sender Only (You)';
      case 'receiver':
        return 'Recipient Only';
      case 'both':
        return 'Both Parties';
      default:
        return auth;
    }
  };
  
  const handleSubmit = async () => {
    if (!publicKey) {
      toast.error('Please connect your wallet first');
      return;
    }

    try {
      setSubmitting(true);
      setError(undefined);
      
      const result = await sendaProgram.createDeposit({
        userId: session?.user?.id as string,
        depositor: publicKey.toString(),
        recipientEmail: recipient.email,
        stable: amount.token.toLowerCase() as 'usdc' | 'usdt',
        authorization: authorization as SignatureType,
        amount: amount.value
      });
      
      // @ts-ignore
      if (!result.success || !result.data) {
        throw new Error(result.error?.message || 'Failed to create deposit');
      }

      // Call onComplete with the transaction data
      onComplete(result.data.signature, result.data.depositId);
      
      setStep(4); // Move to success step
      toast.success('Deposit created successfully');
      
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create deposit';
      setError(message);
      toast.error('Failed to create deposit: ' + message);
    } finally {
      setSubmitting(false);
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <p className="text-sm text-gray-500 mb-2">Please review your deposit details</p>
      </div>
      
      <div className="space-y-4">
        <div className="rounded-lg border p-4">
          <h3 className="font-medium text-sm text-gray-500 mb-2">Recipient</h3>
          <div className="flex items-center">
            <div className="ml-2">
              <p className="font-medium">{recipient.email}</p>
              <p className="text-xs text-gray-500">
                {recipient.exists ? 'Existing user' : 'Will be invited to Senda'}
              </p>
            </div>
          </div>
        </div>
        
        <div className="rounded-lg border p-4">
          <h3 className="font-medium text-sm text-gray-500 mb-2">Amount</h3>
          <div className="flex items-center">
            <div className="mr-2">
              <Image 
                src={amount.token === 'USDC' ? usdcIcon : usdtIcon} 
                alt={amount.token} 
                width={32} 
                height={32} 
              />
            </div>
            <div>
              <p className="font-medium">{formatCurrency(amount.value)} {amount.token}</p>
            </div>
          </div>
        </div>
        
        <div className="rounded-lg border p-4">
          <h3 className="font-medium text-sm text-gray-500 mb-2">Withdrawal Authorization</h3>
          <p className="font-medium">{getAuthorizationText(authorization)}</p>
        </div>
      </div>
      
      <div className="space-y-2 pt-2">
        <Button 
          onClick={handleSubmit}
          className="w-full"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            'Confirm Deposit'
          )}
        </Button>
        
        <Button 
          type="button" 
          variant="outline"
          className="w-full"
          onClick={prevStep}
          disabled={isSubmitting}
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
      </div>
    </div>
  );
};

export default ConfirmationView; 