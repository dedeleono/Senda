import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import { prisma } from "@/lib/db";
import { TRPCError } from "@trpc/server";
import { generateNonce, verifySignature, cleanupNonce } from "@/utils/wallet-nonce";
import {
    signAndSendTransaction,
    TransactionRequest
} from "@/lib/utils/solana-transaction";
import { TransactionInstruction, PublicKey, Keypair } from "@solana/web3.js";
import { encryptPrivateKey } from "@/lib/utils/crypto";

const parseInstruction = (rawInstruction: any): TransactionInstruction => {
    return new TransactionInstruction({
        keys: rawInstruction.keys.map((key: any) => ({
            pubkey: new PublicKey(key.pubkey),
            isSigner: key.isSigner,
            isWritable: key.isWritable
        })),
        programId: new PublicKey(rawInstruction.programId),
        data: Buffer.from(rawInstruction.data, 'base64')
    });
};

export const walletRouter = router({

    createWallet: protectedProcedure
        .mutation(async () => {
            try {
                // Generate new wallet
                const keypair = Keypair.generate();
                const secretBuffer = Buffer.from(keypair.secretKey);
                
                // Encrypt private key
                const { iv, authTag, data: encryptedPrivateKey } = encryptPrivateKey(secretBuffer);
                
                return {
                    success: true,
                    data: {
                        publicKey: keypair.publicKey.toString(),
                        encryptedPrivateKey,
                        iv,
                        authTag
                    }
                };
                
            } catch (error) {
                console.error('Error creating wallet:', error);
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to create wallet'
                });
            }
        }),

    generateNonce: protectedProcedure
        .input(z.object({ publicKey: z.string() }))
        .mutation(async ({ ctx, input }) => {
            try {
                console.log("Generate Nonce - Complete Session:", ctx.session);
                console.log("Generate Nonce - User Object:", ctx.session?.user);

                if (!ctx.session || !ctx.session.user) {
                    throw new TRPCError({
                        code: "UNAUTHORIZED",
                        message: "Authentication required",
                    });
                }

                const userId = ctx.session.user.id;
                const userEmail = ctx.session.user.email;

                console.log("Using identifier for nonce generation:", { userId, userEmail });

                let effectiveUserId = userId;

                if (!effectiveUserId && userEmail) {
                    console.log("Looking up user by email:", userEmail);
                    const user = await prisma.user.findUnique({
                        where: { email: userEmail }
                    });

                    if (user) {
                        effectiveUserId = user.id;
                        console.log("Found user by email:", effectiveUserId);
                    }
                }

                const nonce = await generateNonce(input.publicKey);
                return { nonce };
            } catch (error) {
                console.error("Failed to generate nonce:", error);
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "Failed to generate nonce",
                });
            }
        }),

    verifyAndLinkWallet: protectedProcedure
        .input(
            z.object({
                publicKey: z.string(),
                signature: z.string(),
                nonce: z.string(),
                provider: z.string().optional()
            })
        )
        .mutation(async ({ ctx, input }) => {
            try {
                console.log("Verify And Link - Complete Session:", ctx.session);
                console.log("Verify And Link - User Object:", ctx.session?.user);

                if (!ctx.session || !ctx.session.user) {
                    throw new TRPCError({
                        code: "UNAUTHORIZED",
                        message: "User not authenticated",
                    });
                }

                const userId = ctx.session.user.id;
                const userEmail = ctx.session.user.email;

                console.log("Using identifier for wallet linking:", { userId, userEmail });

                let effectiveUserId = userId;

                if (!effectiveUserId && userEmail) {
                    console.log("Looking up user by email:", userEmail);
                    const user = await prisma.user.findUnique({
                        where: { email: userEmail }
                    });

                    if (user) {
                        effectiveUserId = user.id;
                        console.log("Found user by email:", effectiveUserId);
                    } else {
                        throw new TRPCError({
                            code: "NOT_FOUND",
                            message: "User not found",
                        });
                    }
                } else if (!effectiveUserId) {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: "No user identifier available",
                    });
                }

                const isValid = await verifySignature(
                    input.publicKey,
                    input.nonce,
                    input.signature
                );

                if (!isValid) {
                    throw new TRPCError({
                        code: "UNAUTHORIZED",
                        message: "Invalid signature",
                    });
                }

                await cleanupNonce(input.publicKey, input.nonce);

                const existingWallet = await prisma.linkedWallet.findUnique({
                    where: {
                        publicKey: input.publicKey,
                    },
                });

                if (existingWallet) {
                    if (existingWallet.userId === effectiveUserId) {
                        return { success: true, walletId: existingWallet.id };
                    }

                    throw new TRPCError({
                        code: "CONFLICT",
                        message: "Wallet is already linked to another account",
                    });
                }

                console.log("Creating linkedWallet with userId:", effectiveUserId);

                const linkedWallet = await prisma.linkedWallet.create({
                    data: {
                        publicKey: input.publicKey,
                        userId: effectiveUserId,
                        provider: input.provider
                    },
                });

                return { success: true, walletId: linkedWallet.id };
            } catch (error) {
                console.error("Wallet linking error:", error);

                if (error instanceof TRPCError) {
                    throw error;
                }

                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "Failed to link wallet",
                });
            }
        }),

    removeLinkedWallet: protectedProcedure
        .input(
            z.object({
                walletPk: z.string()
            })
        )
        .mutation(async ({ ctx, input }) => {
            const userId = ctx.session.user.id;

            const wallet = await prisma.linkedWallet.findFirst({
                where: {
                    publicKey: input.walletPk,
                    userId,
                },
            });

            if (!wallet) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "Wallet not found or doesn't belong to you",
                });
            }

            await prisma.linkedWallet.delete({
                where: {
                    id: wallet.id,
                },
            });

            return { success: true };
        }),

    sendTransaction: protectedProcedure
        .input(z.object({
            instructions: z.array(z.object({
                keys: z.array(z.object({
                    pubkey: z.string(),
                    isSigner: z.boolean(),
                    isWritable: z.boolean()
                })),
                programId: z.string(),
                data: z.string()
            })),
            legacyTransaction: z.boolean().optional()
        }))
        .mutation(async ({ ctx, input }) => {
            if (!ctx.session?.user?.id) {
                throw new TRPCError({
                    code: "UNAUTHORIZED",
                    message: "User not authenticated"
                });
            }

            try {
                const instructions = input.instructions.map(parseInstruction);

                const transactionRequest: TransactionRequest = {
                    userId: ctx.session.user.id,
                    instructions,
                    legacyTransaction: input.legacyTransaction
                };

                const result = await signAndSendTransaction(transactionRequest);

                if (result.message === 'error') {
                    throw new TRPCError({
                        code: "INTERNAL_SERVER_ERROR",
                        message: result.message || "Transaction failed"
                    });
                }

                return {
                    signature: result.signature,
                    success: true
                };
            } catch (error) {
                console.error("Send transaction error:", error);
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: error instanceof Error ? error.message : "Unknown error sending transaction"
                });
            }
        }),

    isWalletLinked: protectedProcedure
        .input(z.object({ walletPublicKey: z.string() }))
        .query(async ({ ctx, input }) => {
            if (!ctx.session?.user?.id) {
                throw new TRPCError({
                    code: "UNAUTHORIZED",
                    message: "User not authenticated",
                });
            }

            const userId = ctx.session.user.id;

            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { sendaWalletPublicKey: true },
            });

            if (user?.sendaWalletPublicKey === input.walletPublicKey) {
                return true;
            }

            const linkedWallet = await prisma.linkedWallet.findFirst({
                where: {
                    userId,
                    publicKey: input.walletPublicKey,
                },
            });

            return !!linkedWallet;
        }),

    getUserMainWallet: protectedProcedure
        .query(async ({ ctx }) => {
            if (!ctx.session?.user?.id) {
                throw new TRPCError({
                    code: "UNAUTHORIZED",
                    message: "User not authenticated",
                });
            }

            const user = await prisma.user.findUnique({
                where: {
                    id: ctx.session.user.id,
                },
                select: {
                    sendaWalletPublicKey: true,
                },
            });

            return user?.sendaWalletPublicKey || null;
        }),

    findUserByWallet: protectedProcedure
        .input(z.object({ walletPublicKey: z.string() }))
        .query(async ({ input }) => {
            const mainWalletUser = await prisma.user.findUnique({
                where: { sendaWalletPublicKey: input.walletPublicKey },
                select: { id: true, email: true, iv: true, authTag: true, encryptedPrivateKey: true },
            });

            if (mainWalletUser) {
                return mainWalletUser.id;
            }

            const linkedWallet = await prisma.linkedWallet.findUnique({
                where: { publicKey: input.walletPublicKey },
                select: { userId: true },
            });

            return linkedWallet?.userId || null;
        }),

    verifyEscrowAccess: protectedProcedure
        .input(z.object({
            connectedWalletPublicKey: z.string(),
            escrowParticipantPublicKey: z.string()
        }))
        .query(async ({ input }) => {
            if (input.connectedWalletPublicKey === input.escrowParticipantPublicKey) {
                return true;
            }

            const user = await prisma.user.findUnique({
                where: { sendaWalletPublicKey: input.escrowParticipantPublicKey },
                select: { id: true },
            });

            if (!user) {
                return false;
            }

            const linkedWallet = await prisma.linkedWallet.findFirst({
                where: {
                    userId: user.id,
                    publicKey: input.connectedWalletPublicKey,
                },
            });

            return !!linkedWallet;
        }),

    getEscrowWalletFromConnected: protectedProcedure
        .input(z.object({ connectedWalletPublicKey: z.string() }))
        .query(async ({ input }) => {
            const mainWalletUser = await prisma.user.findUnique({
                where: { sendaWalletPublicKey: input.connectedWalletPublicKey },
                select: { sendaWalletPublicKey: true },
            });

            if (mainWalletUser) {
                return mainWalletUser.sendaWalletPublicKey;
            }
            const linkedWallet = await prisma.linkedWallet.findUnique({
                where: { publicKey: input.connectedWalletPublicKey },
                include: { user: { select: { sendaWalletPublicKey: true } } },
            });

            if (linkedWallet?.user) {
                return linkedWallet.user.sendaWalletPublicKey;
            }

            return null;
        }),

    getAllUserWallets: protectedProcedure
        .query(async ({ ctx }) => {
            if (!ctx.session?.user?.id) {
                throw new TRPCError({
                    code: "UNAUTHORIZED",
                    message: "User not authenticated",
                });
            }

            const userId = ctx.session.user.id;

            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { sendaWalletPublicKey: true },
            });

            const linkedWallets = await prisma.linkedWallet.findMany({
                where: { userId },
                select: {
                    id: true,
                    publicKey: true,
                    createdAt: true,
                    provider: true,
                },
            });

            const wallets = [];

            if (user?.sendaWalletPublicKey) {
                wallets.push({
                    id: 'senda-wallet',
                    publicKey: user.sendaWalletPublicKey,
                    linkedAt: new Date(0),
                    isMain: true
                });
            }

            linkedWallets.forEach(wallet => {
                wallets.push({
                    id: wallet.id,
                    publicKey: wallet.publicKey,
                    linkedAt: wallet.createdAt,
                    isMain: false,
                    provider: wallet.provider
                });
            });

            return wallets;
        }),
        
});

export default walletRouter;