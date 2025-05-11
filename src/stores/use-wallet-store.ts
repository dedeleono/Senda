import { create } from 'zustand';
import { Connection, Keypair, PublicKey, Signer } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { getSharedConnection } from '@/lib/senda/helpers';
import { persist } from 'zustand/middleware';

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
  lastInitialization: number | null;
  transactionCount: number;
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

export const useWalletStore = create<WalletStore>()(
  persist(
    (set, get) => ({
      publicKey: null,
      keypair: null,
      connection: null,
      isLoading: false,
      error: null,
      balances: {
        USDC: 0,
        USDT: 0,
      },
      lastInitialization: null,
      transactionCount: 0,

      initWallet: async (userId: string, publicKeyStr: string) => {
        try {
          set({ isLoading: true, error: null });
          console.log('Initializing wallet for user:', userId);

          try {
            new PublicKey(publicKeyStr);
          } catch (error) {
            throw new Error('Invalid wallet public key format');
          }

          const res = await fetch('/api/user-wallet', {
            method: 'POST',
            body: JSON.stringify({ userId }),
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
          });

          if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(`Failed to fetch wallet: ${res.status} - ${errorData.error || 'Unknown error'}`);
          }

          const { encryptedPrivateKey, iv, authTag } = await res.json() as {
            encryptedPrivateKey: string;
            iv: string;
            authTag: string;
          };

          const decRes = await fetch('/api/decrypt', {
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

          if (!decRes.ok) {
            const errorData = await decRes.json().catch(() => ({}));
            throw new Error(`Failed to decrypt key: ${decRes.status} - ${errorData.error || 'Unknown error'}`);
          }

          const { decrypted, success } = await decRes.json() as { decrypted: string; success: boolean };
          
          if (!success || !decrypted) {
            throw new Error('Decryption failed - no decrypted data received');
          }

          let keypair: Keypair;
          try {
            keypair = Keypair.fromSecretKey(Buffer.from(decrypted, 'base64'));
          } catch (error) {
            console.error('Error creating keypair:', error);
            throw new Error('Invalid private key format after decryption');
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
            error: null,
            lastInitialization: Date.now(),
            transactionCount: get().transactionCount
          });

          console.log('Wallet successfully initialized for:', keypair.publicKey.toString());
          await get().fetchBalances();

        } catch (error) {
          console.error('Error initializing wallet:', error);
          set({ 
            error: error instanceof Error ? error : new Error(String(error)),
            isLoading: false,
            publicKey: null,
            keypair: null,
            connection: null,
            lastInitialization: null,
            transactionCount: 0
          });
          throw error;
        }
      },

      fetchBalances: async () => {
        const { connection, publicKey } = get();
        if (!connection || !publicKey) return;

        try {
          // const isMainnet = process.env.NEXT_PUBLIC_SOLANA_NETWORK === 'mainnet';
          const network = 'devnet';
          const mints = NETWORK_MINTS[network];

          const usdcMint = new PublicKey(mints.USDC);
          const usdtMint = new PublicKey(mints.USDT);

          const [usdcAta, usdtAta] = await Promise.all([
            getAssociatedTokenAddress(usdcMint, publicKey),
            getAssociatedTokenAddress(usdtMint, publicKey)
          ]);

          const accounts = await connection.getMultipleAccountsInfo([usdcAta, usdtAta]);
          
          const balances = {
            USDC: accounts[0]?.data.readBigInt64LE(64) || BigInt(0),
            USDT: accounts[1]?.data.readBigInt64LE(64) || BigInt(0)
          };

          set({
            balances: {
              USDC: Number(balances.USDC) / 1_000_000,
              USDT: Number(balances.USDT) / 1_000_000
            }
          });
        } catch (error) {
          console.error('Error fetching balances:', error);
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
          },
          lastInitialization: null,
          transactionCount: 0
        });
      }
    }),
    {
      name: 'senda-wallet-storage',
      partialize: (state) => ({
        transactionCount: state.transactionCount,
        lastInitialization: state.lastInitialization,
      })
    }
  )
); 