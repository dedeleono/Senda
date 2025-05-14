'use client';

import { Button } from '@/components/ui/button';
import { CheckCircle } from 'lucide-react';
import { useWithdrawForm } from '@/stores/use-withdraw-form';
import Image from 'next/image';
import usdcIcon from '@/public/usdc.svg';
import usdtIcon from '@/public/usdt-round.svg';

type SuccessViewProps = {
  onClose: () => void;
  transactionId?: string;
};

const SuccessView = ({ onClose, transactionId }: SuccessViewProps) => {
  const { formData } = useWithdrawForm();
  
  const formatCurrency = (value: number) => {
    return value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const getEstimatedTimeText = () => {
    return formData.method === 'wallet' 
      ? 'Your funds should arrive in your wallet within 30 minutes.'
      : 'Your funds should arrive in your bank account within 1-3 business days.';
  };

  return (
    <div className="flex flex-col items-center justify-center text-center space-y-6">
      <div className="rounded-full bg-green-100 p-3">
        <CheckCircle className="h-10 w-10 text-green-600" />
      </div>
      
      <div>
        <h2 className="text-2xl font-bold mb-2">Withdrawal Initiated!</h2>
        <p className="text-gray-500">
          Your withdrawal request has been submitted successfully.
        </p>
      </div>
      
      <div className="bg-gray-50 rounded-lg px-8 py-4 w-full">
        <div className="flex items-center justify-center mb-2">
          <Image 
            src={formData.token === 'USDC' ? usdcIcon : usdtIcon} 
            alt={formData.token} 
            width={32} 
            height={32} 
            className="mr-2"
          />
          <span className="text-xl font-bold">{formatCurrency(formData.amount)} {formData.token}</span>
        </div>
        <p className="text-sm text-gray-500">
          {getEstimatedTimeText()}
        </p>
      </div>
      
      {transactionId && (
        <div className="w-full">
          <p className="text-xs text-gray-500 mb-1">Transaction Reference</p>
          <p className="text-sm font-medium bg-gray-100 p-2 rounded">{transactionId}</p>
        </div>
      )}
      
      <div className="pt-4 w-full">
        <Button 
          className="w-full" 
          onClick={onClose}
        >
          Done
        </Button>
      </div>
    </div>
  );
};

export default SuccessView; 