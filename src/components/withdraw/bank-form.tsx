'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useWithdrawForm } from '@/stores/use-withdraw-form';
import { CreditCard } from 'lucide-react';

const BankForm = () => {
  const { formData, setBankInfo, nextStep, prevStep } = useWithdrawForm();
  const [bankInfo, setBankInfoLocal] = useState({
    accountName: formData.bankInfo?.accountName || '',
    accountNumber: formData.bankInfo?.accountNumber || '',
    routingNumber: formData.bankInfo?.routingNumber || '',
    bankName: formData.bankInfo?.bankName || '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleInputChange = (field: keyof typeof bankInfo, value: string) => {
    setBankInfoLocal({ ...bankInfo, [field]: value });
    
    // Clear error for this field if value is entered
    if (value) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!bankInfo.accountName.trim()) {
      newErrors.accountName = 'Account name is required';
    }
    
    if (!bankInfo.accountNumber.trim()) {
      newErrors.accountNumber = 'Account number is required';
    } else if (!/^\d+$/.test(bankInfo.accountNumber)) {
      newErrors.accountNumber = 'Account number must only contain digits';
    }
    
    if (!bankInfo.routingNumber.trim()) {
      newErrors.routingNumber = 'Routing number is required';
    } else if (!/^\d{9}$/.test(bankInfo.routingNumber)) {
      newErrors.routingNumber = 'Routing number must be 9 digits';
    }
    
    if (!bankInfo.bankName.trim()) {
      newErrors.bankName = 'Bank name is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validateForm()) {
      setBankInfo(bankInfo);
      nextStep();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <div className="mb-6 flex flex-col items-center justify-center">
          <div className="bg-[#f6ead7] p-3 rounded-full mb-3">
            <CreditCard className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-medium">Withdraw to Bank Account</h3>
          <p className="text-sm text-gray-500 text-center mt-1">
            Enter your bank account details for withdrawal.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Account Holder Name
            </label>
            <Input
              type="text"
              placeholder="Your full name"
              value={bankInfo.accountName}
              onChange={(e) => handleInputChange('accountName', e.target.value)}
              className="w-full"
            />
            {errors.accountName && (
              <p className="text-sm text-red-500 mt-1">{errors.accountName}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Bank Name
            </label>
            <Input
              type="text"
              placeholder="Bank of America, Chase, etc."
              value={bankInfo.bankName}
              onChange={(e) => handleInputChange('bankName', e.target.value)}
              className="w-full"
            />
            {errors.bankName && (
              <p className="text-sm text-red-500 mt-1">{errors.bankName}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Account Number
            </label>
            <Input
              type="text"
              placeholder="Enter account number"
              value={bankInfo.accountNumber}
              onChange={(e) => handleInputChange('accountNumber', e.target.value)}
              className="w-full"
            />
            {errors.accountNumber && (
              <p className="text-sm text-red-500 mt-1">{errors.accountNumber}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Routing Number
            </label>
            <Input
              type="text"
              placeholder="9-digit routing number"
              value={bankInfo.routingNumber}
              onChange={(e) => handleInputChange('routingNumber', e.target.value)}
              className="w-full"
            />
            {errors.routingNumber && (
              <p className="text-sm text-red-500 mt-1">{errors.routingNumber}</p>
            )}
          </div>
        </div>
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

export default BankForm; 