'use client';

import { create } from 'zustand';
import { toast } from 'sonner';
import { PublicKey } from '@solana/web3.js';
import { useSendaProgram } from './use-senda-program';

export type RecipientInfo = {
  email: string;
  walletAddress?: string;
  exists: boolean;
};

export type AmountInfo = {
  value: number;
  token: 'USDC' | 'USDT';
};

export type DepositFormData = {
  recipient: RecipientInfo;
  amount: AmountInfo;
  authorization: 'sender' | 'receiver' | 'both';
};

export type TransactionResult = {
  success: boolean;
  transactionId?: string;
  depositId?: string;
  signature?: string;
  error?: string;
  message?: string;
};

const initialFormData: DepositFormData = {
  recipient: {
    email: '',
    exists: false,
  },
  amount: {
    value: 0,
    token: 'USDC',
  },
  authorization: 'sender',
};

interface ServerStartResult {
  recipientNotFound: boolean;
  escrowExists: boolean;
  escrowPublicKey: string;
  senderPublicKey: string;
  receiverPublicKey: string;
}

interface ServerFinalResult extends ServerStartResult {
  transactionId: string;
  depositId: string;
}

interface DepositStore {
  formData: DepositFormData;
  step: number;
  isSubmitting: boolean;
  transactionResult: TransactionResult | null;
  
  updateFormData: (data: Partial<DepositFormData>) => void;
  nextStep: () => void;
  prevStep: () => void;
  setStep: (step: number) => void;
  resetForm: () => void;
  submitDeposit: (mutateAsync: (input: any) => Promise<ServerStartResult | ServerFinalResult>) => Promise<void>;
  setTransactionResult: (result: TransactionResult) => void;
}

export const useDepositStore = create<DepositStore>((set, get) => ({
  formData: initialFormData,
  step: 1,
  isSubmitting: false,
  transactionResult: null,
  
  updateFormData: (data) => {
    set((state) => ({
      formData: {
        ...state.formData,
        ...data,
      },
    }));
  },
  
  nextStep: () => set((state) => ({ step: Math.min(state.step + 1, 4) })),
  prevStep: () => set((state) => ({ step: Math.max(state.step - 1, 1) })),
  setStep: (step) => set({ step }),
  
  resetForm: () => set({
    formData: initialFormData,
    step: 1,
    transactionResult: null,
  }),
  
  setTransactionResult: (result) => set({ transactionResult: result }),
  
  submitDeposit: async (mutateAsync) => {
    const { formData } = get();
    const sendaProgram = useSendaProgram.getState();
    
    try {
      set({ isSubmitting: true });
      
      if (!formData.recipient.email || formData.amount.value <= 0) {
        throw new Error('Please fill out all required fields');
      }
      
      // Start the deposit process with the server
      const startResult = await mutateAsync({
        recipientEmail: formData.recipient.email,
        amount: formData.amount.value,
        token: formData.amount.token,
        authorization: formData.authorization,
      }) as ServerStartResult;

      // Handle new recipient flow
      if (startResult.recipientNotFound) {
        await mutateAsync({
          recipientEmail: formData.recipient.email,
          amount: formData.amount.value,
          token: formData.amount.token,
        });
        
        set({
          transactionResult: {
            success: true,
            message: 'Invitation sent successfully',
          },
          step: 4,
        });
        
        toast.success('Invitation sent successfully');
        return;
      }

      // Create escrow if needed
      if (!startResult.escrowExists) {
        const escrowResult = await sendaProgram.initEscrow({
          senderPublicKey: startResult.senderPublicKey,
          receiverPublicKey: startResult.receiverPublicKey,
          seed: 0
        });

        if (!escrowResult.success) {
          throw new Error(escrowResult.error?.toString() || 'Failed to create escrow');
        }
      }

      // Create the deposit
      const depositResult = await sendaProgram.createDeposit({
        escrowPublicKey: startResult.escrowPublicKey,
        depositorPublicKey: startResult.senderPublicKey,
        counterpartyPublicKey: startResult.receiverPublicKey,
        stable: formData.amount.token.toLowerCase() as 'usdc' | 'usdt',
        authorization: formData.authorization,
        amount: formData.amount.value,
      });

      if (!depositResult.success) {
        throw new Error(depositResult.error?.toString() || 'Failed to create deposit');
      }

      // Finalize the transaction
      const dbResult = await mutateAsync({
        recipientEmail: formData.recipient.email,
        amount: formData.amount.value,
        token: formData.amount.token,
        authorization: formData.authorization,
        escrowPublicKey: startResult.escrowPublicKey,
        depositSignature: depositResult.signature,
      }) as ServerFinalResult;

      set({
        transactionResult: {
          success: true,
          transactionId: dbResult.transactionId,
          depositId: dbResult.depositId,
          signature: depositResult.signature,
        },
        step: 4,
      });
      
      toast.success('Deposit created successfully');

    } catch (error) {
      console.error('Error creating deposit:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (errorMessage.includes('Account does not exist') || 
          errorMessage.includes('Invalid account discriminator') ||
          errorMessage.includes('Escrow not found')) {
        toast.error('Please try again. The escrow needs to be initialized first.');
      } 
      else if (errorMessage.includes('Factory not found') || 
               errorMessage.includes('Program not initialized')) {
        toast.error('An error occurred with the Solana program. Please contact support.');
      } 
      else {
        toast.error('Failed to create deposit: ' + errorMessage);
      }
      
      set({
        transactionResult: {
          success: false,
          error: errorMessage,
        },
      });
      
      throw error;
    } finally {
      set({ isSubmitting: false });
    }
  },
})); 