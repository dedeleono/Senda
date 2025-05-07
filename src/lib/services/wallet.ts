'use client';

import { Keypair, PublicKey } from '@solana/web3.js';
import { KeypairWalletAdapter } from '@/lib/utils/keypair-wallet-adapter';

let walletAdapter: KeypairWalletAdapter | null = null;
let isLoadingKeypair = false;

export const initWalletAdapter = (publicKey: string): KeypairWalletAdapter => {
  if (!walletAdapter) {
    try {
      walletAdapter = new KeypairWalletAdapter({
        name: 'SendaWallet',
        publicKey: new PublicKey(publicKey)
      });
      
      console.log('✅ Senda wallet adapter initialized with public key:', publicKey);
    } catch (error) {
      console.error('❌ Error initializing wallet adapter:', error);
      throw error;
    }
  }
  
  return walletAdapter;
};

export const getWalletAdapter = (publicKey?: string): KeypairWalletAdapter | null => {
  if (!walletAdapter && publicKey) {
    return initWalletAdapter(publicKey);
  }
  return walletAdapter;
};

export const loadKeypair = async (): Promise<boolean> => {
  if (isLoadingKeypair) {
    console.log('Already loading keypair, waiting...');
    return false;
  }

  if (!walletAdapter) {
    console.error('❌ Wallet adapter not initialized');
    return false;
  }
  
  try {
    isLoadingKeypair = true;
    
    const sessionResponse = await fetch('/api/auth/session');
    if (!sessionResponse.ok) {
      throw new Error('Failed to get session');
    }

    const session = await sessionResponse.json();
    if (!session?.user?.id) {
      throw new Error('No authenticated user');
    }

    console.log('Session data:', {
      userId: session.user.id,
      hasWalletPk: !!session.user.sendaWalletPublicKey,
    });

    const walletPublicKey = session.user.sendaWalletPublicKey;
    if (!walletPublicKey) {
      throw new Error('No wallet public key in session');
    }
    
    if (!walletAdapter.publicKey || walletAdapter.publicKey.toString() !== walletPublicKey) {
      walletAdapter = initWalletAdapter(walletPublicKey);
    }

    console.log('Fetching wallet data from API...');
    const privateKeyData = await getUserWalletData(session.user.id);
    if (!privateKeyData) {
      throw new Error('Failed to get wallet data');
    }

    console.log('Decrypting private key...');
    const keypair = await decryptAndCreateKeypair(privateKeyData);
    walletAdapter.setKeypair(keypair);
    
    console.log('✅ Senda wallet keypair loaded successfully');
    
    await walletAdapter.connect();
    
    return true;
  } catch (error) {
    console.error('❌ Error loading keypair:', error);
    return false;
  } finally {
    isLoadingKeypair = false;
  }
};

export const disconnectWallet = async (): Promise<void> => {
  if (walletAdapter) {
    await walletAdapter.disconnect();
    walletAdapter = null;
  }
};

export const getSendaWalletPublicKey = (): PublicKey | null => {
  return walletAdapter?.publicKey || null;
};

export const isSendaWalletConnected = (): boolean => {
  return walletAdapter?.connected || false;
};

// Helper functions
async function getUserWalletData(userId: string): Promise<{ iv: string; authTag: string; data: string } | null> {
  try {
    // Use the same endpoint and approach as in the existing code
    const response = await fetch('/api/user-wallet', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ userId })
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch user wallet data: ${response.statusText}`);
    }

    const userData = await response.json();
    if (!userData || !userData.encryptedPrivateKey || !userData.iv || !userData.authTag) {
      return null;
    }

    return {
      data: userData.encryptedPrivateKey,
      iv: userData.iv,
      authTag: userData.authTag
    };
  } catch (error) {
    console.error('Error fetching user wallet data:', error);
    return null;
  }
}

async function decryptAndCreateKeypair(privateKeyData: { iv: string; authTag: string; data: string }): Promise<Keypair> {
  const response = await fetch('/api/decrypt', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ encryptedData: privateKeyData }),
  });

  if (!response.ok) {
    throw new Error('Failed to decrypt private key');
  }

  const { decrypted } = await response.json();
  const privateKeyBytes = Buffer.from(decrypted, 'base64');
  return Keypair.fromSecretKey(privateKeyBytes);
} 