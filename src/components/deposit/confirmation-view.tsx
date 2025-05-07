'use client';

import { Button } from '@/components/ui/button';
import { ArrowLeft, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import Image from 'next/image';
import usdcIcon from '@/public/usdc.svg';
import usdtIcon from '@/public/usdt-round.svg';
import { useDepositStore } from '@/stores/use-deposit-store';
import { trpc } from '@/app/_trpc/client';

const ConfirmationView = () => {
  const { formData, isSubmitting, submitDeposit, prevStep } = useDepositStore();
  
  // Get the mutation
  const createDepositMutation = trpc.transactionRouter.startDeposit.useMutation();
  
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
    try {
      // Pass the mutation function to the store
      await submitDeposit(createDepositMutation.mutateAsync);
    } catch (error) {
      console.error('Error submitting deposit:', error);
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