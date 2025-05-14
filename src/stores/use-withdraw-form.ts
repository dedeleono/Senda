import { create } from 'zustand';

export type WithdrawalMethod = 'wallet' | 'bank';

export type WithdrawFormData = {
  method: WithdrawalMethod | null;
  amount: number;
  token: 'USDC' | 'USDT';
  walletAddress?: string;
  bankInfo?: {
    accountName: string;
    accountNumber: string;
    routingNumber: string;
    bankName: string;
  };
};

interface WithdrawFormState {
  step: number;
  formData: WithdrawFormData;
  setStep: (step: number) => void;
  selectMethod: (method: WithdrawalMethod) => void;
  setAmount: (amount: number) => void;
  setToken: (token: 'USDC' | 'USDT') => void;
  setWalletAddress: (address: string) => void;
  setBankInfo: (info: WithdrawFormData['bankInfo']) => void;
  nextStep: () => void;
  prevStep: () => void;
  resetForm: () => void;
}

const initialFormData: WithdrawFormData = {
  method: null,
  amount: 0,
  token: 'USDC',
};

export const useWithdrawForm = create<WithdrawFormState>((set) => ({
  step: 1,
  formData: initialFormData,
  
  setStep: (step) => set({ step }),
  
  selectMethod: (method) => 
    set((state) => ({
      formData: { ...state.formData, method },
      step: 2
    })),
  
  setAmount: (amount) => 
    set((state) => ({
      formData: { ...state.formData, amount }
    })),
  
  setToken: (token) => 
    set((state) => ({
      formData: { ...state.formData, token }
    })),
  
  setWalletAddress: (address) => 
    set((state) => ({
      formData: { ...state.formData, walletAddress: address }
    })),
  
  setBankInfo: (info) => 
    set((state) => ({
      formData: { ...state.formData, bankInfo: info }
    })),
  
  nextStep: () => 
    set((state) => ({
      step: state.step + 1
    })),
  
  prevStep: () => 
    set((state) => ({
      step: Math.max(1, state.step - 1)
    })),
  
  resetForm: () => 
    set({
      step: 1,
      formData: initialFormData
    })
})); 