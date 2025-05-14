'use client';

import { useState, useImperativeHandle, forwardRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Wallet, CreditCard, ArrowRight } from 'lucide-react';

export type AddFundsModalRef = {
  open: () => void;
  close: () => void;
};

type AddFundsModalProps = {
  onClose?: () => void;
  onWalletQRSelected?: () => void;
};

const AddFundsModal = forwardRef<AddFundsModalRef, AddFundsModalProps>(
  ({ onClose, onWalletQRSelected }, ref) => {
    const [isOpen, setIsOpen] = useState(false);

    const handleOpen = () => {
      setIsOpen(true);
    };
    
    const handleClose = () => {
      setIsOpen(false);
      if (onClose) onClose();
    };

    const handleWalletQRSelected = () => {
      handleClose();
      if (onWalletQRSelected) onWalletQRSelected();
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
        <DialogContent className="sm:max-w-[500px] p-6 overflow-hidden">
          <DialogHeader className="pt-2 px-0">
            <DialogTitle className="text-2xl font-bold">Add Funds</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-6">
            <Button 
              onClick={handleWalletQRSelected}
              variant="outline" 
              className="w-full p-6 h-auto flex items-center justify-between hover:bg-gray-50 border-2 border-[#d7dfbe] hover:border-[#d7dfbe] transition-all duration-200"
            >
              <div className="flex items-center">
                <div className="w-12 h-12 bg-[#d7dfbe] rounded-full flex items-center justify-center mr-4">
                  <Wallet className="h-5 w-5 text-gray-700" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-lg">Deposit from Solana Wallet</h3>
                  <p className="text-sm text-gray-500">Transfer USDC or USDT from your Solana wallet</p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-gray-500" />
            </Button>

            <div className="relative">
              <Badge className="absolute -top-2 right-4 z-10 bg-gray-200 text-gray-600 text-[10px] rounded-sm">
                coming soon
              </Badge>
              <div className="w-full p-6 h-auto flex items-center justify-between bg-gray-50 border-2 border-gray-200 rounded-md relative opacity-70 cursor-not-allowed">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-[#f6ead7] rounded-full flex items-center justify-center mr-4">
                    <CreditCard className="h-5 w-5 text-gray-700" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-lg">Use Credit or Debit Card</h3>
                    <p className="text-sm text-gray-500">Pay with your credit or debit card</p>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-gray-300" />
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }
);

AddFundsModal.displayName = 'AddFundsModal';

export default AddFundsModal; 