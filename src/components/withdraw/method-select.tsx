'use client';

import { Button } from '@/components/ui/button';
import { Wallet, CreditCard } from 'lucide-react';
import { useWithdrawForm } from '@/stores/use-withdraw-form';

const MethodSelect = () => {
  const { selectMethod } = useWithdrawForm();

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <p className="text-sm text-gray-500">Choose how you'd like to withdraw your funds</p>
      </div>
      
      <div className="space-y-4">
        <Button
          variant="outline"
          className="w-full h-24 flex flex-col items-center justify-center gap-2 hover:bg-[#f6ead7] hover:text-black"
          onClick={() => selectMethod('wallet')}
        >
          <div className="bg-[#f6ead7] p-3 rounded-full">
            <Wallet className="h-6 w-6" />
          </div>
          <div className="flex flex-col items-center">
            <span className="font-medium">Withdraw to Solana Wallet</span>
            <span className="text-xs text-gray-500">Receive funds directly in your Solana wallet</span>
          </div>
        </Button>

        <Button
          variant="outline"
          className="w-full h-24 flex flex-col items-center justify-center gap-2 hover:bg-[#f6ead7] hover:text-black"
          onClick={() => selectMethod('bank')}
        >
          <div className="bg-[#f6ead7] p-3 rounded-full">
            <CreditCard className="h-6 w-6" />
          </div>
          <div className="flex flex-col items-center">
            <span className="font-medium">Withdraw to Bank Account</span>
            <span className="text-xs text-gray-500">Receive funds in your bank account (1-3 business days)</span>
          </div>
        </Button>
      </div>
    </div>
  );
};

export default MethodSelect; 