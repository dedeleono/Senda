'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Check, Loader2, AlertCircle, Info, ArrowRight } from 'lucide-react';
import { useDepositForm } from '@/stores/use-deposit-form';
import { trpc } from '@/app/_trpc/client';
import { useDebounce } from '@/hooks/use-debounce';
import type { UserRole } from '@prisma/client';

const RecipientForm = () => {
  const [email, setEmail] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isValid, setIsValid] = useState(false);
  
  // Debounce the email value
  const debouncedEmail = useDebounce(email, 700);
  
  // Get user query with proper enabled state
  const { refetch: refetchUser } = trpc.userRouter.getUserByEmail.useQuery(
    { email: debouncedEmail },
    { 
      enabled: false,
      retry: false,
      staleTime: 0,
      gcTime: 0
    }
  );
  
  // Access deposit store
  const { 
    formData, 
    updateFormData, 
    nextStep
  } = useDepositForm();
  
  // Initialize with any existing data
  useEffect(() => {
    if (formData.recipient.email) {
      setEmail(formData.recipient.email);
      setIsValid(true);
    }
  }, [formData.recipient.email]);
  
  const validateEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  // Handle all validation when debounced email changes
  useEffect(() => {
    let isSubscribed = true;

    const validate = async () => {
      if (!debouncedEmail) {
        setErrorMessage('');
        setIsValid(false);
        return;
      }

      if (!validateEmail(debouncedEmail)) {
        setErrorMessage('Please enter a valid email address');
        setIsValid(false);
        return;
      }

      setIsValidating(true);
      
      try {
        const result = await refetchUser();
        
        if (!isSubscribed) return;

        const exists = result.data?.role === "GUEST" as UserRole;
        
        updateFormData({
          recipient: {
            email: debouncedEmail,
            exists,
          },
        });
        
        setIsValid(true);
        setErrorMessage('');
      } catch (error) {
        if (!isSubscribed) return;
        console.error('Error validating email:', error);
        setErrorMessage('Failed to validate email. Please try again.');
        setIsValid(false);
      } finally {
        if (isSubscribed) {
          setIsValidating(false);
        }
      }
    };

    validate();

    return () => {
      isSubscribed = false;
    };
  }, [debouncedEmail, refetchUser, updateFormData]);
  
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEmail = e.target.value;
    setEmail(newEmail);
    setIsValid(false);
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setErrorMessage('Email is required');
      return;
    }
    if (!isValid) return;
    nextStep();
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="email">Recipient Email</Label>
        <div className="flex mt-1.5">
          <div className="relative flex-1">
            <Input
              id="email"
              type="email"
              placeholder="someone@example.com"
              className={`pl-10 ${errorMessage ? 'border-red-500' : ''}`}
              value={email}
              onChange={handleEmailChange}
              disabled={isValidating}
            />
            <Mail className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            {isValid && <Check className="absolute right-3 top-2.5 h-5 w-5 text-green-500" />}
            {isValidating && <Loader2 className="absolute right-3 top-2.5 h-5 w-5 animate-spin" />}
          </div>
        </div>
        
        {errorMessage && (
          <div className="flex items-center mt-1 text-sm text-red-500">
            <AlertCircle className="h-4 w-4 mr-1" />
            {errorMessage}
          </div>
        )}
        
        {isValid && formData.recipient.exists && (
          <div className="flex items-center mt-1 text-sm text-green-600">
            <Check className="h-4 w-4 mr-1" />
            User already exists on Senda
          </div>
        )}
        
        {isValid && !formData.recipient.exists && (
          <div className="flex items-center mt-1 text-sm text-blue-600">
            <Info className="h-4 w-4 mr-1" />
            New user will be invited to Senda
          </div>
        )}
      </div>
      
      <div className="flex justify-end pt-4">
        <Button 
          type="submit" 
          className="flex items-center" 
          disabled={!isValid || isValidating}
        >
          Next <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </form>
  );
};

export default RecipientForm; 