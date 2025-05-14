'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import Image from 'next/image';
import usdcIcon from '@/public/usdc.svg';
import usdtIcon from '@/public/usdt-round.svg';
import { useWithdrawForm } from '@/stores/use-withdraw-form';
import { useWalletBalances } from '@/hooks/use-wallet-balances';

const AmountForm = () => {
  const { formData, setAmount, setToken, nextStep, prevStep } = useWithdrawForm();
  const [inputAmount, setInputAmount] = useState(formData.amount.toString());
  const [error, setError] = useState<string | null>(null);
  const { balances } = useWalletBalances();

  const selectedTokenBalance = balances.find(
    (balance) => balance.symbol === formData.token
  )?.uiBalance || 0;

  const handleTokenChange = (value: 'USDC' | 'USDT') => {
    setToken(value);
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputAmount(value);
    
    // Validate it's a number and non-negative
    if (!/^\d*\.?\d*$/.test(value)) {
      setError('Please enter a valid number');
    } else {
      setError(null);
    }
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const amount = parseFloat(inputAmount);
    
    if (isNaN(amount) || amount <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    
    if (amount > selectedTokenBalance) {
      setError(`You don't have enough ${formData.token}. Maximum available: ${selectedTokenBalance.toFixed(2)}`);
      return;
    }
    
    setAmount(amount);
    nextStep();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Select Token
        </label>
        <Select
          value={formData.token}
          onValueChange={(value) => handleTokenChange(value as 'USDC' | 'USDT')}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a token" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="USDC" className="flex items-center">
              <div className="flex items-center">
                <Image src={usdcIcon} alt="USDC" width={24} height={24} className="mr-2" />
                <span>USDC</span>
              </div>
            </SelectItem>
            <SelectItem value="USDT">
              <div className="flex items-center">
                <Image src={usdtIcon} alt="USDT" width={24} height={24} className="mr-2" />
                <span>USDT</span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Amount to withdraw
        </label>
        <div className="flex items-center gap-2">
          <Input
            type="text"
            placeholder="Enter amount"
            value={inputAmount}
            onChange={handleAmountChange}
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => setInputAmount(selectedTokenBalance.toString())}
            className="whitespace-nowrap"
          >
            Max
          </Button>
        </div>
        {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
        <p className="text-sm text-gray-500 mt-1">
          Available balance: {selectedTokenBalance.toFixed(2)} {formData.token}
        </p>
      </div>

      <div className="pt-4 flex justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={prevStep}
        >
          Back
        </Button>
        <Button type="submit">
          Continue
        </Button>
      </div>
    </form>
  );
};

export default AmountForm; 