
import { router, publicProcedure, protectedProcedure } from "../trpc";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Keypair } from "@solana/web3.js";
import { encryptPrivateKey } from "@/lib/utils/crypto";

const userRouter = router({
    getUserById: protectedProcedure.input(z.object({ userId: z.string() })).query(async ({ input }) => {
        return prisma.user.findUnique({ where: { id: input.userId }, select: { email: true, sendaWalletPublicKey: true, iv: true, authTag: true, encryptedPrivateKey: true } });
    }),
    getUserByEmail: protectedProcedure.input(z.object({ email: z.string() })).query(async ({ input }) => {
        return prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
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
                role: "INDIVIDUAL",
            },
        });
        return newUser;
    })
});

export default userRouter;
