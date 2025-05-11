import { TransactionInstruction, Connection, Keypair, Transaction, sendAndConfirmTransaction, VersionedTransaction, PublicKey } from '@solana/web3.js';
import { TRPCError } from '@trpc/server';
import bs58 from 'bs58';

const SOLANA_RPC_URL = 'https://api.devnet.solana.com';//@todo change to mainnet
const connection = new Connection(SOLANA_RPC_URL);

const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY || ''; //@todo

export interface TransactionRequest {
  userId: string;
  instructions: TransactionInstruction[];
  legacyTransaction?: boolean;
}

export type TransactionResult = {
    success: boolean;
    signature?: string;
    error?: Error;
    message?: string;
    escrowPublicKey?: string;
};

export const prepareInstruction = (instruction: TransactionInstruction): any => {
  interface PreparedInstruction {
    keys: Array<{
      pubkey: string;
      isSigner: boolean;
      isWritable: boolean;
    }>;
    programId: string;
    data: string;
  }
  
  const prepared: PreparedInstruction = {
    keys: instruction.keys.map(key => ({
      pubkey: key.pubkey.toString(),
      isSigner: key.isSigner,
      isWritable: key.isWritable
    })),
    programId: instruction.programId.toString(),
    data: Buffer.from(instruction.data).toString('base64')
  };
  
  return prepared;
};

export const prepareInstructions = (instructions: TransactionInstruction[]): any[] => {
  return instructions.map(instruction => prepareInstruction(instruction));
};

export const signAndSendTransaction = async (request: TransactionRequest): Promise<TransactionResult> => {
  try {
    if (!ADMIN_PRIVATE_KEY) {
      throw new Error('Admin private key not configured');
    }
    const adminKeypair = Keypair.fromSecretKey(
      Buffer.from(bs58.decode(ADMIN_PRIVATE_KEY))
    );

    const { instructions, legacyTransaction = false } = request;

    if (legacyTransaction) {
      const transaction = new Transaction();
      transaction.add(...instructions);
      transaction.feePayer = adminKeypair.publicKey;
      transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      const signature = await sendAndConfirmTransaction(
        connection,
        transaction,
        [adminKeypair],
        { commitment: 'confirmed' }
      );

      return { success: true, signature, message: 'success' };
    } else {
      const latestBlockhash = await connection.getLatestBlockhash();
      
      const transaction = new Transaction();
      instructions.forEach(instruction => transaction.add(instruction));
      transaction.feePayer = adminKeypair.publicKey;
      transaction.recentBlockhash = latestBlockhash.blockhash;
      
      const messageV0 = transaction.compileMessage();
      const versionedTransaction = new VersionedTransaction(messageV0);
      versionedTransaction.sign([adminKeypair]);
      
      const signature = await connection.sendTransaction(versionedTransaction);
      await connection.confirmTransaction({
        signature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
      });
      
      return { success: true, signature, message: 'success' };
    }
  } catch (error) {
    console.error('Transaction signing error:', error);
    const typedError = error instanceof Error ? error : new Error(String(error));
    return { 
      success: false,
      message: 'error', 
      signature: undefined,
      error: typedError
    };
  }
};

export const executeTransaction = async (
  connection: Connection, 
  wallet: { publicKey: PublicKey; signTransaction: (transaction: Transaction) => Promise<Transaction> },
  instructions: TransactionInstruction[]
): Promise<TransactionResult> => {
  try {
    if (!wallet || !wallet.publicKey) {
      throw new Error('Wallet not connected');
    }
    
    const transaction = new Transaction();
    instructions.forEach(instruction => transaction.add(instruction));
    
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.lastValidBlockHeight = lastValidBlockHeight;
    transaction.feePayer = wallet.publicKey;
    
    const signedTransaction = await wallet.signTransaction(transaction);
    
    const signature = await connection.sendRawTransaction(signedTransaction.serialize());
    
    await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight
    });
    
    return {
      success: true,
      signature,
      message: 'Transaction successful'
    };
  } catch (error) {
    console.error('Transaction execution error:', error);
    const typedError = error instanceof Error ? error : new Error(String(error));
    return {
      success: false,
      message: 'Transaction failed',
      error: typedError
    };
  }
}; 