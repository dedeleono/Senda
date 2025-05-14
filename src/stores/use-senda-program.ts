import { create } from 'zustand';
import { PublicKey } from '@solana/web3.js';
import { TransactionResult } from '@/lib/utils/solana-transaction';
import { FactoryStats, EscrowStats, InitEscrowParams, CancelParams, ReleaseParams, TransferSplParams } from '@/types/senda-program';
import { persist } from 'zustand/middleware';
import { prisma } from '@/lib/db';
import { CreateDepositResponse } from '@/types/transaction';
import { SignatureType } from '@/components/transactions/transaction-card';

interface SendaProgramState {
  isProcessing: boolean;
  lastError: Error | null;
  lastInitialization: number | null;
  transactionCount: number;
}

interface EscrowData {
  id: string;
  senderPublicKey: string;
  receiverPublicKey: string;
  depositedUsdc: number;
  depositedUsdt: number;
  depositCount: number;
  state: string;
}

interface DepositInput {
  userId: string;
  depositor: string;
  recipientEmail: string;
  stable: 'usdc' | 'usdt';
  authorization: SignatureType;
  amount: number;
}

interface TransferSplResponse {
  success: boolean;
  signature?: string;
  error?: string;
}

export interface SendaStore {
  stats: FactoryStats | null;
  state: SendaProgramState;
  
  // State management
  setProcessing: (isProcessing: boolean) => void;
  setError: (error: Error | null) => void;
  resetState: () => void;
  
  // On-chain operations
  initEscrow: (params: InitEscrowParams) => Promise<TransactionResult>;
  createDeposit: (params: DepositInput) => Promise<CreateDepositResponse>;
  cancelDeposit: (params: CancelParams) => Promise<TransactionResult>;
  requestWithdrawal: (params: ReleaseParams) => Promise<TransactionResult>;
  updateDepositSignature: (params: { depositId: string; role: 'sender' | 'receiver'; signer: string }) => Promise<{ success: boolean; error?: any }>;
  transferSpl: (params: TransferSplParams) => Promise<TransferSplResponse>;
  
  // Database sync operations
  syncEscrowToDb: (escrowAddress: string, senderPk: string, receiverPk: string) => Promise<EscrowData>;
  syncDepositToDb: (depositParams: DepositInput & { signature: string; escrowId: string; userId: string }) => Promise<string>;
  
  // Read methods
  getFactoryStats: (owner?: string) => Promise<FactoryStats | null>;
  getEscrowStats: (escrowPublicKey: string) => Promise<EscrowStats | null>;
  getEscrowFromDb: (senderPk: string, receiverPk: string) => Promise<EscrowData | null>;
}

export const useSendaProgram = create<SendaStore>()(
  persist(
    (set, get) => ({
      stats: null,
      state: {
        isProcessing: false,
        lastError: null,
        lastInitialization: null,
        transactionCount: 0
      },
      
      setProcessing: (isProcessing: boolean) => set({
        state: { ...get().state, isProcessing }
      }),
      
      setError: (error: Error | null) => set({
        state: { ...get().state, lastError: error }
      }),
      
      resetState: () => set({
        state: {
          isProcessing: false,
          lastError: null,
          lastInitialization: null,
          transactionCount: 0
        }
      }),

      initEscrow: async ({ senderPublicKey, receiverPublicKey, seed = 0 }: InitEscrowParams): Promise<TransactionResult> => {
        try {
          set({ state: { ...get().state, isProcessing: true } });
          
          const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL!}/api/trpc/sendaRouter.initEscrow`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sender: senderPublicKey,
              receiver: receiverPublicKey,
              seed
            })
          });
          
          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'Failed to initialize escrow');
          }

          const result = await response.json();
          
          if (!result.data?.signature) {
            throw new Error('No signature returned from server');
          }
          
          set({ 
            state: { 
              ...get().state, 
              isProcessing: false,
              transactionCount: get().state.transactionCount + 1 
            }
          });
          
          return { 
            success: true, 
            signature: result.data.signature,
            escrowPublicKey: result.data.escrow 
          };
        } catch (error) {
          const typedError = error instanceof Error ? error : new Error(String(error));
          set({ state: { ...get().state, isProcessing: false, lastError: typedError } });
          return { success: false, error: typedError };
        }
      },
      
      syncEscrowToDb: async (escrowAddress: string, senderPk: string, receiverPk: string) => {
        try {
          const escrow = await prisma.escrow.upsert({
            where: {
              id: escrowAddress,
            },
            create: {
              id: escrowAddress,
              senderPublicKey: senderPk,
              receiverPublicKey: receiverPk,
              depositedUsdc: 0,
              depositedUsdt: 0,
              depositCount: 0,
              state: 'Active',
            },
            update: {}, // If it exists, don't update anything
          });
          
          return escrow;
        } catch (error) {
          console.error('Error syncing escrow to DB:', error);
          throw error;
        }
      },
      
      syncDepositToDb: async (params) => {
        try {
          // Create transaction record first
          const transaction = await prisma.transaction.create({
            data: {
              userId: params.userId,
              walletPublicKey: params.depositor,
              destinationAddress: params.recipientEmail,
              amount: params.amount,
              status: 'PENDING',
              type: 'TRANSFER',
            },
          });

          // Create deposit record
          const deposit = await prisma.depositRecord.create({
            data: {
              depositIndex: Math.floor(Math.random() * 1000000), // TODO: Get actual index from chain
              amount: params.amount,
              policy: params.authorization as SignatureType,
              stable: params.stable,
              signatures: [params.signature],
              state: 'PENDING',
              userId: params.userId,
              transactionId: transaction.id,
              escrowId: params.escrowId,
            },
          });

          return deposit.id;
        } catch (error) {
          console.error('Error syncing deposit to DB:', error);
          throw error;
        }
      },

      getEscrowFromDb: async (senderPk: string, receiverPk: string) => {
        try {
          return await prisma.escrow.findUnique({
            where: {
              senderPublicKey_receiverPublicKey: {
                senderPublicKey: senderPk,
                receiverPublicKey: receiverPk,
              },
            },
          });
        } catch (error) {
          console.error('Error getting escrow from DB:', error);
          return null;
        }
      },

      transferSpl: async (params: TransferSplParams): Promise<TransferSplResponse> => {
        try {
          set({ state: { ...get().state, isProcessing: true } });

          const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL!}/api/trpc/sendaRouter.transferSpl`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params)
          });

          const result = await response.json();
          set({ 
            state: {  
              ...get().state, 
              isProcessing: false,
              transactionCount: get().state.transactionCount + 1 
            }
          });

          return { success: true, signature: result.data.signature };
        } catch (error) {
          const typedError = error instanceof Error ? error : new Error(String(error));
          set({ state: { ...get().state, isProcessing: false, lastError: typedError } });
          return { success: false, error: typedError.message };
        }
      },

      createDeposit: async (params: DepositInput): Promise<CreateDepositResponse> => {
        try {
          set({ state: { ...get().state, isProcessing: true } });
          
          const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL!}/api/trpc/sendaRouter.createDeposit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params)
          });
          
          const result = await response.json();
          set({ 
            state: { 
              ...get().state, 
              isProcessing: false,
              transactionCount: get().state.transactionCount + 1 
            }
          });
          
          return result.result.data;
        } catch (error) {
          const typedError = error instanceof Error ? error : new Error(String(error));
          set({ state: { ...get().state, isProcessing: false, lastError: typedError } });
          return { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: typedError.message } };
        }
      },

      cancelDeposit: async (params: CancelParams): Promise<TransactionResult> => {
        try {
          set({ state: { ...get().state, isProcessing: true } });
          
          const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/trpc/sendaRouter.cancelDeposit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params)
          });
          
          const result = await response.json();
          set({ 
            state: { 
              ...get().state, 
              isProcessing: false,
              transactionCount: get().state.transactionCount + 1 
            }
          });
          
          return { success: true, signature: result.data.signature };
        } catch (error) {
          const typedError = error instanceof Error ? error : new Error(String(error));
          set({ state: { ...get().state, isProcessing: false, lastError: typedError } });
          return { success: false, error: typedError };
        }
      },

      requestWithdrawal: async (params: ReleaseParams): Promise<TransactionResult> => {
        try {
          console.log('Initiating withdrawal request with params:', params);
          set({ state: { ...get().state, isProcessing: true } });
          
          const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/trpc/sendaRouter.requestWithdrawal`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              json: params
            })
          });

          console.log('Raw response status:', response.status);
          const responseData = await response.json();
          console.log('Response data:', responseData);
          
          if (!response.ok) {
            throw new Error(responseData.error?.message || 'Failed to process withdrawal request');
          }

          const signature = responseData.result?.data?.signature;
          console.log('Extracted signature:', signature);
          
          if (!signature) {
            throw new Error('No signature returned from withdrawal request');
          }
          
          set({ 
            state: { 
              ...get().state, 
              isProcessing: false,
              transactionCount: get().state.transactionCount + 1 
            }
          });
          
          return { success: true, signature };
        } catch (error) {
          console.error('Withdrawal request failed:', error);
          const typedError = error instanceof Error ? error : new Error(String(error));
          set({ state: { ...get().state, isProcessing: false, lastError: typedError } });
          return { success: false, error: typedError };
        }
      },

      getFactoryStats: async (owner?: string): Promise<FactoryStats | null> => {
        try {
          const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/trpc/sendaRouter.getFactoryStats${owner ? `?owner=${owner}` : ''}`);
          const result = await response.json();
          return result.data;
        } catch (error) {
          console.error('Error getting factory stats:', error);
          return null;
        }
      },

      getEscrowStats: async (escrowPublicKey: string): Promise<EscrowStats | null> => {
        try {
          const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/trpc/sendaRouter.getEscrowStats?escrow=${escrowPublicKey}`);
          const result = await response.json();
          return result.data;
        } catch (error) {
          console.error('Error getting escrow stats:', error);
          return null;
        }
      },

      updateDepositSignature: async (params: { depositId: string; role: 'sender' | 'receiver'; signer: string }) => {
        try {
          set({ state: { ...get().state, isProcessing: true } });
          
          const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/trpc/sendaRouter.updateDepositSignature`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params)
          });
          
          const result = await response.json();
          
          set({ 
            state: { 
              ...get().state, 
              isProcessing: false,
              transactionCount: get().state.transactionCount + 1 
            }
          });
          
          return { success: true, data: result.data };
        } catch (error) {
          console.error('Error updating deposit signature:', error);
          const typedError = error instanceof Error ? error : new Error(String(error));
          set({ state: { ...get().state, isProcessing: false, lastError: typedError } });
          return { success: false, error: typedError };
        }
      }
    }),
    {
      name: 'senda-program-store',
      partialize: (state) => ({
        stats: state.stats,
        state: {
          lastInitialization: state.state.lastInitialization,
          transactionCount: state.state.transactionCount
        }
      })
    }
  )
);