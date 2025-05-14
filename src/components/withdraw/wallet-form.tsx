'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useWithdrawForm } from '@/stores/use-withdraw-form';
import { Wallet } from 'lucide-react';

const WalletForm = () => {
  const { formData, setWalletAddress, nextStep, prevStep } = useWithdrawForm();
  const [address, setAddress] = useState(formData.walletAddress || '');
  const [error, setError] = useState<string | null>(null);

  const validateSolanaAddress = (address: string) => {
    // Basic Solana address validation - should be 44 characters long and only alphanumeric
    return /^[A-Za-z0-9]{43,44}$/.test(address);
  };

  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setAddress(value);
    
    if (value && !validateSolanaAddress(value)) {
      setError('Please enter a valid Solana wallet address');
    } else {
      setError(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!address) {
      setError('Please enter a wallet address');
      return;
    }
    
    if (!validateSolanaAddress(address)) {
      setError('Please enter a valid Solana wallet address');
      return;
    }
    
    setWalletAddress(address);
    nextStep();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <div className="mb-6 flex flex-col items-center justify-center">
          <div className="bg-[#f6ead7] p-3 rounded-full mb-3">
            <Wallet className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-medium">Withdraw to Solana Wallet</h3>
          <p className="text-sm text-gray-500 text-center mt-1">
            Enter the Solana wallet address where you'd like to receive your funds.
          </p>
        </div>

        <label className="block text-sm font-medium text-gray-700 mb-1">
          Wallet Address
        </label>
        <Input
          type="text"
          placeholder="Enter Solana wallet address"
          value={address}
          onChange={handleAddressChange}
          className="w-full"
        />
        {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
        <p className="text-xs text-gray-500 mt-1">
          Make sure you enter a valid Solana wallet address that you control.
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

export default WalletForm; 