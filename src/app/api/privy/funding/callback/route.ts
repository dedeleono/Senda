import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth/auth';
import { prisma } from '@/lib/db';
import { 
  Connection, 
  Transaction, 
  PublicKey, 
  sendAndConfirmTransaction, 
  Keypair,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';
import { 
  getSwapQuote, 
  createSwapTransaction, 
  SOLANA_MINTS, 
  DEVNET_MINTS,
  DEFAULT_SWAP_CONFIG,
  type SwapParams
} from '@/lib/utils/swap';

const requestSchema = z.object({
  status: z.string(),
  transaction_id: z.string(),
  amount: z.string(),
  asset: z.string(),
  wallet_address: z.string(),
  targetAsset: z.enum(['SOL', 'USDC', 'USDT']).default('SOL'),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const searchParams = url.searchParams;
  
  try {
    const params = {
      status: searchParams.get('status') || '',
      transaction_id: searchParams.get('transaction_id') || '',
      amount: searchParams.get('amount') || '',
      asset: searchParams.get('asset') || '',
      wallet_address: searchParams.get('wallet_address') || '',
      targetAsset: searchParams.get('targetAsset') || 'SOL',
    };
    
    const validatedData = requestSchema.parse(params);
    
    // Validate transaction status
    if (validatedData.status !== 'success') {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/funding?status=failed`
      );
    }
    
    // Find user by wallet address
    const user = await prisma.user.findFirst({
      where: { sendaWalletPublicKey: validatedData.wallet_address },
      select: {
        id: true,
        sendaWalletPublicKey: true,
        encryptedPrivateKey: true,
        iv: true,
        authTag: true,
      },
    });
    
    if (!user) {
      console.error(`User not found for wallet address: ${validatedData.wallet_address}`);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/funding?status=user-not-found`
      );
    }
    
    // Record the funding transaction
    await prisma.fiatFunding.create({
      data: {
        userId: user.id,
        publicKey: validatedData.wallet_address,
        method: 'privy',
        chain: 'solana',
        asset: validatedData.asset,
        amount: parseFloat(validatedData.amount),
      },
    });
    
    // If target asset is not SOL, perform automatic swap
    if (validatedData.targetAsset !== 'SOL') {
      try {
        // Perform the swap operation
        const swapResult = await performAutomaticSwap(
          user,
          parseFloat(validatedData.amount),
          validatedData.targetAsset as 'USDC' | 'USDT'
        );
        
        // Record the swap transaction
        await prisma.transaction.create({
          data: {
            userId: user.id,
            walletPublicKey: validatedData.wallet_address,
            amount: swapResult.outputAmount,
            status: 'COMPLETED',
            type: 'TRANSFER',
            signatureType: 'SINGLE',
          },
        });
        
        // Redirect to success page with swapped asset info
        return NextResponse.redirect(
          `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/funding?status=success&targetAsset=${validatedData.targetAsset}&amount=${swapResult.outputAmount}`
        );
      } catch (swapError) {
        console.error('Error performing automatic swap:', swapError);
        
        // Redirect to failed swap page, but funding was still successful
        return NextResponse.redirect(
          `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/funding?status=funded-swap-failed&asset=SOL&amount=${validatedData.amount}`
        );
      }
    }
    
    // If target asset is SOL, just redirect to success page
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/funding?status=success&targetAsset=SOL&amount=${validatedData.amount}`
    );
  } catch (error) {
    console.error('Error processing funding callback:', error);
    
    // Redirect to error page
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/funding?status=error`
    );
  }
}

/**
 * Perform automatic swap from SOL to target asset
 */
async function performAutomaticSwap(
  user: {
    id: string;
    sendaWalletPublicKey: string;
    encryptedPrivateKey: string;
    iv: string;
    authTag: string;
  },
  amountInSol: number,
  targetAsset: 'USDC' | 'USDT'
): Promise<{ outputAmount: number; signature: string }> {
  // Create connection to Solana network
  const endpoint = process.env.NEXT_PUBLIC_SOLANA_NETWORK === 'mainnet'
    ? process.env.SOLANA_MAINNET_RPC || 'https://api.mainnet-beta.solana.com'
    : process.env.SOLANA_DEVNET_RPC || 'https://api.devnet.solana.com';
  
  const connection = new Connection(endpoint, 'confirmed');
  
  // Determine token mints based on network
  const MINTS = process.env.NEXT_PUBLIC_SOLANA_NETWORK === 'mainnet' 
    ? SOLANA_MINTS 
    : DEVNET_MINTS;
  
  // Decrypt private key - in a real implementation this would use a secure method
  const privateKey = await decryptPrivateKey(
    user.encryptedPrivateKey,
    user.iv,
    user.authTag,
    process.env.ENCRYPTION_KEY || ''
  );
  
  // Create keypair from private key
  const keypair = Keypair.fromSecretKey(Buffer.from(privateKey));
  
  // Create swap parameters
  const swapParams: SwapParams = {
    fromMint: MINTS.SOL,
    toMint: MINTS[targetAsset],
    amount: amountInSol,
    slippageBps: 100, // 1% slippage
    walletPublicKey: user.sendaWalletPublicKey,
  };
  
  // Get swap quote
  const quote = await getSwapQuote(
    connection,
    swapParams,
    DEFAULT_SWAP_CONFIG
  );
  
  // Create transaction
  const transaction = createSwapTransaction(quote, user.sendaWalletPublicKey);
  
  // Sign and send transaction
  const signature = await sendAndConfirmTransaction(
    connection,
    transaction,
    [keypair]
  );
  
  return {
    outputAmount: quote.expectedOutAmount,
    signature
  };
}

/**
 * Decrypt a private key - this is a placeholder function
 * In a real implementation, you would use a secure key management system
 */
async function decryptPrivateKey(
  encryptedPrivateKey: string,
  iv: string,
  authTag: string,
  encryptionKey: string
): Promise<Uint8Array> {
  // This is a placeholder. In a real implementation, you would use:
  // 1. A proper key management system (AWS KMS, Google Cloud KMS, etc.)
  // 2. Hardware Security Modules (HSMs) for high-value wallets
  // 3. Proper encryption/decryption using the Web Crypto API or Node.js crypto module
  
  // For demonstration only - DO NOT use this in production
  return new Uint8Array(Buffer.from('PLACEHOLDER_PRIVATE_KEY'));
} 