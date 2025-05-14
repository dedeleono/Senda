'use client';

import { Button } from '@/components/ui/button';
import { Wallet, CreditCard } from 'lucide-react';
import { useWithdrawForm } from '@/stores/use-withdraw-form';
import Image from 'next/image';

const MethodSelect = () => {
  const { selectMethod } = useWithdrawForm();

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <p className="text-sm text-gray-500">Choose how you'd like to withdraw your funds</p>
      </div>
      
      <div className="space-y-6">
        <Button
          variant="outline"
          className="w-full h-32 flex flex-col items-center justify-center gap-3 hover:bg-[#f6ead7] hover:text-black p-4"
          onClick={() => selectMethod('wallet')}
        >
          <div className="bg-[#f6ead7] p-4 rounded-full">
            <Wallet className="h-16 w-8" />
          </div>
          <div className="flex flex-col items-center">
            <span className="text-lg font-medium">Withdraw to Solana Wallet</span>
            <span className="text-sm text-gray-500">Receive funds directly in your Solana wallet</span>
          </div>
        </Button>

        <Button
          variant="outline"
          className="w-full h-50 flex flex-col items-center justify-center gap-3 hover:bg-[#f6ead7] hover:text-black p-4"
          onClick={() => selectMethod('bank')}
        >
          <div className="bg-[#f6ead7] p-4 rounded-full">
            <CreditCard className="h-16 w-8" />
          </div>
          <div className="flex flex-col items-center">
            <span className="text-lg font-medium">Withdraw to Bank Account</span>
            <span className="text-sm text-gray-500">Receive funds in your bank account (1-3 business days)</span>
            <span className="text-sm text-gray-500">Currently available in Guatemala</span>
            <div className="flex items-center gap-2 mt-2">
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
        </Button>
      </div>
    </div>
  );
};

export default MethodSelect; 