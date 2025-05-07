import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth/auth';
import { prisma } from '@/lib/db';
import { 
  Connection, 
  Transaction, 
  PublicKey, 
  sendAndConfirmTransaction, 
  Keypair 
} from '@solana/web3.js';

const requestSchema = z.object({
  serializedTransaction: z.string(),
  walletPublicKey: z.string().min(32).max(44),
});

export async function POST(request: Request) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized access' },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    const validatedData = requestSchema.parse(body);
    
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        sendaWalletPublicKey: true,
        encryptedPrivateKey: true,
        iv: true,
        authTag: true,
      },
    });
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    if (user.sendaWalletPublicKey !== validatedData.walletPublicKey) {
      return NextResponse.json(
        { error: 'Wallet verification failed' },
        { status: 403 }
      );
    }
    
    // Decrypt the private key - @todo implement decryption with endpoint
    const privateKey = await decryptPrivateKey(
      user.encryptedPrivateKey,
      user.iv,
      user.authTag,
      process.env.ENCRYPTION_KEY || ''
    );
    
    // Create a keypair from the private key
    const keypair = Keypair.fromSecretKey(Buffer.from(privateKey));
    
    // Deserialize the transaction
    const serializedTransaction = Buffer.from(validatedData.serializedTransaction, 'base64');
    const transaction = Transaction.from(serializedTransaction);
    
    // Create a connection to the Solana network
    const endpoint = process.env.NEXT_PUBLIC_SOLANA_NETWORK === 'mainnet'
      ? process.env.SOLANA_MAINNET_RPC || 'https://api.mainnet-beta.solana.com'
      : process.env.SOLANA_DEVNET_RPC || 'https://api.devnet.solana.com';
    
    const connection = new Connection(endpoint, 'confirmed');
    
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [keypair]
    );
    
    await prisma.transaction.create({
      data: {
        userId: session.user.id,
        walletPublicKey: user.sendaWalletPublicKey,
        amount: 0,
        status: 'COMPLETED',
        type: 'TRANSFER',
        signatureType: 'SINGLE',
      },
    });
    
    return NextResponse.json({ 
      success: true,
      signature,
    });
  } catch (error) {
    console.error('Error executing swap:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to execute swap' },
      { status: 500 }
    );
  }
}