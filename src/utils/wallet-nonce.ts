import { randomBytes } from 'crypto';
import { PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { prisma } from '@/lib/db';

const NONCE_EXPIRY_MINUTES = 5;

export async function generateNonce(publicKey: string): Promise<string> {
  console.log(`Generating nonce for wallet: ${publicKey.slice(0, 10)}...`);
  
  try {
    const deleteResult = await prisma.authNonce.deleteMany({
      where: {
        expires: {
          lt: new Date()
        }
      }
    });
    console.log(`Cleaned up ${deleteResult.count} expired nonces`);
  } catch (error) {
    console.error("Error cleaning up expired nonces:", error);
  }

  try {
    const existingNonce = await prisma.authNonce.findFirst({
      where: {
        publicKey,
        expires: {
          gt: new Date()
        }
      }
    });

    if (existingNonce) {
      console.log(`Found existing valid nonce for ${publicKey.slice(0, 10)}...`);
      return existingNonce.nonce;
    }

    const nonce = randomBytes(32).toString('hex');
    const expiryDate = new Date();
    expiryDate.setMinutes(expiryDate.getMinutes() + NONCE_EXPIRY_MINUTES);

    console.log(`Creating new nonce for ${publicKey.slice(0, 10)}... expiring at ${expiryDate.toISOString()}`);
    
    const createdNonce = await prisma.authNonce.create({
      data: {
        publicKey,
        nonce,
        expires: expiryDate
      }
    });
    
    console.log(`Successfully created nonce record with ID: ${createdNonce.id}`);

    return nonce;
  } catch (error) {
    console.error("Error generating or retrieving nonce:", error);
    throw error;
  }
}

export async function verifySignature(
  publicKey: string,
  message: string,
  signature: string
): Promise<boolean> {
  try {
    console.log(`Verifying signature for ${publicKey.slice(0, 10)}... with nonce ${message.slice(0, 10)}...`);
    
    const nonceRecord = await prisma.authNonce.findFirst({
      where: {
        publicKey,
        nonce: message,
        expires: {
          gt: new Date()
        }
      }
    });

    if (!nonceRecord) {
      console.log("No valid nonce record found");
      return false;
    }

    console.log("Valid nonce record found, proceeding with signature verification");

    try {
      const publicKeyBytes = new PublicKey(publicKey).toBytes();
      const messageBytes = new TextEncoder().encode(message);
      const signatureBytes = bs58.decode(signature);

      const isValid = nacl.sign.detached.verify(
        messageBytes,
        signatureBytes,
        publicKeyBytes
      );
      
      console.log(`Signature verification result: ${isValid ? 'VALID' : 'INVALID'}`);
      
      return isValid;
    } catch (cryptoError) {
      console.error('Crypto operation error during verification:', cryptoError);
      return false;
    }
  } catch (error) {
    console.error('Database error in signature verification:', error);
    return false;
  }
}

export async function cleanupNonce(publicKey: string, nonce: string): Promise<void> {
  try {
    console.log(`Cleaning up nonce for wallet ${publicKey.slice(0, 10)}...`);
    
    const deleteResult = await prisma.authNonce.deleteMany({
      where: {
        publicKey,
        nonce
      }
    });
    
    console.log(`Deleted ${deleteResult.count} nonce records`);
  } catch (error) {
    console.error("Error cleaning up nonce:", error);
  }
} 