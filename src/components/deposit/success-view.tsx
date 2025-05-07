'use client';

import { CheckCircle, Copy, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import usdcIcon from '@/public/usdc.svg';
import usdtIcon from '@/public/usdt-round.svg';
import { useState } from 'react';
import { useDepositStore } from '@/stores/use-deposit-store';

interface SuccessViewProps {
  onClose: () => void;
}

const SuccessView = ({ onClose }: SuccessViewProps) => {
  const { formData, transactionResult } = useDepositStore();
  const [copied, setCopied] = useState(false);
  
  const { recipient, amount } = formData;
  const transactionId = transactionResult?.transactionId || '';
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };
  
  const copyTransactionId = () => {
    navigator.clipboard.writeText(transactionId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  const formatTransactionId = (id: string) => {
    if (!id) return '';
    if (id.length <= 10) return id;
    return `${id.substring(0, 6)}...${id.substring(id.length - 4)}`;
  };
  
  const viewExplorer = () => {
    // Open a transaction explorer page - replace with your actual explorer URL
    window.open(`/dashboard/transactions/${transactionId}`, '_blank');
  };
  
  return (
    <div className="space-y-6 text-center">
      <div className="flex flex-col items-center">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
          <CheckCircle className="h-8 w-8 text-green-600" />
        </div>
        <h3 className="text-xl font-semibold">Deposit Successful!</h3>
        <p className="text-gray-500 mt-1">
          Your funds have been successfully deposited.
        </p>
      </div>
      
      <div className="rounded-lg border p-4 text-left">
        <div className="flex justify-between mb-4">
          <span className="text-sm text-gray-500">Amount</span>
          <div className="flex items-center">
            <Image 
              src={amount.token === 'USDC' ? usdcIcon : usdtIcon} 
              alt={amount.token} 
              width={20} 
              height={20} 
              className="mr-2"
            />
            <span className="font-medium">{formatCurrency(amount.value)} {amount.token}</span>
          </div>
        </div>
        
        <div className="flex justify-between mb-4">
          <span className="text-sm text-gray-500">Recipient</span>
          <span className="font-medium">{recipient.email}</span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-sm text-gray-500">Transaction ID</span>
          <div className="flex items-center">
            <span className="font-medium mr-2">
              {formatTransactionId(transactionId)}
            </span>
            <button 
              onClick={copyTransactionId}
              className="text-gray-500 hover:text-gray-700 focus:outline-none"
              title="Copy transaction ID"
            >
              {copied ? 
                <CheckCircle className="h-4 w-4 text-green-500" /> : 
                <Copy className="h-4 w-4" />
              }
            </button>
          </div>
        </div>
      </div>
      
      <div className="space-y-3 pt-2">
        <Button 
          onClick={viewExplorer}
          variant="outline" 
          className="w-full"
        >
          View Transaction <ExternalLink className="ml-2 h-4 w-4" />
        </Button>
        
        <Button 
          onClick={onClose} 
          className="w-full"
        >
          Close
        </Button>
      </div>
    </div>
  );
};

export default SuccessView; 