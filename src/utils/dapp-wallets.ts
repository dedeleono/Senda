import { AnchorProvider, Program, Idl, setProvider } from '@coral-xyz/anchor';
import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js';
import { SENDA_IDL, SendaDapp } from "@/lib/IDL/sendaIDL";
import { prisma } from '@/lib/db';
import { TRPCError } from '@trpc/server';
import { getSharedConnection } from '@/lib/senda/helpers';

type SendaProgram = Program<SendaDapp>;

interface LoadedKeypair {
  publicKey: PublicKey;
  keypair: Keypair;
}

export function loadFeePayerKeypair(): { keypair: Keypair; publicKey: PublicKey } {
  if (typeof window !== 'undefined') {
    throw new Error('This function should only be called server-side');
  }

  const feePayerSecret = process.env.FEE_PAYER_SECRET_KEY;
  if (!feePayerSecret) {
    throw new Error('FEE_PAYER_SECRET_KEY not found in environment');
  }

  try {
    // Parse the array string into actual numbers
    const secretKeyArray = JSON.parse(feePayerSecret);
    const secretKey = Uint8Array.from(secretKeyArray);
    const keypair = Keypair.fromSecretKey(secretKey);

    const expectedPublicKey = process.env.NEXT_PUBLIC_FEE_PAYER_WALLET;
    if (expectedPublicKey && keypair.publicKey.toBase58() !== expectedPublicKey) {
      throw new Error('Fee payer keypair does not match expected public key');
    }

    return {
      keypair,
      publicKey: keypair.publicKey
    };
  } catch (error) {
    throw new Error(`Failed to load fee payer keypair: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function getFeePayerPublicKey(): PublicKey {

  try {
    
    const expectedPublicKey = process.env.NEXT_PUBLIC_FEE_PAYER_WALLET!;

    return new PublicKey(expectedPublicKey);
  } catch (error) {
    throw new Error(`Failed to load fee payer keypair: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function getProvider(): {
  connection: Connection;
  provider: AnchorProvider;
  program: SendaProgram;
  feePayer: Keypair;
} {
  const { keypair: feePayer } = loadFeePayerKeypair();
  const rpcUrl = process.env.SOLANA_RPC_URL!;
  const connection = getSharedConnection()

  const wallet = {
    publicKey: feePayer.publicKey,
    signTransaction: async (tx: Transaction) => {
      tx.partialSign(feePayer);
      return tx;
    },
    signAllTransactions: async (txs: Transaction[]) => {
      txs.forEach((tx) => tx.partialSign(feePayer));
      return txs;
    }
  };

  const provider = new AnchorProvider(
    connection as any,
    wallet as any,
    AnchorProvider.defaultOptions()
  );

  setProvider(provider);

  const program = new Program<SendaDapp>(
    SENDA_IDL as unknown as Idl,
    provider as any
  );

  return { connection, provider, program, feePayer };
}

async function decryptViaEndpoint(encryptedData: {
  iv: string;
  authTag: string;
  data: string;
}): Promise<Buffer> {
  const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL!}/api/decrypt`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ encryptedData }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.details || 'Failed to decrypt data');
  }

  const result = await response.json();
  return Buffer.from(result.decrypted, 'base64');
}

export async function loadSignerKeypair(
  userId: string,
  requestedPk: PublicKey
): Promise<LoadedKeypair> {
  const { keypair: feePayerKp } = loadFeePayerKeypair();
  if (feePayerKp.publicKey.equals(requestedPk)) {
    return { keypair: feePayerKp, publicKey: feePayerKp.publicKey };
  }

  const walletRow = await prisma.linkedWallet.findFirst({
    where: {
      userId,
      publicKey: requestedPk.toBase58()
    },
    select: {
      user: {
        select: {
          encryptedPrivateKey: true,
          iv: true,
          authTag: true
        }
      }
    }
  });

  if (!walletRow?.user?.encryptedPrivateKey) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "The requested signer is not linked to your account"
    });
  }

  const secretBuffer = await decryptViaEndpoint({
    iv: walletRow.user.iv,
    authTag: walletRow.user.authTag,
    data: walletRow.user.encryptedPrivateKey
  });

  const keypair = Keypair.fromSecretKey(secretBuffer);
  if (!keypair.publicKey.equals(requestedPk)) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Decrypted key does not match requested signer"
    });
  }

  return { keypair, publicKey: keypair.publicKey };
}

export async function loadUserSignerKeypair(
  userId: string,
): Promise<LoadedKeypair> {
  const walletRow = await prisma.user.findFirst({
    where: {
      id: userId,
    },
    select: {
      encryptedPrivateKey: true,
      iv: true,
      authTag: true
    }
  });

  if (!walletRow?.encryptedPrivateKey || !walletRow.iv || !walletRow.authTag) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "No wallet found for this user"
    });
  }

  const secretBuffer = await decryptViaEndpoint({
    iv: walletRow.iv,
    authTag: walletRow.authTag,
    data: walletRow.encryptedPrivateKey
  });

  const keypair = Keypair.fromSecretKey(secretBuffer);
  return { keypair, publicKey: keypair.publicKey };
}