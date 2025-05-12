'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ArrowRight, ArrowLeft, DollarSign, Info } from 'lucide-react';
import Image from 'next/image';
import usdcIcon from '@/public/usdc.svg';
import usdtIcon from '@/public/usdt-round.svg';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useDepositForm } from '@/stores/use-deposit-form';
import type { TokenType, AuthorizationType } from '@/types/transaction';

const AmountForm = () => {
  const { formData, updateFormData, nextStep, prevStep } = useDepositForm();
  
  const [amount, setAmount] = useState(formData.amount.value.toString());
  const [token, setToken] = useState<TokenType>(formData.amount.token);
  const [errorMessage, setErrorMessage] = useState('');
  
  useEffect(() => {
    // Update local state when formData changes (for example when form is reset)
    setAmount(formData.amount.value.toString() || '');
    setToken(formData.amount.token);
  }, [formData.amount]);
  
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    // Only allow numbers and decimals
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setAmount(value);
      setErrorMessage('');
    }
  };
  
  const handleTokenChange = (value: TokenType) => {
    setToken(value);
    updateFormData({
      amount: {
        ...formData.amount,
        token: value,
      },
    });
  };
  
  const handleAuthorizationChange = (value: AuthorizationType) => {
    updateFormData({
      authorization: value,
    });
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate amount
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setErrorMessage('Please enter a valid amount greater than 0');
      return;
    }
    
    // Update form data with validated amount
    updateFormData({
      amount: {
        value: numAmount,
        token,
      },
    });
    
    nextStep();
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <Label htmlFor="amount">Amount</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-gray-400 cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs text-sm">
                  Enter the amount you want to send. Make sure you have enough funds plus gas fees.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        
        <div className="relative">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <DollarSign className="h-5 w-5 text-gray-400" />
          </div>
          <Input
            id="amount"
            type="text"
            placeholder="0.00"
            className={`pl-10 ${errorMessage ? 'border-red-500' : ''}`}
            value={amount}
            onChange={handleAmountChange}
          />
        </div>
        
        {errorMessage && (
          <p className="text-sm text-red-500">{errorMessage}</p>
        )}
      </div>
      
      <div className="space-y-2">
        <Label>Token</Label>
        <RadioGroup 
          className="flex space-x-2" 
          value={token} 
          onValueChange={(value) => handleTokenChange(value as TokenType)}
        >
          <div className={`flex-1 border rounded-md p-3 cursor-pointer ${token === 'USDC' ? 'border-primary bg-primary/5' : 'border-gray-200'}`}>
            <RadioGroupItem value="USDC" id="usdc" className="sr-only" />
            <Label htmlFor="usdc" className="flex items-center justify-center cursor-pointer">
              <Image src={usdcIcon} alt="USDC" width={24} height={24} className="mr-2" />
              <span>USDC</span>
            </Label>
          </div>
          
          <div className={`flex-1 border rounded-md p-3 cursor-pointer ${token === 'USDT' ? 'border-primary bg-primary/5' : 'border-gray-200'}`}>
            <RadioGroupItem value="USDT" id="usdt" className="sr-only" />
            <Label htmlFor="usdt" className="flex items-center justify-center cursor-pointer">
              <Image src={usdtIcon} alt="USDT" width={24} height={24} className="mr-2" />
              <span>USDT</span>
            </Label>
          </div>
        </RadioGroup>
      </div>
      
      <div className="space-y-2">
        <Label>Authorization Required</Label>
        <RadioGroup 
          className="space-y-2" 
          value={formData.authorization} 
          onValueChange={(value) => handleAuthorizationChange(value as AuthorizationType)}
        >
          <div className={`border rounded-md p-3 cursor-pointer ${formData.authorization === 'sender' ? 'border-primary bg-primary/5' : 'border-gray-200'}`}>
            <RadioGroupItem value="sender" id="sender" className="sr-only" />
            <Label htmlFor="sender" className="flex flex-col cursor-pointer">
              <span className="font-medium">Sender Only</span>
              <span className="text-xs text-gray-500">Only you can authorize the transaction</span>
            </Label>
          </div>
          
          <div className={`border rounded-md p-3 cursor-pointer ${formData.authorization === 'receiver' ? 'border-primary bg-primary/5' : 'border-gray-200'}`}>
            <RadioGroupItem value="receiver" id="receiver" className="sr-only" />
            <Label htmlFor="receiver" className="flex flex-col cursor-pointer">
              <span className="font-medium">Recipient Only</span>
              <span className="text-xs text-gray-500">Only the recipient can authorize the transaction</span>
            </Label>
          </div>
          
          <div className={`border rounded-md p-3 cursor-pointer ${formData.authorization === 'both' ? 'border-primary bg-primary/5' : 'border-gray-200'}`}>
            <RadioGroupItem value="both" id="both" className="sr-only" />
            <Label htmlFor="both" className="flex flex-col cursor-pointer">
              <span className="font-medium">Both Required</span>
              <span className="text-xs text-gray-500">Both you and the recipient must authorize the transaction</span>
            </Label>
          </div>
        </RadioGroup>
      </div>
      
      <div className="flex justify-between pt-4">
        <Button 
          type="button" 
          variant="outline"
          onClick={prevStep}
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        
        <Button type="submit">
          Next <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </form>
  );
};

export default AmountForm; 