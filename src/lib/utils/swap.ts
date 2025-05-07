import {
  Connection,
  PublicKey,
  TransactionInstruction,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';

// Interface for swap configuration
export interface SwapConfig {
  // The wallet that collects fees
  treasuryWalletPublicKey: string;
  // Fee percentage (0-100)
  feePercentage: number;
  // Whether fees are currently enabled
  feesEnabled: boolean;
  // Jupiter aggregator API endpoint
  jupiterApiEndpoint: string;
}

// Interface for swap parameters
export interface SwapParams {
  fromMint: string; // SOL mint or token mint
  toMint: string; // USDC or USDT mint
  amount: number; // Amount in natural units (e.g., SOL, not lamports)
  slippageBps: number; // Slippage in basis points (100 = 1%)
  walletPublicKey: string; // User's wallet public key
}

// Interface for swap quote result
export interface SwapQuote {
  inAmount: number;
  outAmount: number;
  feeAmount: number;
  expectedOutAmount: number; // After fees
  priceImpactPct: number;
  swapInstructions: TransactionInstruction[];
}

/**
 * Helper function to calculate fee amount
 */
function calculateFee(amount: number, feePercentage: number): number {
  return amount * (feePercentage / 100);
}

/**
 * Default Solana token mints
 */
export const SOLANA_MINTS = {
  SOL: 'So11111111111111111111111111111111111111112', // Native SOL mint
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC mint (mainnet)
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT mint (mainnet)
};

// Use devnet mints for devnet environment
export const DEVNET_MINTS = {
  SOL: 'So11111111111111111111111111111111111111112', // Native SOL mint
  USDC: 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr', // Fake USDC mint for devnet
  USDT: '7kbnvd6meiTFLnWXs6Zm5zTtgGv3tc2WX7zi3qMpyS5', // Fake USDT mint for devnet
};

/**
 * Get a swap quote using Jupiter Aggregator
 * 
 * @param connection Solana connection
 * @param swapParams Swap parameters
 * @param config Swap configuration
 * @returns Swap quote with instructions
 */
export async function getSwapQuote(
  connection: Connection, 
  swapParams: SwapParams, 
  config: SwapConfig
): Promise<SwapQuote> {
  try {
    const { jupiterApiEndpoint } = config;
    
    // Build Jupiter API URL for swap quote
    const url = new URL(`${jupiterApiEndpoint}/quote`);
    url.searchParams.append('inputMint', swapParams.fromMint);
    url.searchParams.append('outputMint', swapParams.toMint);
    url.searchParams.append('amount', Math.floor(swapParams.amount * LAMPORTS_PER_SOL).toString());
    url.searchParams.append('slippageBps', swapParams.slippageBps.toString());
    
    // Fetch quote from Jupiter
    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Jupiter API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Calculate fee if enabled
    let feeAmount = 0;
    if (config.feesEnabled) {
      feeAmount = calculateFee(
        Number(data.outAmount) / 10 ** data.outputDecimals,
        config.feePercentage
      );
    }
    
    // Parse swap instructions
    const swapInstructions = data.swapInstructions.map((ix: any) => {
      return new TransactionInstruction({
        programId: new PublicKey(ix.programId),
        keys: ix.accounts.map((acc: any) => ({
          pubkey: new PublicKey(acc.pubkey),
          isSigner: acc.isSigner,
          isWritable: acc.isWritable,
        })),
        data: Buffer.from(ix.data, 'base64'),
      });
    });
    
    // Add fee transfer instruction if fees are enabled
    if (config.feesEnabled && feeAmount > 0) {
      const feeInstruction = SystemProgram.transfer({
        fromPubkey: new PublicKey(swapParams.walletPublicKey),
        toPubkey: new PublicKey(config.treasuryWalletPublicKey),
        lamports: Math.floor(feeAmount * LAMPORTS_PER_SOL),
      });
      
      swapInstructions.push(feeInstruction);
    }
    
    return {
      inAmount: Number(data.inAmount) / 10 ** data.inputDecimals,
      outAmount: Number(data.outAmount) / 10 ** data.outputDecimals,
      feeAmount,
      expectedOutAmount: (Number(data.outAmount) / 10 ** data.outputDecimals) - feeAmount,
      priceImpactPct: data.priceImpactPct,
      swapInstructions,
    };
  } catch (error) {
    console.error('Error getting swap quote:', error);
    throw error;
  }
}

/**
 * Create a swap transaction
 * 
 * @param quote Swap quote with instructions
 * @param walletPublicKey User's wallet public key
 * @returns Transaction object ready to be signed
 */
export function createSwapTransaction(
  quote: SwapQuote,
  walletPublicKey: string
): Transaction {
  try {
    const transaction = new Transaction();
    
    // Add all swap instructions to the transaction
    quote.swapInstructions.forEach(instruction => {
      transaction.add(instruction);
    });
    
    // Set the fee payer
    transaction.feePayer = new PublicKey(walletPublicKey);
    
    return transaction;
  } catch (error) {
    console.error('Error creating swap transaction:', error);
    throw error;
  }
}

/**
 * Default configuration for development
 */
export const DEFAULT_SWAP_CONFIG: SwapConfig = {
  treasuryWalletPublicKey: process.env.NEXT_PUBLIC_TREASURY_WALLET || '',
  feePercentage: 0.5, // 0.5% fee
  feesEnabled: false, // Disabled by default as requested
  jupiterApiEndpoint: 'https://quote-api.jup.ag/v6',
}; 