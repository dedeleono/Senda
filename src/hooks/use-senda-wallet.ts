'use client';

import { useEffect, useState, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useAuth } from '@/hooks/use-auth';
import { PublicKey } from '@solana/web3.js';
import { getSendaWalletPublicKey, isSendaWalletConnected, loadKeypair } from '@/lib/services/wallet';

interface SendaWalletHook {
  isSendaWalletConnected: boolean;
  sendaWalletPublicKey: PublicKey | null;
  isLoading: boolean;
  error: Error | null;
  connectSendaWallet: () => Promise<boolean>;
}

export function useSendaWallet(): SendaWalletHook {
  const { session } = useAuth();
  const { connected, publicKey: externalWalletPublicKey } = useWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const initialized = useRef(false);
  
  // Get the state from the wallet service
  const sendaWalletConnected = isSendaWalletConnected();
  const sendaWalletPublicKey = getSendaWalletPublicKey();

  // Connect to the Senda wallet when the session is available
  useEffect(() => {
    // Only initialize once
    if (initialized.current) return;
    
    if (session?.user?.sendaWalletPublicKey && !sendaWalletConnected) {
      initialized.current = true;
      // Log the state before connecting
      console.log("Initializing Senda wallet connection", {
        externalWalletConnected: connected,
        externalWalletPublicKey: externalWalletPublicKey?.toString(),
        sendaWalletPublicKey: session.user.sendaWalletPublicKey,
        hasSendaWalletPublicKey: !!sendaWalletPublicKey
      });
      
      connectSendaWallet();
    }
  }, [session?.user?.sendaWalletPublicKey, sendaWalletConnected, connected, externalWalletPublicKey]);

  const connectSendaWallet = async (): Promise<boolean> => {
    if (!session?.user?.sendaWalletPublicKey) {
      setError(new Error('No Senda wallet public key available in session'));
      return false;
    }

    try {
      setIsLoading(true);
      const success = await loadKeypair();
      
      if (success) {
        console.log("✅ Senda wallet connected:", getSendaWalletPublicKey()?.toString());
      } else {
        throw new Error('Failed to connect Senda wallet');
      }
      
      setIsLoading(false);
      return true;
    } catch (err) {
      console.error("❌ Failed to connect Senda wallet:", err);
      setError(err instanceof Error ? err : new Error('Failed to connect Senda wallet'));
      setIsLoading(false);
      return false;
    }
  };

  return {
    isSendaWalletConnected: sendaWalletConnected,
    sendaWalletPublicKey: sendaWalletPublicKey,
    isLoading,
    error,
    connectSendaWallet
  };
} 