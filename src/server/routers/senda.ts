import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import {
    PublicKey,
    SystemProgram,
    SYSVAR_RENT_PUBKEY,
    Keypair
} from "@solana/web3.js";
import {
    AnchorProvider,
    BN
} from "@coral-xyz/anchor";

import {
    findVaultPDA,
    findDepositRecordPDA,
    createAta,
    findEscrowPDA
} from "@/lib/senda/helpers";
import { USDC_MINT, USDT_MINT } from "@/lib/constants";
import {
    ASSOCIATED_TOKEN_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    getAssociatedTokenAddressSync,
    getOrCreateAssociatedTokenAccount
} from "@solana/spl-token";
import { TRPCError } from "@trpc/server";
import { getProvider, loadSignerKeypair, loadUserSignerKeypair } from "@/utils/dapp-wallets";
import { prisma } from "@/lib/db";
import crypto from 'crypto';
import { encryptPrivateKey } from "@/lib/utils/crypto";
import { UserService } from "../services/user";
import { EscrowService } from "../services/escrow";
import { handleRouterError } from "../utils/error-handler";
import { CreateDepositResponse } from "@/types/transaction";
import { DepositAccounts, InitEscrowAccounts } from "@/types/senda-program";


export const sendaRouter = router({
    
    getFactoryStats: publicProcedure
        .input(z.object({ owner: z.string().optional() }))
        .query(async ({ input }) => {
            const { connection, program } = getProvider();
            const ownerPub = input.owner
                ? new PublicKey(input.owner)
                : program.provider.publicKey;

            if (!ownerPub) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "Owner public key is required"
                });
            }

            const [factoryPda] = PublicKey.findProgramAddressSync(
                [Buffer.from("factory"), ownerPub.toBuffer()],
                program.programId
            );

            const acct = await connection.getAccountInfo(factoryPda);
            if (!acct) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "Factory not initialised"
                });
            }

            return { address: factoryPda.toBase58(), raw: acct.data.toString("base64") };
        }),

    initEscrow: protectedProcedure
        .input(
            z.object({
                sender: z.string(),
                receiver: z.string(),
                seed: z.number().optional().default(0)
            })
        )
        .mutation(async ({ ctx, input }) => {
            try {
                const { program, feePayer, connection } = getProvider();

                const senderPk = new PublicKey(input.sender);
                const receiverPk = new PublicKey(input.receiver);

                const usdcMint = new PublicKey(USDC_MINT);
                const usdtMint = new PublicKey(USDT_MINT);

                // sender ATAs
                await createAta(usdcMint, senderPk);
                await createAta(usdtMint, senderPk);

                // receiver ATAs
                await createAta(usdcMint, receiverPk);
                await createAta(usdtMint, receiverPk);

                const [escrowPda] = PublicKey.findProgramAddressSync(
                    [Buffer.from("escrow"), senderPk.toBuffer(), receiverPk.toBuffer()],
                    program.programId
                );

                // Check if escrow already exists
                const escrowAccount = await connection.getAccountInfo(escrowPda);
                if (escrowAccount !== null) {
                    return { signature: "", escrow: escrowPda.toBase58() };
                }

                const tx = await program.methods
                    .initializeEscrow(new BN(input.seed))
                    .accounts({
                        feePayer: feePayer.publicKey,
                        sender: senderPk,
                        receiver: receiverPk,
                        usdcMint,
                        usdtMint,
                    } as InitEscrowAccounts)
                    .transaction();

                const { keypair: senderKp } = await loadUserSignerKeypair(
                    ctx.session!.user.id
                );

                const sig = await (program.provider as AnchorProvider).sendAndConfirm(tx, [senderKp, feePayer]);

                return { signature: sig, escrow: escrowPda.toBase58() };
            } catch (error) {
                console.error('Error in initEscrow:', error);
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: error instanceof Error ? error.message : 'Failed to initialize escrow',
                    cause: error
                });
            }
        }),

    createDeposit: protectedProcedure
        .input(
            z.object({
                userId: z.string(),
                depositor: z.string(),
                recipientEmail: z.string().email(),
                stable: z.enum(["usdc", "usdt"]),
                authorization: z.enum(["sender", "receiver", "both"]),
                amount: z.number().positive()
            })
        )
        .mutation(async ({ ctx, input }): Promise<CreateDepositResponse> => {

            const usdcMint = new PublicKey(USDC_MINT);
            const usdtMint = new PublicKey(USDT_MINT);

            try {
                const userResult = await UserService.getOrCreateUser(input.recipientEmail);
                if (!userResult.success || !userResult.data) {
                    throw new Error(userResult.error?.message || 'Failed to get or create user');
                }
                const receiver = userResult.data;

                const escrowResult = await EscrowService.initializeEscrow(
                    input.userId,
                    input.depositor,
                    receiver.publicKey,
                    0
                );
                if (!escrowResult.success || !escrowResult.data) {
                    throw new Error(escrowResult.error?.message || 'Failed to initialize escrow');
                }
                const escrowData = escrowResult.data;

                const { program, feePayer } = getProvider();
                const depositorPk = new PublicKey(input.depositor);
                const counterpartyPk = new PublicKey(receiver.publicKey);

                const [escrowPda] = findEscrowPDA(
                    depositorPk,
                    counterpartyPk,
                    program.programId
                );

                // Get next deposit index, defaulting to 0 if escrow was just initialized
                let nextDepositIdx = 0;
                try {
                    const escrowAccount = await program.account.escrow.fetch(escrowPda);
                    nextDepositIdx = escrowAccount.depositCount.toNumber();
                } catch (error) {
                    // If escrow account doesn't exist, it means it was just initialized
                    // so we can safely use deposit index 0
                    if (!(error instanceof Error) || !error.message.includes('Account does not exist')) {
                        console.log('Error fetching escrow account:', error);
                    }
                }

                const [depositRecordPda] = findDepositRecordPDA(
                    escrowPda,
                    nextDepositIdx,
                    program.programId
                );

                const stableEnum = input.stable === "usdc" ? { usdc: {} } : { usdt: {} };
                const authEnum =
                    input.authorization === "sender"
                        ? { sender: {} }
                        : input.authorization === "receiver"
                            ? { receiver: {} }
                            : { both: {} };

                const lamports = Math.round(input.amount * 1_000_000);

                const tx = await program.methods
                    .deposit(stableEnum as any, authEnum as any, new BN(lamports))
                    .accounts({
                        escrow: escrowPda,
                        depositor: depositorPk,
                        counterparty: counterpartyPk,
                        usdcMint: usdcMint,
                        usdtMint: usdtMint,
                        depositRecord: depositRecordPda,
                        feePayer: feePayer.publicKey,
                    } as DepositAccounts)
                    .transaction();
                    
                const { keypair: depositor } = await loadUserSignerKeypair(
                    ctx.session!.user.id
                );

                const signature = await program.provider.sendAndConfirm!(tx, [feePayer, depositor]);

                // 6. Create DB records
                const { transaction, deposit } = await prisma.$transaction(async (tx) => {
                    const txn = await tx.transaction.create({
                        data: {
                            userId: ctx.session.user.id,
                            walletPublicKey: input.depositor,
                            destinationAddress: receiver.publicKey,
                            amount: input.amount,
                            status: 'PENDING',
                            type: 'TRANSFER',
                        },
                        select: {
                            id: true,
                            status: true
                        }
                    });

                    // Create or update escrow record
                    await tx.escrow.upsert({
                        where: {
                            id: escrowData.escrowAddress
                        },
                        create: {
                            id: escrowData.escrowAddress,
                            senderPublicKey: input.depositor,
                            receiverPublicKey: receiver.publicKey,
                            depositedUsdc: 0,
                            depositedUsdt: 0,
                            depositCount: 0,
                            state: 'Active'
                        },
                        update: {}
                    });

                    const dep = await tx.depositRecord.create({
                        data: {
                            depositIndex: nextDepositIdx,
                            amount: input.amount,
                            policy: input.authorization === 'both' ? 'DUAL' : 'SINGLE',
                            stable: input.stable,
                            signatures: [signature],
                            state: 'PENDING',
                            userId: ctx.session.user.id,
                            escrowId: escrowData.escrowAddress,
                            transactionId: txn.id
                        },
                    });

                    return { transaction: txn, deposit: dep };
                });

                // 7. Send notification email
                await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/email/send`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        template: receiver.role === 'GUEST' ? "GuestDepositNotification" : "DepositNotification",
                        data: {
                            email: input.recipientEmail,
                            amount: input.amount.toFixed(2),
                            token: input.stable.toUpperCase(),
                            senderEmail: ctx.session.user.email
                        }
                    }),
                });

                return {
                    success: true,
                    data: {
                        signature,
                        escrowAddress: escrowData.escrowAddress,
                        depositId: deposit.id,
                        user: {
                            id: receiver.id,
                            publicKey: receiver.publicKey,
                            role: receiver.role
                        },
                        transaction: {
                            id: transaction.id,
                            status: transaction.status
                        }
                    }
                };

            } catch (error) {
                console.error('Error in createDeposit:', error);
                return {
                    success: false,
                    error: handleRouterError(error)
                };
            }
        }),

    cancelDeposit: protectedProcedure
        .input(
            z.object({
                escrow: z.string(),
                originalDepositor: z.string(),
                counterparty: z.string(),
                depositIdx: z.number().int().nonnegative()
            })
        )
        .mutation(async ({ ctx, input }) => {
            const { program, feePayer } = getProvider();

            const escrowPk = new PublicKey(input.escrow);
            const depositorPk = new PublicKey(input.originalDepositor);
            const counterpartyPk = new PublicKey(input.counterparty);

            const { keypair: depositorKp } = await loadSignerKeypair(
                ctx.session!.user.id,
                depositorPk
            );

            const usdcMint = new PublicKey(USDC_MINT);
            const usdtMint = new PublicKey(USDT_MINT);

            const [vaultUsdc] = findVaultPDA(escrowPk, usdcMint, "usdc", program.programId);
            const [vaultUsdt] = findVaultPDA(escrowPk, usdtMint, "usdt", program.programId);

            const depositorUsdcAta = await getAssociatedTokenAddressSync(usdcMint, depositorPk);
            const depositorUsdtAta = await getAssociatedTokenAddressSync(usdtMint, depositorPk);

            const [depositRecord] = findDepositRecordPDA(
                escrowPk,
                input.depositIdx,
                program.programId
            );

            const tx = await program.methods
                .cancel(new BN(input.depositIdx))
                .accounts({
                    escrow: escrowPk,
                    originalDepositor: depositorPk,
                    counterparty: counterpartyPk,
                    depositorUsdcAta,
                    depositorUsdtAta,
                    usdcMint,
                    usdtMint,
                    vaultUsdc,
                    vaultUsdt,
                    depositRecord,
                    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                    rent: SYSVAR_RENT_PUBKEY
                } as any)
                .transaction();

            const sig = await (program.provider as AnchorProvider).sendAndConfirm(tx, [feePayer, depositorKp]);

            return { signature: sig };
        }),

    requestWithdrawal: protectedProcedure
        .input(
            z.object({
                escrow: z.string(),
                originalDepositor: z.string(),
                counterparty: z.string(),
                receivingParty: z.string(),
                authorizedSigner: z.string(),
                depositIdx: z.number().int().nonnegative()
            })
        )
        .mutation(async ({ ctx, input }) => {
            const { program, feePayer } = getProvider();

            const escrowPk = new PublicKey(input.escrow);
            const depositorPk = new PublicKey(input.originalDepositor);
            const counterpartyPk = new PublicKey(input.counterparty);
            const recvPk = new PublicKey(input.receivingParty);
            const authSignerPk = new PublicKey(input.authorizedSigner);

            const { keypair: signerKp } = await loadSignerKeypair(
                ctx.session!.user.id,
                authSignerPk
            );

            const usdcMint = new PublicKey(USDC_MINT);
            const usdtMint = new PublicKey(USDT_MINT);

            const [vaultUsdc] = findVaultPDA(escrowPk, usdcMint, "usdc", program.programId);
            const [vaultUsdt] = findVaultPDA(escrowPk, usdtMint, "usdt", program.programId);

            const depositorUsdcAta = await getAssociatedTokenAddressSync(usdcMint, depositorPk);
            const depositorUsdtAta = await getAssociatedTokenAddressSync(usdtMint, depositorPk);
            const counterpartyUsdcAta = await getAssociatedTokenAddressSync(
                usdcMint,
                counterpartyPk
            );
            const counterpartyUsdtAta = await getAssociatedTokenAddressSync(
                usdtMint,
                counterpartyPk
            );

            const [depositRecord] = findDepositRecordPDA(
                escrowPk,
                input.depositIdx,
                program.programId
            );

            const tx = await program.methods
                .release(new BN(input.depositIdx))
                .accounts({
                    escrow: escrowPk,
                    originalDepositor: depositorPk,
                    counterparty: counterpartyPk,
                    authorizedSigner: authSignerPk,
                    receivingParty: recvPk,
                    depositorUsdcAta,
                    depositorUsdtAta,
                    counterpartyUsdcAta,
                    counterpartyUsdtAta,
                    usdcMint,
                    usdtMint,
                    vaultUsdc,
                    vaultUsdt,
                    depositRecord,
                    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                    rent: SYSVAR_RENT_PUBKEY
                } as any)
                .transaction();

            const sig = await (program.provider as AnchorProvider).sendAndConfirm(tx, [feePayer, signerKp]);

            return { signature: sig };
        })
});

export default sendaRouter;