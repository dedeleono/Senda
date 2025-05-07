"use client";

import React, { useMemo, useState, useEffect, useCallback } from "react";
import {
  ConnectionProvider,
  WalletProvider,
  useWallet,
} from "@solana/wallet-adapter-react";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  TrezorWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import '@solana/wallet-adapter-react-ui/styles.css'
import { clusterApiUrl } from "@solana/web3.js";
import { KeypairWalletAdapter } from "../../lib/utils/keypair-wallet-adapter";
import { getWalletAdapter, initWalletAdapter, loadKeypair } from "@/lib/services/wallet";
import { useAuth } from '@/hooks/use-auth'
import { useSendaProgram } from '@/stores/use-senda-program'

interface WalletProps {
  children: React.ReactNode;
  userWalletPublicKey?: string;
}

const SendaWalletAutoConnect = ({ userWalletPublicKey }: { userWalletPublicKey?: string }) => {
  const { wallet, connected, publicKey } = useWallet();
  const [initialized, setInitialized] = useState(false);
  const [initAttempts, setInitAttempts] = useState(0);
  const { session } = useAuth();
  
  // Access the Senda program store directly without a selector function
  const sendaProgramStore = useSendaProgram();
  
  // Function to initialize the Senda program
  const initializeSendaProgram = useCallback(async (userId: string) => {
    try {
      console.log("🔄 Initializing Senda program with user ID:", userId);
      await sendaProgramStore.initState({ userId });
      
      // Verify that program was properly initialized
      if (!sendaProgramStore.program) {
        console.error("⚠️ Program initialization didn't set program state correctly");
        return false;
      }
      
      console.log("✅ Senda program initialized successfully");
      return true;
    } catch (error) {
      console.error("❌ Error initializing Senda program:", error);
      return false;
    }
  }, [sendaProgramStore]);
  
  useEffect(() => {
    const initializeSendaWallet = async () => {
      // Skip if already initialized or no wallet public key
      if (initialized || !userWalletPublicKey) return;
      
      try {
        console.log("🔄 Initializing Senda wallet...");
        
        // Initialize the wallet adapter
        const adapter = initWalletAdapter(userWalletPublicKey);
        const success = await loadKeypair();
        
        if (success) {
          console.log("✅ Senda wallet connected automatically:", adapter.publicKey?.toString());
          
          // Get user ID from session or API
          let userId = session?.user?.id;
          
          if (!userId) {
            try {
              console.log("🔄 No user ID in session, fetching from API...");
              const sessionResponse = await fetch('/api/auth/session');
              if (sessionResponse.ok) {
                const sessionData = await sessionResponse.json();
                userId = sessionData?.user?.id;
                console.log("✅ Got user ID from API:", userId || "none");
              }
            } catch (sessionError) {
              console.error("❌ Error fetching session:", sessionError);
            }
          }
          
          // Initialize the program with the user ID or fallback
          const programInitialized = await initializeSendaProgram(userId || "unknown");
          
          if (!programInitialized && initAttempts < 3) {
            // If initialization failed and we haven't exceeded retry limit,
            // increment attempt counter but don't mark as initialized
            console.log(`⚠️ Program initialization failed, will retry (attempt ${initAttempts + 1}/3)`);
            setInitAttempts(prev => prev + 1);
            return;
          }
          
          // Mark as initialized (either succeeded or exceeded retry attempts)
          setInitialized(true);
        } else {
          console.error("❌ Failed to load Senda wallet keypair");
          
          // Try to initialize program anyway, even without wallet
          if (initAttempts < 3) {
            console.log(`⚠️ Attempting program init without wallet (attempt ${initAttempts + 1}/3)`);
            await initializeSendaProgram("unknown");
            setInitAttempts(prev => prev + 1);
          } else {
            setInitialized(true);
          }
        }
      } catch (error) {
        console.error("❌ Error in wallet initialization process:", error);
        
        // Reset program state in case of partial initialization
        sendaProgramStore.resetState();
        
        if (initAttempts < 3) {
          console.log(`⚠️ Will retry wallet initialization (attempt ${initAttempts + 1}/3)`);
          setInitAttempts(prev => prev + 1);
        } else {
          setInitialized(true);
        }
      }
    };
    
    initializeSendaWallet();
  }, [userWalletPublicKey, initialized, initAttempts, session?.user?.id, initializeSendaProgram, sendaProgramStore]);
  
  // Add a periodic check to make sure program is initialized
  useEffect(() => {
    // Skip if we're still trying initial initialization
    if (!initialized) return;
    
    const checkProgramInitialized = async () => {
      const { program, initState } = sendaProgramStore;
      
      if (!program) {
        console.log("🔄 Program not initialized during periodic check, reinitializing...");
        const userId = session?.user?.id || "unknown";
        await initState({ userId });
      }
    };
    
    // Check immediately
    checkProgramInitialized();
    
    // Then set up periodic check every 30 seconds
    const intervalId = setInterval(checkProgramInitialized, 30000);
    
    return () => clearInterval(intervalId);
  }, [initialized, sendaProgramStore, session?.user?.id]);
  
  useEffect(() => {
    console.log("Wallet connection status:", { 
      connected, 
      wallet: wallet ? wallet.adapter.name : 'none',
      publicKey: publicKey?.toString(),
    });
  }, [connected, wallet, publicKey]);
  
  return null;
};

export function Wallet({ children, userWalletPublicKey }: WalletProps) {
  const network = WalletAdapterNetwork.Devnet;//@todo change to mainnet
  const endpoint = process.env.NEXT_PUBLIC_SOLANA_RPC || clusterApiUrl(network);

  const wallets = useMemo(() => {
    const standardWallets = [
      new PhantomWalletAdapter({ 
        appIdentity: { name: "Senda" },
      }),
      new SolflareWalletAdapter(),
      new TrezorWalletAdapter(),
    ];
    
    if (userWalletPublicKey) {
      try {
        // note: this doesn't load the keypair yet
        const sendaAdapter = getWalletAdapter(userWalletPublicKey);
        if (sendaAdapter) {
          const adapters = [sendaAdapter, ...standardWallets] as any[];
          return adapters;
        }
      } catch (error) {
        console.error("Error adding Senda wallet adapter:", error);
      }
    }
    
    return standardWallets;
  }, [network, userWalletPublicKey]);

  const onError = useCallback((error: Error) => {
    console.error("Wallet error:", error);
  }, []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider 
        wallets={wallets} 
        autoConnect={false}
        onError={onError}
      >
        <WalletModalProvider>
          <SendaWalletAutoConnect userWalletPublicKey={userWalletPublicKey} />
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

export default Wallet;
