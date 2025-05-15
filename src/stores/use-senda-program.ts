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
  updateDepositSignature: (params: { depositId: string; role: 'sender' | 'receiver'; signerId: string }) => Promise<{ success: boolean; error?: any }>;
  transferSpl: (params: TransferSplParams) => Promise<TransferSplResponse>;
  
  // Read methods
  getFactoryStats: (owner?: string) => Promise<FactoryStats | null>;
  getEscrowStats: (escrowPublicKey: string) => Promise<EscrowStats | null>;
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

      updateDepositSignature: async (params: { depositId: string; role: 'sender' | 'receiver'; signerId: string }) => {
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