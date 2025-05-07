'use client';

import { useState, useImperativeHandle, forwardRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import RecipientForm from './recipient-form';
import AmountForm from './amount-form';
import ConfirmationView from './confirmation-view';
import SuccessView from './success-view';
import { useDepositStore } from '@/stores/use-deposit-store';

export type DepositModalRef = {
  open: () => void;
  close: () => void;
};

type DepositModalProps = {
  onClose?: () => void;
  onComplete?: (transactionId: string, depositId: string) => void;
};

const DepositModal = forwardRef<DepositModalRef, DepositModalProps>(
  ({ onClose, onComplete }, ref) => {
    const [isOpen, setIsOpen] = useState(false);
    
    // Access deposit store
    const { 
      step, 
      formData,
      transactionResult,
      resetForm
    } = useDepositStore();

    // Track transaction result for callback
    useEffect(() => {
      if (transactionResult?.success && 
          transactionResult.transactionId && 
          transactionResult.depositId && 
          onComplete) {
        onComplete(transactionResult.transactionId, transactionResult.depositId);
      }
    }, [transactionResult, onComplete]);

    const stepTitles = [
      'Recipient',
      'Amount & Token',
      'Confirmation',
      'Complete'
    ];

    const handleOpen = () => {
      resetForm();
      setIsOpen(true);
    };
    
    const handleClose = () => {
      setIsOpen(false);
      if (onClose) onClose();
      
      // Reset state when modal is closed with a small delay
      // so the animation can complete
      setTimeout(() => {
        resetForm();
      }, 300);
    };

    // Expose methods to parent component via ref
    useImperativeHandle(ref, () => ({
      open: handleOpen,
      close: handleClose,
    }));

    return (
      <Dialog open={isOpen} onOpenChange={(open) => {
        if (!open) handleClose();
        else setIsOpen(true);
      }}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden">
          <DialogHeader className="pt-6 px-6">
            <DialogTitle className="text-2xl font-bold">
              {stepTitles[step - 1]}
            </DialogTitle>
          </DialogHeader>
          
          {/* Stepper */}
          <div className="w-full px-6 mt-2">
            <div className="flex justify-between mb-2">
              {stepTitles.map((title, index) => (
                <div 
                  key={index}
                  className={`text-xs font-medium ${index + 1 === step ? 'text-primary' : 'text-gray-400'}`}
                >
                  Step {index + 1}
                </div>
              ))}
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#d7dfbe] transition-all duration-300 ease-in-out" 
                style={{ width: `${(step / stepTitles.length) * 100}%` }}
              />
            </div>
          </div>
          
          <Separator className="my-4" />
          
          <div className="px-6 pb-6">
            {step === 1 && <RecipientForm />}
            {step === 2 && <AmountForm />}
            {step === 3 && <ConfirmationView />}
            {step === 4 && <SuccessView onClose={handleClose} />}
          </div>
        </DialogContent>
      </Dialog>
    );
  }
);

DepositModal.displayName = 'DepositModal';

export default DepositModal; 