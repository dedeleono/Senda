import { PublicKey } from '@solana/web3.js';
import { BN, AnchorProvider } from '@coral-xyz/anchor';
import { USDC_MINT, USDT_MINT } from '@/lib/constants';
import { InitEscrowAccounts } from '@/types/senda-program';
import { loadUserSignerKeypair, getProvider } from '@/utils/dapp-wallets';
import { createAta } from '@/lib/senda/helpers';

export interface EscrowData {
  escrowAddress: string;
  senderPublicKey: string;
  receiverPublicKey: string;
  signature?: string;
}

export interface EscrowServiceResponse {
  success: boolean;
  data?: EscrowData;
  error?: {
    code: string;
    message: string;
    details: unknown;
  };
}

export class EscrowService {
  static async initializeEscrow(
    userId: string,
    senderPublicKey: string,
    receiverPublicKey: string,
    seed: number
  ): Promise<EscrowServiceResponse> {
    try {

      if (!userId || typeof userId !== 'string') {
        throw new Error('Invalid userId provided');
      }
      if (!senderPublicKey || typeof senderPublicKey !== 'string') {
        throw new Error('Invalid senderPublicKey provided');
      }
      if (!receiverPublicKey || typeof receiverPublicKey !== 'string') {
        throw new Error('Invalid receiverPublicKey provided');
      }

      if (!PublicKey.isOnCurve(new PublicKey(senderPublicKey))) {
        throw new Error('Invalid senderPublicKey format');
      }
      if (!PublicKey.isOnCurve(new PublicKey(receiverPublicKey))) {
        throw new Error('Invalid receiverPublicKey format');
      }

      const senderPk = new PublicKey(senderPublicKey);
      const receiverPk = new PublicKey(receiverPublicKey);
      
      const { program, feePayer } = getProvider();
      if (!program || !feePayer) {
        throw new Error('Provider not properly initialized');
      }

      const usdcMint = new PublicKey(USDC_MINT);
      const usdtMint = new PublicKey(USDT_MINT);

      // Find escrow PDA
      const [escrowPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("escrow"), senderPk.toBuffer(), receiverPk.toBuffer()],
        program.programId
      );

      const escrowAccount = await program.provider.connection.getAccountInfo(escrowPda);
      if (escrowAccount !== null) {
        return {
          success: true,
          data: {
            escrowAddress: escrowPda.toBase58(),
            senderPublicKey,
            receiverPublicKey
          }
        };
      }

      // Sender ATAs
      await createAta(usdcMint, senderPk);
      await createAta(usdtMint, senderPk);

      // Receiver ATAs
      await createAta(usdcMint, receiverPk);
      await createAta(usdtMint, receiverPk);

      const { keypair: senderKeypair } = await loadUserSignerKeypair(userId);

      const tx = await program.methods
        .initializeEscrow(new BN(seed))
        .accounts({
          feePayer: feePayer.publicKey,
          // escrow: escrowPda,
          sender: senderPk,
          receiver: receiverPk,
          usdcMint,
          usdtMint,
        } as InitEscrowAccounts)
        .transaction();

      const anchorProvider = program.provider as AnchorProvider;
      const txSignature = await anchorProvider.sendAndConfirm(tx, [feePayer, senderKeypair]);

      return {
        success: true,
        data: {
          escrowAddress: escrowPda.toBase58(),
          senderPublicKey,
          receiverPublicKey,
          signature: txSignature
        }
      };

    } catch (error) {
      console.error('Error in initializeEscrow:', error);
      return {
        success: false,
        error: {
          code: 'ESCROW_SERVICE_ERROR',
          message: error instanceof Error ? error.message : 'Failed to initialize escrow',
          details: error
        }
      };
    }
  }
} 