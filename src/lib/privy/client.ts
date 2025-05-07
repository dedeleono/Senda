import { create } from 'zustand';

interface PrivyConfig {
  appId: string;
  enabled: boolean;
}

interface FundWalletOptions {
  amount?: string;
  cluster?: {
    name: string;
  };
  targetAsset?: 'SOL' | 'USDC' | 'USDT';
}

interface PrivyClientState {
  config: PrivyConfig;
  isInitialized: boolean;
  fundWalletUrl: string | null;
  error: Error | null;
  
  initialize: (config: PrivyConfig) => void;
  
  generateFundWalletUrl: (
    walletAddress: string,
    options?: FundWalletOptions
  ) => Promise<string>;
  
  clearError: () => void;
}

export const usePrivyClient = create<PrivyClientState>((set, get) => ({
  config: {
    appId: '',
    enabled: false,
  },
  isInitialized: false,
  fundWalletUrl: null,
  error: null,
  
  initialize: (config: PrivyConfig) => {
    set({
      config,
      isInitialized: true,
    });
  },
  
  generateFundWalletUrl: async (walletAddress: string, options?: FundWalletOptions) => {
    const { config, isInitialized } = get();
    
    if (!isInitialized || !config.enabled) {
      const error = new Error('Privy client not initialized or disabled');
      set({ error });
      throw error;
    }
    
    try {
      const response = await fetch('/api/privy/generate-funding-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress,
          amount: options?.amount,
          cluster: options?.cluster?.name || 'mainnet-beta',
          targetAsset: options?.targetAsset || 'SOL',
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to generate funding URL');
      }
      
      const data = await response.json();
      const fundingUrl = data.fundingUrl;
      
      set({ fundWalletUrl: fundingUrl });
      
      return fundingUrl;
    } catch (error) {
      const typedError = error instanceof Error ? error : new Error(String(error));
      set({ error: typedError });
      throw typedError;
    }
  },
  
  clearError: () => {
    set({ error: null });
  },
})); 