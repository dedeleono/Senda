import { router, protectedProcedure, publicProcedure } from "../trpc";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { Keypair } from "@solana/web3.js";
import { encryptPrivateKey } from "@/lib/utils/crypto";
import { GuestService } from "../services/guest";
import { TRPCError } from "@trpc/server";

const userRouter = router({
    getUserById: protectedProcedure.input(z.object({ userId: z.string() })).query(async ({ input }) => {
        return prisma.user.findUnique({ where: { id: input.userId }, select: { email: true, sendaWalletPublicKey: true, iv: true, authTag: true, encryptedPrivateKey: true } });
    }),
    getUserByEmail: protectedProcedure.input(z.object({ email: z.string() })).query(async ({ input }) => {
        return prisma.user.findUnique({ where: { email: input.email }, select: { id: true, role: true } });
    }),
    getUserPaths: protectedProcedure.input(z.object({
        userId: z.string()
    })).query(async ({ input }) => {
        const user = await prisma.user.findUnique({
            where: { id: input.userId },
            select: { sendaWalletPublicKey: true }
        });

        if (!user) {
            throw new Error("User not found");
        }

        const paths = await prisma.escrow.findMany({
            where: {
                OR: [
                    { senderPublicKey: user.sendaWalletPublicKey },
                    { receiverPublicKey: user.sendaWalletPublicKey }
                ],
                state: "Active" // Only get active escrows
            },
            select: {
                id: true,
                senderPublicKey: true,
                receiverPublicKey: true,
                depositedUsdc: true,
                depositedUsdt: true,
                depositCount: true,
                state: true,
                createdAt: true,
                sender: {
                    select: {
                        email: true,
                        name: true,
                    }
                },
                receiver: {
                    select: {
                        email: true,
                        name: true,
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        return paths;
    }),
    createMinimalUser: protectedProcedure.input(z.object({ recipientEmail: z.string().email() })).mutation(async ({ input }) => {
        const { recipientEmail } = input;
        const keypair = Keypair.generate();
        const secretBuffer = Buffer.from(keypair.secretKey);

        const { iv, authTag, data: encryptedPrivateKey } = encryptPrivateKey(secretBuffer);

        const newUser = await prisma.user.create({
            data: {
                email: recipientEmail,
                sendaWalletPublicKey: keypair.publicKey.toString(),
                encryptedPrivateKey,
                iv,
                authTag,
                role: "GUEST",
            },
        });
        return newUser;
    }),
    verifyInvitation: publicProcedure
        .input(z.object({
            token: z.string()
        }))
        .query(async ({ input }) => {
            try {
                const verificationToken = await prisma.verificationToken.findUnique({
                    where: { token: input.token },
                });

                if (!verificationToken) {
                    throw new TRPCError({
                        code: 'NOT_FOUND',
                        message: 'Invalid token'
                    });
                }

                if (new Date() > verificationToken.expires) {
                    throw new TRPCError({
                        code: 'BAD_REQUEST',
                        message: 'Token has expired'
                    });
                }

                // Get the deposit information associated with this token
                const deposit = await prisma.depositRecord.findFirst({
                    where: {
                        userId: verificationToken.identifier
                    },
                    orderBy: {
                        createdAt: 'desc'
                    },
                    select: {
                        amount: true,
                        stable: true
                    }
                });

                return {
                    success: true,
                    data: {
                        email: verificationToken.identifier,
                        amount: deposit?.amount.toString(),
                        token: deposit?.stable
                    }
                };
            } catch (error) {
                console.error("Error verifying invitation:", error);
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: error instanceof Error ? error.message : 'Failed to verify invitation'
                });
            }
        })
});

export default userRouter;
