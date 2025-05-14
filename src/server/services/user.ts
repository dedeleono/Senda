import { Keypair } from '@solana/web3.js';
import { prisma } from '@/lib/db';
import { UserServiceResponse } from '@/types/transaction';
import { encryptPrivateKey } from '@/lib/utils/crypto';
import crypto from 'crypto';

export class UserService {
  static async getOrCreateUser(email: string): Promise<UserServiceResponse> {
    try {

      let user = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          sendaWalletPublicKey: true,
          role: true
        }
      });

      if (user) {
        return {
          success: true,
          data: {
            id: user.id,
            email: user.email as string,
            publicKey: user.sendaWalletPublicKey,
            role: user.role
          }
        };
      }

      const keypair = Keypair.generate();
      const secretBuffer = Buffer.from(keypair.secretKey);
      
      const { iv, authTag, data: encryptedPrivateKey } = encryptPrivateKey(secretBuffer);

      user = await prisma.user.create({
        data: {
          email,
          sendaWalletPublicKey: keypair.publicKey.toString(),
          encryptedPrivateKey,
          iv,
          authTag,
          role: 'INDIVIDUAL',
        },
        select: {
          id: true,
          email: true,
          sendaWalletPublicKey: true,
          role: true
        }
      });

      const inviteToken = crypto.randomBytes(32).toString('hex');
      await prisma.verificationToken.create({
        data: {
          identifier: email,
          token: inviteToken,
          expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/email/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template: 'GuestInvitation',
          data: {
            email,
            inviteToken
          }
        }),
      });

      return {
        success: true,
        data: {
          id: user.id,
          email: user.email as string,
          publicKey: user.sendaWalletPublicKey,
          role: user.role
        }
      };

    } catch (error) {
      console.error('Error in getOrCreateUser:', error);
      return {
        success: false,
        error: {
          code: 'USER_SERVICE_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get or create user',
          details: error
        }
      };
    }
  }
} 