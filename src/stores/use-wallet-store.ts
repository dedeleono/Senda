import { create } from 'zustand';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { getSharedConnection } from '@/lib/senda/helpers';

interface WalletState {
  publicKey: PublicKey | null;
  keypair: Keypair | null;
  connection: Connection | null;
  isLoading: boolean;
  error: Error | null;
  balances: {
    USDC: number;
    USDT: number;
  };
}

interface WalletStore extends WalletState {
  initWallet: (userId: string, publicKeyStr: string) => Promise<void>;
  fetchBalances: () => Promise<void>;
  disconnect: () => void;
}

const NETWORK_MINTS = {
  mainnet: {
    USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  },
  devnet: {
    USDC: 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr',
    USDT: 'J2B12TxqtZkXtMAPY1BX2noiTSDNrz4VqiKfU5Sh9t5d'
  }
} as const;

export const useWalletStore = create<WalletStore>((set, get) => ({
  publicKey: null,
  keypair: null,
  connection: null,
  isLoading: false,
  error: null,
  balances: {
    USDC: 0,
    USDT: 0,
  },

  initWallet: async (userId: string, publicKeyStr: string) => {
    try {
      set({ isLoading: true, error: null });

      // Validate public key format
      try {
        new PublicKey(publicKeyStr);
      } catch (error) {
        throw new Error('Invalid wallet public key format');
      }

      // 1. Get the user's keypair from the backend
      const res = await fetch('/api/user-wallet', {
        method: 'POST',
        body: JSON.stringify({ userId }),
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch wallet: ${res.status}`);
      }

      const { encryptedPrivateKey, iv, authTag } = await res.json() as {
        encryptedPrivateKey: string;
        iv: string;
        authTag: string;
      };

      // 2. Decrypt the private key
      const dec = await fetch('/api/decrypt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          encryptedData: {
            iv,
            authTag,
            data: encryptedPrivateKey
          }
        }),
      });

      if (!dec.ok) {
        throw new Error('Failed to decrypt key');
      }

      const { decrypted } = await dec.json() as { decrypted: string };
      
      let keypair: Keypair;
      try {
        keypair = Keypair.fromSecretKey(Buffer.from(decrypted, 'base64'));
      } catch (error) {
        throw new Error('Invalid private key format');
      }

      // Verify the keypair matches the public key
      if (keypair.publicKey.toBase58() !== publicKeyStr) {
        throw new Error('Keypair does not match provided public key');
      }

      const connection = getSharedConnection();

      set({
        publicKey: keypair.publicKey,
        keypair,
        connection,
        isLoading: false,
        error: null
      });

      await get().fetchBalances();

    } catch (error) {
      console.error('Error initializing wallet:', error);
      set({ 
        error: error instanceof Error ? error : new Error(String(error)),
        isLoading: false,
        publicKey: null,
        keypair: null,
        connection: null,
      });
    }
  },

  fetchBalances: async () => {
    const { connection, publicKey } = get();
    if (!connection || !publicKey) return;

    try {
      set({ isLoading: true });

      // const isMainnet = process.env.NEXT_PUBLIC_SOLANA_NETWORK === 'mainnet';
      const network = 'devnet';
      const mints = NETWORK_MINTS[network];

      const balances = { USDC: 0, USDT: 0 };

      for (const [symbol, mintAddress] of Object.entries(mints)) {
        try {
          const mintPubkey = new PublicKey(mintAddress);
          const tokenAccount = await getAssociatedTokenAddress(
            mintPubkey,
            publicKey
          );

          const accountInfo = await connection.getTokenAccountBalance(tokenAccount);
          balances[symbol as keyof typeof balances] = accountInfo.value.uiAmount || 0;
        } catch (err) {
          console.error(`Error fetching ${symbol} balance:`, err);
        }
      }

      set({ balances, isLoading: false });
    } catch (error) {
      console.error('Error fetching balances:', error);
      set({ error: error instanceof Error ? error : new Error(String(error)), isLoading: false });
    }
  },

  disconnect: () => {
    set({
      publicKey: null,
      keypair: null,
      connection: null,
      isLoading: false,
      error: null,
      balances: {
        USDC: 0,
        USDT: 0,
      }
    });
  }
})); 