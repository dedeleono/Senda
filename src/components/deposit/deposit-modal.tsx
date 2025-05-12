'use client';

import { useState, useImperativeHandle, forwardRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import RecipientForm from './recipient-form';
import AmountForm from './amount-form';
import ConfirmationView from './confirmation-view';
import SuccessView from './success-view';
import { useDepositForm } from '@/stores/use-deposit-form';

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
    const [transactionData, setTransactionData] = useState<{
      signature: string;
      depositId: string;
    } | undefined>();
    
    const { 
      step, 
      formData,
      resetForm
    } = useDepositForm();

    const stepTitles = [
      'Recipient',
      'Amount & Token',
      'Confirmation',
      'Complete'
    ];

    const handleOpen = () => {
      resetForm();
      setTransactionData(undefined);
      setIsOpen(true);
    };
    
    const handleClose = () => {
      setIsOpen(false);
      if (onClose) onClose();
      
      setTimeout(() => {
        resetForm();
        setTransactionData(undefined);
      }, 300);
    };

    const handleTransactionComplete = (signature: string, depositId: string) => {
      setTransactionData({ signature, depositId });
      if (onComplete) {
        onComplete(signature, depositId);
      }
    };

    useImperativeHandle(ref, () => ({
      open: handleOpen,
      close: handleClose,
    }));

    return (
      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) handleClose()
          else setIsOpen(true)
        }}
      >
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden">
          <DialogHeader className="pt-6 px-6">
            <DialogTitle className="text-2xl font-bold">{stepTitles[step - 1]}</DialogTitle>
          </DialogHeader>

          <div className="w-full px-6 mt-2">
            <div className="flex justify-between mb-2">
              {stepTitles.map((title, index) => (
                <div
                  key={index}
                  className={`text-xs font-medium ${index + 1 === step ? 'text-primary' : 'text-gray-400'}`}
                >
                  {index !== 3 ? `Step ${index + 1}` : 'Confirmation'}
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
            {step === 3 && <ConfirmationView onComplete={handleTransactionComplete} />}
            {step === 4 && <SuccessView onClose={handleClose} transactionData={transactionData} />}
          </div>
        </DialogContent>
      </Dialog>
    )
  }
);

DepositModal.displayName = 'DepositModal';

export default DepositModal; 