'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useWalletStore } from '@/stores/use-wallet-store';
import { useSendaProgram } from '@/stores/use-senda-program';

export function useAuth() {
  const { data: session, status } = useSession();
  const { initWallet, publicKey, error: walletError } = useWalletStore();
  const [isInitializingWallet, setIsInitializingWallet] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Initialize when user logs in
  useEffect(() => {
    const initializeWallet = async () => {
      if (!session?.user?.id || !session?.user?.sendaWalletPublicKey) {
        console.error('Missing user ID or Senda wallet public key');
        return;
      }

      try {
        setIsInitializingWallet(true);
        setError(null);
        
        console.log('Initializing Senda wallet for authenticated user:', session.user.sendaWalletPublicKey);
        
        await initWallet(session.user.id, session.user.sendaWalletPublicKey)
        
        console.log('Wallet initialized successfully');
      } catch (error) {
        console.error('Error during wallet initialization:', error);
        setError(error instanceof Error ? error : new Error(String(error)));
      } finally {
        setIsInitializingWallet(false);
      }
    };

    if (status === 'authenticated' && !publicKey) {
      initializeWallet();
    }
  }, [status, session?.user?.id, session?.user?.sendaWalletPublicKey, publicKey, initWallet]);

  return {
    isInitializingWallet,
    error: error || walletError,
    isAuthenticated: status === 'authenticated',
    session,
    userId: session?.user?.id,
    walletError,
    hasWallet: !!publicKey,
  } as const;
} 