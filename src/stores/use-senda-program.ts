import { create } from 'zustand';
import { PublicKey } from '@solana/web3.js';
import { TransactionResult } from '@/lib/utils/solana-transaction';
import { FactoryStats, EscrowStats, InitEscrowParams, DepositParams, CancelParams, ReleaseParams, EscrowState } from '@/types/senda-program';
import { persist } from 'zustand/middleware';

interface SendaProgramState {
  isProcessing: boolean;
  lastError: Error | null;
  lastInitialization: number | null;
  transactionCount: number;
}

export interface SendaStore {
  stats: FactoryStats | null;
  state: SendaProgramState;
  
  // State management
  setProcessing: (isProcessing: boolean) => void;
  setError: (error: Error | null) => void;
  resetState: () => void;
  
  // Transaction methods
  initEscrow: (params: InitEscrowParams) => Promise<TransactionResult>;
  createDeposit: (params: DepositParams) => Promise<TransactionResult>;
  cancelDeposit: (params: CancelParams) => Promise<TransactionResult>;
  requestWithdrawal: (params: ReleaseParams) => Promise<TransactionResult>;
  
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
        transactionCount: 0,
      },

      setProcessing: (isProcessing: boolean) => 
        set({ state: { ...get().state, isProcessing } }),
      
      setError: (error: Error | null) => 
        set({ state: { ...get().state, lastError: error } }),
      
      resetState: () => set({
        stats: null,
        state: {
          isProcessing: false,
          lastError: null,
          lastInitialization: null,
          transactionCount: 0,
        }
      }),

      getFactoryStats: async (owner?: string) => {
        try {
          set({ state: { ...get().state, isProcessing: true } });
          
          const response = await fetch('/api/trpc/sendaRouter.getFactoryStats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ owner })
          });
          
          const result = await response.json();
          set({ stats: result.data, state: { ...get().state, isProcessing: false } });
          return result.data;
        } catch (error) {
          const typedError = error instanceof Error ? error : new Error(String(error));
          set({ state: { ...get().state, isProcessing: false, lastError: typedError } });
          return null;
        }
      },

      getEscrowStats: async (escrowPublicKey: string) => {
        try {
          set({ state: { ...get().state, isProcessing: true } });
          
          const response = await fetch('/api/trpc/sendaRouter.getEscrowStats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ escrowPublicKey })
          });
          
          const result = await response.json();
          return result.data;
        } catch (error) {
          const typedError = error instanceof Error ? error : new Error(String(error));
          set({ state: { ...get().state, isProcessing: false, lastError: typedError } });
          return null;
        }
      },

      initEscrow: async ({ senderPublicKey, receiverPublicKey, seed = 0 }: InitEscrowParams): Promise<TransactionResult> => {
        try {
          set({ state: { ...get().state, isProcessing: true } });
          
          const response = await fetch('/api/trpc/sendaRouter.initEscrow', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sender: senderPublicKey,
              receiver: receiverPublicKey,
              seed
            })
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

      createDeposit: async (params: DepositParams): Promise<TransactionResult> => {
        try {
          set({ state: { ...get().state, isProcessing: true } });
          
          const response = await fetch('/api/trpc/sendaRouter.createDeposit', {
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

      cancelDeposit: async (params: CancelParams): Promise<TransactionResult> => {
        try {
          set({ state: { ...get().state, isProcessing: true } });
          
          const response = await fetch('/api/trpc/sendaRouter.cancelDeposit', {
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
          set({ state: { ...get().state, isProcessing: true } });
          
          const response = await fetch('/api/trpc/sendaRouter.requestWithdrawal', {
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
    }),
    {
      name: 'senda-program-storage',
      partialize: (state) => ({
        state: {
          transactionCount: state.state.transactionCount,
          lastInitialization: state.state.lastInitialization,
        }
      })
    }
  )
);