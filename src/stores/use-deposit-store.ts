'use client';

import { create } from 'zustand';
import { toast } from 'sonner';
import { useSendaProgram } from './use-senda-program';
import { prisma } from '@/lib/db';

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
  submitDeposit: (mutateAsync: (input: any) => Promise<any>) => Promise<any>;
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
    
    try {
      set({ isSubmitting: true });
      console.log('Starting deposit submission process');
      
      if (!formData.recipient.email || formData.amount.value <= 0) {
        throw new Error('Please fill out all required fields');
      }
      
      // Get initial transaction data from server first
      console.log('Getting sender info from server first');
      const startResult = await mutateAsync({
        recipientEmail: formData.recipient.email,
        amount: formData.amount.value,
        token: formData.amount.token,
        authorization: formData.authorization,
      });
      console.log('Server transaction started:', startResult);
      
      // Get Senda program state safely
      const sendaProgram = useSendaProgram.getState();
      console.log('Got Senda program state:', { 
        programInitialized: !!sendaProgram.program,
        hasWallet: !!(sendaProgram.program?.provider?.wallet),
        hasPublicKey: !!(sendaProgram.program?.provider?.publicKey)
      });
      
      try {
        // Only create an escrow if the server indicates it doesn't exist yet
        if (!startResult.escrowExists) {
          console.log('Escrow does not exist, creating new escrow');
          
          if (!sendaProgram.program) {
            console.log('Program is null during escrow creation');
            throw new Error('Program not initialized');
          }
          
          const providerExists = !!sendaProgram.program.provider;
          let publicKeyString = 'none';
          let publicKeyMatches = false;
          
          if (providerExists && sendaProgram.program.provider.publicKey) {
            publicKeyString = sendaProgram.program.provider.publicKey.toString();
            publicKeyMatches = (publicKeyString === startResult.senderPublicKey);
          }
          
          console.log('Escrow wallet check:', {
            hasProvider: providerExists,
            hasWallet: providerExists && !!sendaProgram.program.provider.wallet,
            publicKey: publicKeyString,
            expectedSender: startResult.senderPublicKey,
            keysMatch: publicKeyMatches,
          });

          if (!providerExists || 
              !sendaProgram.program.provider.publicKey || 
              !sendaProgram.program.provider.wallet ||
              !publicKeyMatches) {
            
            let errorMessage = 'Please connect your wallet via the "Connect Wallet" button in the header';
            let toastDescription = 'Please connect your wallet to create deposits';
            
            // More specific message if wallet is connected but wrong account
            if (providerExists && sendaProgram.program.provider.publicKey &&
                !publicKeyMatches) {
              errorMessage = `Connected wallet (${publicKeyString.substring(0,8)}...) doesn't match expected sender (${startResult.senderPublicKey.substring(0,8)}...)`;
              toastDescription = 'Please connect the correct wallet account';
            }
            
            console.log('Need a real wallet to create an escrow:', errorMessage);
            
            toast.error('Wallet connection required', {
              description: toastDescription
            });
            
            set({
              transactionResult: {
                success: false,
                error: 'Wallet connection required',
                message: errorMessage,
              },
              step: 1,
            });
            
            throw new Error('Real wallet connection required for creating escrows');
          }
          
          const escrowResult = await sendaProgram.initEscrow({
            senderPublicKey: startResult.senderPublicKey,
            receiverPublicKey: startResult.receiverPublicKey,
          });
          console.log('Escrow creation result:', escrowResult);

          if (!escrowResult.success) {
            // If we get an error that looks like the escrow already exists, we can continue
            // by refetching the escrow info from the server
            if (escrowResult.error?.toString().includes('already exists') || 
                escrowResult.error?.toString().includes('already initialized')) {
              
              console.log('Escrow appears to already exist despite server saying it does not, continuing with deposit...');
              
              // Get updated escrow info from server
              const updatedResult = await mutateAsync({
                recipientEmail: formData.recipient.email,
                amount: formData.amount.value,
                token: formData.amount.token,
                authorization: formData.authorization,
                forceCheckEscrow: true,
              });
              
              // Update our local reference
              if (updatedResult.escrowExists && updatedResult.escrowPublicKey) {
                console.log('Found existing escrow:', updatedResult.escrowPublicKey);
                startResult.escrowExists = true;
                startResult.escrowPublicKey = updatedResult.escrowPublicKey;
              } else {
                // If we still can't find the escrow, we have to fail
                console.error('Failed to create escrow and cannot find existing one:', escrowResult.error);
                throw new Error(escrowResult.error?.toString() || 'Failed to create or find escrow');
              }
            } else {
              console.error('Failed to create escrow:', escrowResult.error);
              throw new Error(escrowResult.error?.toString() || 'Failed to create escrow');
            }
          } else {
            console.log('Creating escrow in database');
            try {
              // Only create escrow in database if it doesn't exist already
              await prisma.escrow.create({
                data: {
                  id: startResult.escrowPublicKey,
                  senderPublicKey: startResult.senderPublicKey,
                  receiverPublicKey: startResult.receiverPublicKey,
                  depositedUsdc: 0,
                  depositedUsdt: 0,
                  depositCount: 0,
                  state: "Active",
                },
              });
              console.log('Escrow created in database');
            } catch (dbError) {
              // If there's an error in DB creation due to duplicate, we can continue
              console.log('Error creating escrow in database, may already exist:', dbError);
            }
          }
        } else {
          console.log('Escrow already exists, proceeding with deposit');
        }

        // Make sure we have an escrow public key before continuing
        if (!startResult.escrowPublicKey) {
          throw new Error('Missing escrow public key - cannot proceed with deposit');
        }

        try {
          console.log('Creating deposit with params:', {
            escrowPublicKey: startResult.escrowPublicKey,
            token: formData.amount.token.toLowerCase(),
            authorization: formData.authorization,
            amount: formData.amount.value,
          });
          
          // Use safe type-checking first to avoid null errors
          if (!sendaProgram.program) {
            console.log('Program is null during deposit creation');
            throw new Error('Program not initialized');
          }
          
          // Check wallet details for deposit
          const depProviderExists = !!sendaProgram.program.provider;
          let depPublicKeyString = 'none';
          let depPublicKeyMatches = false;
          
          if (depProviderExists && sendaProgram.program.provider.publicKey) {
            depPublicKeyString = sendaProgram.program.provider.publicKey.toString();
            depPublicKeyMatches = (depPublicKeyString === startResult.senderPublicKey);
          }
          
          console.log('Deposit wallet check:', {
            hasProvider: depProviderExists,
            hasWallet: depProviderExists && !!sendaProgram.program.provider.wallet,
            publicKey: depPublicKeyString,
            expectedSender: startResult.senderPublicKey,
            keysMatch: depPublicKeyMatches,
          });

          if (!depProviderExists || 
              !sendaProgram.program.provider.publicKey || 
              !sendaProgram.program.provider.wallet ||
              !depPublicKeyMatches) {
            
            let errorMessage = 'Please connect your wallet via the "Connect Wallet" button in the header';
            let toastDescription = 'Please connect your wallet to create deposits';
            
            // More specific message if wallet is connected but wrong account
            if (depProviderExists && sendaProgram.program.provider.publicKey && 
                !depPublicKeyMatches) {
              errorMessage = `Connected wallet (${depPublicKeyString.substring(0,8)}...) doesn't match expected sender (${startResult.senderPublicKey.substring(0,8)}...)`;
              toastDescription = 'Please connect the correct wallet account';
            }
            
            console.log('Need a real wallet to create a deposit:', errorMessage);
            
            toast.error('Wallet connection required', {
              description: toastDescription
            });
            
            set({
              transactionResult: {
                success: false,
                error: 'Wallet connection required',
                message: errorMessage,
              },
              step: 1,
            });
            
            throw new Error('Real wallet connection required for creating deposits');
          }
          
          const depositResult = await sendaProgram.createDeposit({
            escrowPublicKey: startResult.escrowPublicKey,
            depositorPublicKey: startResult.senderPublicKey,
            counterpartyPublicKey: startResult.receiverPublicKey,
            stable: formData.amount.token.toLowerCase() as 'usdc' | 'usdt',
            authorization: formData.authorization,
            amount: formData.amount.value,
          });
          
          console.log('Deposit creation result:', depositResult);

          if (!depositResult.success) {
            console.error('Deposit failed:', depositResult.error);
            throw new Error(depositResult.error?.toString() || 'Failed to create deposit');
          }

          console.log('Finalizing transaction with server');
          const dbResult = await mutateAsync({
            recipientEmail: formData.recipient.email,
            amount: formData.amount.value,
            token: formData.amount.token,
            authorization: formData.authorization,
            escrowPublicKey: startResult.escrowPublicKey,
            depositSignature: depositResult.signature,
          });
          console.log('Transaction finalized:', dbResult);
          
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
          
          return dbResult;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.toString() : String(error);
          
          // First check for escrow account related errors
          if (errorMessage.includes('Account does not exist') || 
              errorMessage.includes('Invalid account discriminator') ||
              errorMessage.includes('Escrow not found')) {
            console.error('Escrow not initialized error:', error);
            
            toast.error('Please try again. The escrow needs to be initialized first.');
            
            set({
              transactionResult: {
                success: false,
                error: 'Please try again. The escrow needs to be initialized first.',
                message: 'The escrow account was not found. This is usually fixed by trying again.',
              },
            });
          } 
          // Check for program initialization or factory errors as a fallback
          else if (errorMessage.includes('Factory not found') || errorMessage.includes('Program not initialized')) {
            console.error('Program initialization error:', error);
            
            toast.error('An error occurred with the Solana program. Please contact support.');
            
            set({
              transactionResult: {
                success: false,
                error: 'An error occurred with the Solana program. Please contact support.',
                message: 'There was an issue with the Solana program that needs administrator intervention.',
              },
            });
          } else {
            toast.error('Failed to create deposit: ' + errorMessage);
            set({
              transactionResult: {
                success: false,
                error: errorMessage,
              },
            });
          }
          throw error;
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes('Recipient not found')) {
          const inviteResult = await mutateAsync({
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
          
          return inviteResult;
        }
        
        throw error;
      }
    } catch (error) {
      console.error('Error creating deposit:', error);
      
      set({
        transactionResult: {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred',
        },
      });
      
      toast.error('Failed to create deposit');
      
      throw error;
    } finally {
      set({ isSubmitting: false });
    }
  },
})); 