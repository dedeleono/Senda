'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useWalletStore } from '@/stores/use-wallet-store';

export function useAuth() {
  const { data: session, status } = useSession();
  const { initWallet, publicKey, error: walletError } = useWalletStore();
  const [isInitializingWallet, setIsInitializingWallet] = useState(false);

  // Initialize wallet when user logs in
  useEffect(() => {
    const initializeWallet = async () => {
      if (!session?.user?.id || !session?.user?.sendaWalletPublicKey) {
        console.error('Missing user ID or Senda wallet public key');
        return;
      }

      try {
        setIsInitializingWallet(true);
        await initWallet(session.user.id, session.user.sendaWalletPublicKey);
      } catch (error) {
        console.error('Failed to initialize wallet:', error);
      } finally {
        setIsInitializingWallet(false);
      }
    };

    if (
      status === 'authenticated' && 
      session?.user?.id &&
      session?.user?.sendaWalletPublicKey && 
      !publicKey && 
      !isInitializingWallet
    ) {
      console.log('Initializing Senda wallet for authenticated user:', session.user.sendaWalletPublicKey);
      initializeWallet();
    }
  }, [status, session?.user?.id, session?.user?.sendaWalletPublicKey, publicKey, isInitializingWallet]);

  return {
    isAuthenticated: status === 'authenticated',
    isLoading: status === 'loading' || isInitializingWallet,
    session,
    userId: session?.user?.id,
    walletError,
    hasWallet: !!publicKey,
  } as const;
} 