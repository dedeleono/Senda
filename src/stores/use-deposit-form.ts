import { create } from 'zustand';
import { DepositFormState, DepositFormActions, DepositFormData } from '@/types/transaction';

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

export const useDepositForm = create<DepositFormState & DepositFormActions>((set) => ({
  formData: initialFormData,
  step: 1,
  isSubmitting: false,
  error: undefined,
  
  updateFormData: (data) => set((state) => ({
    formData: { ...state.formData, ...data }
  })),
  
  nextStep: () => set((state) => ({ 
    step: Math.min(state.step + 1, 4) 
  })),
  
  prevStep: () => set((state) => ({ 
    step: Math.max(state.step - 1, 1) 
  })),
  
  setStep: (step) => set({ step }),
  
  resetForm: () => set({
    formData: initialFormData,
    step: 1,
    error: undefined
  }),
  
  setSubmitting: (isSubmitting) => set({ isSubmitting }),
  
  setError: (error) => set({ error })
})); 