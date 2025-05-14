'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useWithdrawForm } from '@/stores/use-withdraw-form';
import Image from 'next/image';
import usdcIcon from '@/public/usdc.svg';
import usdtIcon from '@/public/usdt-round.svg';
import { Loader2 } from 'lucide-react';
import { SignatureType } from '@prisma/client';
import { useAuth } from '@/hooks/use-auth';
import { useSendaProgram } from '@/stores/use-senda-program';

type ConfirmationViewProps = {
  onComplete: (transactionId: string) => void;
};

const ConfirmationView = ({ onComplete }: ConfirmationViewProps) => {
  const { formData, prevStep, nextStep } = useWithdrawForm();
  const [isProcessing, setIsProcessing] = useState(false);
  const sendaProgram = useSendaProgram();
  const { session } = useAuth();

  const formatCurrency = (value: number) => {
    return value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const handleConfirm = async () => {
    try {
      setIsProcessing(true);
      
      // TODO: Implement actual withdrawal logic here
      // This would connect to your backend API to process the withdrawal
      console.log("withdrawal formData", formData)
      const result = await sendaProgram.transferSpl({
        userId: session?.user?.id as string,
        destinationAddress: formData.walletAddress as string,
        stable: formData.token.toLowerCase() as 'usdc' | 'usdt',
        amount: formData.amount
      });
      
      // @ts-ignore
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to create deposit');
      }

      // Simulate API call with delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Mock transaction ID
      const mockTransactionId = `withdraw-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      
      onComplete(mockTransactionId);
      nextStep();

    } catch (error) {
      console.error("Withdrawal failed:", error);
      // Handle error - could show error message here
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <p className="text-sm text-gray-500 mb-2">Please review your withdrawal details</p>
      </div>
      
      <div className="space-y-4">
        <div className="rounded-lg border p-4">
          <h3 className="font-medium text-sm text-gray-500 mb-2">Withdrawal Method</h3>
          <p className="font-medium">
            {formData.method === 'wallet' ? 'Solana Wallet' : 'Bank Account'}
          </p>
          {formData.method === 'bank' && (
            <div className="mt-2">
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-gray-500">Powered by</span>
                <Image 
                  src="https://cdn.prod.website-files.com/66c35e8262b10fa677d4282c/66c36d87c4b68f50f55a13b9_Copy%20of%20Maverick-Logo-09-p-500.png"
                  alt="Maverick Capital Investment"
                  width={90}
                  height={25}
                  className="object-contain"
                />
              </div>
            </div>
          )}
        </div>
        
        <div className="rounded-lg border p-4">
          <h3 className="font-medium text-sm text-gray-500 mb-2">Amount</h3>
          <div className="flex items-center">
            <div className="mr-2">
              <Image 
                src={formData.token === 'USDC' ? usdcIcon : usdtIcon} 
                alt={formData.token} 
                width={32} 
                height={32} 
              />
            </div>
            <div>
              <p className="font-medium">{formatCurrency(formData.amount)} {formData.token}</p>
            </div>
          </div>
        </div>
        
        {formData.method === 'wallet' && formData.walletAddress && (
          <div className="rounded-lg border p-4">
            <h3 className="font-medium text-sm text-gray-500 mb-2">Recipient Wallet</h3>
            <p className="font-medium break-all">{formData.walletAddress}</p>
          </div>
        )}
        
        {formData.method === 'bank' && formData.bankInfo && (
          <div className="rounded-lg border p-4">
            <h3 className="font-medium text-sm text-gray-500 mb-2">Bank Account Details</h3>
            <div className="space-y-1">
              <p><span className="text-gray-500">Name:</span> {formData.bankInfo.accountName}</p>
              <p><span className="text-gray-500">Bank:</span> {formData.bankInfo.bankName}</p>
              <p>
                <span className="text-gray-500">Account:</span> 
                {formData.bankInfo.accountNumber.replace(/\d(?=\d{4})/g, "*")}
              </p>
              <p>
                <span className="text-gray-500">Routing:</span> 
                {formData.bankInfo.routingNumber}
              </p>
            </div>
          </div>
        )}
        
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
          <p className="text-sm text-orange-800">
            Please note that withdrawals may take 1-3 business days to process. 
            {formData.method === 'bank' && " Bank transfers may be subject to additional processing time."}
          </p>
        </div>
      </div>
      
      <div className="pt-4 flex justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={prevStep}
          disabled={isProcessing}
        >
          Back
        </Button>
        <Button 
          type="button" 
          onClick={handleConfirm}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            'Confirm Withdrawal'
          )}
        </Button>
      </div>
    </div>
  );
};

export default ConfirmationView; 