'use client';

import { useState, useImperativeHandle, forwardRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { useWithdrawForm } from '@/stores/use-withdraw-form';
import MethodSelect from './method-select';
import AmountForm from './amount-form';
import WalletForm from './wallet-form';
import BankForm from './bank-form';
import ConfirmationView from './confirmation-view';
import SuccessView from './success-view';

export type WithdrawModalRef = {
  open: () => void;
  close: () => void;
};

type WithdrawModalProps = {
  onClose?: () => void;
  onComplete?: (transactionId: string) => void;
};

const WithdrawModal = forwardRef<WithdrawModalRef, WithdrawModalProps>(
  ({ onClose, onComplete }, ref) => {
    const [isOpen, setIsOpen] = useState(false);
    const [transactionId, setTransactionId] = useState<string | undefined>();
    
    const { 
      step, 
      formData,
      resetForm
    } = useWithdrawForm();

    const stepTitles = [
      'Withdrawal Method',
      'Amount & Token',
      formData.method === 'wallet' ? 'Wallet Details' : 'Bank Account',
      'Confirmation',
      'Complete'
    ];

    const handleOpen = () => {
      resetForm();
      setTransactionId(undefined);
      setIsOpen(true);
    };
    
    const handleClose = () => {
      setIsOpen(false);
      if (onClose) onClose();
      
      setTimeout(() => {
        resetForm();
        setTransactionId(undefined);
      }, 300);
    };

    const handleTransactionComplete = (id: string) => {
      setTransactionId(id);
      if (onComplete) {
        onComplete(id);
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
          if (!open) handleClose();
          else setIsOpen(true);
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
                  {index !== 4 ? `Step ${index + 1}` : 'Done'}
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
            {step === 1 && <MethodSelect />}
            {step === 2 && <AmountForm />}
            {step === 3 && formData.method === 'wallet' && <WalletForm />}
            {step === 3 && formData.method === 'bank' && <BankForm />}
            {step === 4 && <ConfirmationView onComplete={handleTransactionComplete} />}
            {step === 5 && <SuccessView onClose={handleClose} transactionId={transactionId} />}
          </div>
        </DialogContent>
      </Dialog>
    );
  }
);

WithdrawModal.displayName = 'WithdrawModal';

export default WithdrawModal; 