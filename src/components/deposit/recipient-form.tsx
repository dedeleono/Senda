'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowRight, Mail, Check, Loader2, AlertCircle, Info } from 'lucide-react';
import { useDepositStore } from '@/stores/use-deposit-store';
import { trpc } from '@/app/_trpc/client';

const RecipientForm = () => {
  const [email, setEmail] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isValid, setIsValid] = useState(false);
  
  // Get user query
  const userQuery = trpc.userRouter.getUserByEmail.useQuery(
    { email: email },
    { enabled: false }
  );
  
  // Access deposit store
  const { 
    formData, 
    updateFormData, 
    nextStep
  } = useDepositStore();
  
  // Initialize with any existing data
  useEffect(() => {
    if (formData.recipient.email) {
      setEmail(formData.recipient.email);
      setIsValid(true);
    }
  }, [formData.recipient.email]);
  
  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };
  
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEmail = e.target.value;
    setEmail(newEmail);
    setErrorMessage('');
    setIsValid(false);
  };
  
  const handleValidate = async () => {
    if (!email) {
      setErrorMessage('Email is required');
      return;
    }
    
    if (!validateEmail(email)) {
      setErrorMessage('Please enter a valid email address');
      return;
    }
    
    setIsValidating(true);
    
    try {
      // Check if recipient exists using the query
      const result = await userQuery.refetch();
      const exists = !!result.data?.id;
      
      // Update form data
      updateFormData({
        recipient: {
          email,
          exists,
        },
      });
      
      setIsValid(true);
    } catch (error) {
      console.error('Error validating email:', error);
      setErrorMessage('Failed to validate email. Please try again.');
    } finally {
      setIsValidating(false);
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isValid) {
      await handleValidate();
      if (!isValid) return;
    }
    
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
              disabled={isValidating || isValid}
            />
            <Mail className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            {isValid && <Check className="absolute right-3 top-2.5 h-5 w-5 text-green-500" />}
          </div>
          
          {!isValid && (
            <Button 
              type="button" 
              variant="outline" 
              className="ml-2" 
              onClick={handleValidate}
              disabled={isValidating || !email}
            >
              {isValidating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Validate'}
            </Button>
          )}
          
          {isValid && (
            <Button 
              type="button" 
              variant="outline" 
              className="ml-2" 
              onClick={() => {
                setIsValid(false);
                setEmail('');
                updateFormData({
                  recipient: {
                    email: '',
                    exists: false,
                  },
                });
              }}
            >
              Change
            </Button>
          )}
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
          disabled={!isValid}
        >
          Next <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </form>
  );
};

export default RecipientForm; 