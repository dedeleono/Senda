import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import {
    PublicKey,
    SystemProgram,
    SYSVAR_RENT_PUBKEY,
    Keypair,
    Transaction
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
import { DepositAccounts, InitEscrowAccounts, ReleaseResult } from "@/types/senda-program";
import { sendGuestDepositNotificationEmail } from "@/lib/validations/guest-deposit-notification";
import { sendDepositNotificationEmail } from "@/lib/validations/deposit-notification";
import { SignatureType } from "@/components/transactions/transaction-card";
import { createTransferCheckedInstruction } from "@solana/spl-token";


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
                authorization: z.enum(["SENDER", "RECEIVER", "DUAL"]),
                amount: z.number().positive()
            })
        )
        .mutation(async ({ ctx, input }): Promise<CreateDepositResponse> => {
            console.log('Starting createDeposit with input:', {
                ...input,
                userId: '[REDACTED]' // Don't log sensitive data
            });

            const usdcMint = new PublicKey(USDC_MINT);
            const usdtMint = new PublicKey(USDT_MINT);

            try {
                console.log('Getting or creating user...');
                const userResult = await UserService.getOrCreateUser(input.recipientEmail);
                if (!userResult.success || !userResult.data) {
                    console.error('Failed to get/create user:', userResult.error);
                    throw new Error(userResult.error?.message || 'Failed to get or create user');
                }
                const receiver = userResult.data;
                console.log('User retrieved/created successfully:', {
                    role: receiver.role,
                    isNewUser: !receiver.id
                });

                console.log('Initializing escrow...');
                const escrowResult = await EscrowService.initializeEscrow(
                    input.userId,
                    input.depositor,
                    receiver.publicKey,
                    0
                );
                if (!escrowResult.success || !escrowResult.data) {
                    console.error('Failed to initialize escrow:', escrowResult.error);
                    throw new Error(escrowResult.error?.message || 'Failed to initialize escrow');
                }
                const escrowData = escrowResult.data;
                console.log('Escrow initialized:', { escrowAddress: escrowData.escrowAddress });

                const { program, feePayer } = getProvider();
                const depositorPk = new PublicKey(input.depositor);
                const counterpartyPk = new PublicKey(receiver.publicKey);

                console.log('Setting up deposit transaction...');
                const [escrowPda] = findEscrowPDA(
                    depositorPk,
                    counterpartyPk,
                    program.programId
                );

                // Get next deposit index
                let nextDepositIdx = 0;
                try {
                    console.log('Fetching escrow account...');
                    const escrowAccount = await program.account.escrow.fetch(escrowPda);
                    nextDepositIdx = escrowAccount.depositCount.toNumber();
                    console.log('Next deposit index:', nextDepositIdx);
                } catch (error) {
                    console.log('No existing escrow account found, using index 0');
                    nextDepositIdx = 0;
                }

                const [depositRecordPda] = PublicKey.findProgramAddressSync(
                    [
                        Buffer.from("deposit"),
                        escrowPda.toBuffer(),
                        new BN(nextDepositIdx).toArrayLike(Buffer, "le", 8)
                    ],
                    program.programId
                );

                const stableEnum = input.stable === "usdc" ? { usdc: {} } : { usdt: {} };
                const authEnum =
                    input.authorization === "SENDER"
                        ? { sender: {} }
                        : input.authorization === "RECEIVER"
                            ? { receiver: {} }
                            : { both: {} };

                const lamports = Math.round(input.amount * 1_000_000);

                console.log('Building deposit transaction...');

                const tx = await program.methods
                    .deposit(stableEnum as any, authEnum as any, new BN(lamports))
                    .accounts({
                        escrow: escrowPda,
                        depositor: depositorPk,
                        counterparty: counterpartyPk,
                        usdcMint,
                        usdtMint,
                        depositRecord: depositRecordPda,
                        feePayer: feePayer.publicKey,
                    } as DepositAccounts)
                    .transaction();

                console.log('Loading depositor keypair...');
                const { keypair: depositor } = await loadUserSignerKeypair(
                    ctx.session!.user.id
                );

                console.log('Sending deposit transaction...');
                const signature = await program.provider.sendAndConfirm!(tx, [feePayer, depositor]);
                console.log('Deposit transaction confirmed:', signature);

                // Create DB records
                console.log('Creating database records...');

                const existingEscrow = await prisma.escrow.findUnique({
                    where: {
                        id: escrowData.escrowAddress
                    }
                });

                const { transaction, deposit } = await prisma.$transaction(async (tx) => {
                    const txn = await tx.transaction.create({
                        data: {
                            userId: ctx.session.user.id,
                            walletPublicKey: input.depositor,
                            destinationAddress: receiver.publicKey,
                            amount: input.amount,
                            status: 'PENDING',
                            type: 'TRANSFER',
                            destinationUserId: receiver.id
                        },
                        select: {
                            id: true,
                            status: true
                        }
                    });

                    if (existingEscrow) {
                        await tx.escrow.update({
                            where: { id: existingEscrow.id },
                            data: {
                                depositCount: existingEscrow.depositCount + 1
                            }
                        });
                    } else {
                        await tx.escrow.create({
                            data: {
                                id: escrowData.escrowAddress,
                                senderPublicKey: input.depositor,
                                receiverPublicKey: receiver.publicKey,
                                depositCount: 0,
                                state: 'Active'
                            }
                        });
                    }

                    const dep = await tx.depositRecord.create({
                        data: {
                            depositIndex: nextDepositIdx,
                            amount: input.amount,
                            policy: input.authorization as SignatureType,
                            stable: input.stable,
                            senderApproved: input.authorization === "SENDER" ? true : false,
                            signatures: [
                                JSON.stringify({
                                    signer: input.depositor,
                                    role: 'sender',
                                    status: 'signed',
                                    timestamp: new Date()
                                }),
                                JSON.stringify({
                                    signer: receiver.publicKey,
                                    role: 'receiver',
                                    status: 'pending',
                                    timestamp: new Date()
                                })
                            ],
                            state: 'PENDING',
                            userId: ctx.session.user.id,
                            escrowId: escrowData.escrowAddress,
                            transactionId: txn.id
                        },
                    });

                    if (!existingEscrow) {
                        await tx.escrow.update({
                            where: { id: escrowData.escrowAddress },
                            data: {
                                depositCount: 1
                            }
                        });
                    }

                    return { transaction: txn, deposit: dep };
                });
                console.log('Database records created successfully');

                // Send notification email
                try {
                    console.log('Sending notification email...');
                    if (receiver.role === 'GUEST') {
                        const inviteToken = crypto.randomBytes(32).toString('hex');
                        await prisma.verificationToken.create({
                            data: {
                                identifier: input.recipientEmail,
                                token: inviteToken,
                                expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
                            },
                        });

                        const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invitation?token=${inviteToken}`;
                        await prisma.verificationToken.update({
                            where: { token: inviteToken },
                            data: {
                                // Add any additional metadata you need for the invitation
                                metadata: JSON.stringify({
                                    escrowId: escrowData.escrowAddress,
                                    amount: input.amount,
                                    token: input.stable.toUpperCase(),
                                })
                            }
                        });
                        await sendGuestDepositNotificationEmail(
                            input.recipientEmail,
                            inviteUrl,
                            ctx.session.user.email!,
                            input.amount.toFixed(2),
                            input.stable.toUpperCase(),
                            ctx.session.user.name || undefined
                        );
                    } else {
                        await sendDepositNotificationEmail(
                            input.recipientEmail,
                            input.amount,
                            input.stable.toUpperCase(),
                            ctx.session.user.name || undefined
                        );
                    }
                    console.log('Notification email sent successfully');
                } catch (error) {
                    console.error('Error sending email notification:', error);
                }

                console.log('Deposit process completed successfully');
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
                escrowPublicKey: z.string(),
                depositIndex: z.number().int().nonnegative(),
                receivingPartyPublicKey: z.string()
            })
        )
        .mutation(async ({ ctx, input }): Promise<ReleaseResult> => {
            try {
                const { program, feePayer } = getProvider();
                const escrowPk = new PublicKey(input.escrowPublicKey);
                const receivingPartyPk = new PublicKey(input.receivingPartyPublicKey);

                // Fetch the escrow account to get sender and receiver info
                const escrowAccount = await program.account.escrow.fetch(escrowPk);
                const depositorPk = new PublicKey(escrowAccount.sender);
                const counterpartyPk = new PublicKey(escrowAccount.receiver);

                // Determine who is the authorized signer based on the deposit record
                const [depositRecordPda] = findDepositRecordPDA(
                    escrowPk,
                    input.depositIndex,
                    program.programId
                );
                const depositRecord = await program.account.depositRecord.fetch(depositRecordPda);

                // Get the correct signer keypair based on authorization policy
                const isDepositor = receivingPartyPk.equals(depositorPk);
                let signerKp: Keypair;

                // Check the policy type from the deposit record
                const policy = depositRecord.policy;

                if (policy.single?.signer.equals(depositorPk)) {
                    if (!isDepositor) throw new Error('Only sender can release these funds');
                    const { keypair } = await loadSignerKeypair(ctx.session!.user.id, depositorPk);
                    signerKp = keypair;
                } else if (policy.single?.signer.equals(counterpartyPk)) {
                    if (isDepositor) throw new Error('Only receiver can release these funds');
                    const { keypair } = await loadSignerKeypair(ctx.session!.user.id, counterpartyPk);
                    signerKp = keypair;
                } else if (policy.dual) {
                    // For dual signature, the current user's role determines which signature we're adding
                    const { keypair } = await loadSignerKeypair(
                        ctx.session!.user.id,
                        isDepositor ? depositorPk : counterpartyPk
                    );
                    signerKp = keypair;
                } else {
                    throw new Error('Invalid signature policy');
                }

                // Create and send the release transaction
                const usdcMint = new PublicKey(USDC_MINT);
                const usdtMint = new PublicKey(USDT_MINT);

                const tx = await program.methods
                    .release(new BN(input.depositIndex))
                    .accounts({
                        escrow: escrowPk,
                        originalDepositor: depositorPk,
                        counterparty: counterpartyPk,
                        authorizedSigner: signerKp.publicKey,
                        receivingParty: receivingPartyPk,
                        usdcMint,
                        usdtMint,
                        depositRecord: depositRecordPda,
                        feePayer: feePayer.publicKey
                    } as any)
                    .transaction();

                const signature = await (program.provider as AnchorProvider).sendAndConfirm(
                    tx,
                    [feePayer, signerKp]
                );

                // Update the database with the signature
                await prisma.depositRecord.update({
                    where: { id: depositRecordPda.toBase58() },
                    data: {
                        state: 'COMPLETED',
                        signatures: {
                            push: JSON.stringify({
                                signer: signerKp.publicKey.toBase58(),
                                role: isDepositor ? 'sender' : 'receiver',
                                status: 'signed',
                                signature,
                                timestamp: new Date()
                            })
                        }
                    }
                });

                return {
                    success: true,
                    data: { signature }
                };
            } catch (error) {
                console.error('Error in requestWithdrawal:', error);
                return {
                    success: false,
                    error: error instanceof Error ? error : new Error('Failed to process withdrawal')
                };
            }
        }),

    updateDepositSignature: protectedProcedure
        .input(
            z.object({
                depositId: z.string(),
                role: z.enum(['sender', 'receiver']),
                signer: z.string(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            try {
                // Get the current deposit record
                const deposit = await prisma.depositRecord.findUnique({
                    where: { id: input.depositId },
                    include: { transaction: true }
                });

                if (!deposit) {
                    throw new TRPCError({
                        code: 'NOT_FOUND',
                        message: 'Deposit record not found'
                    });
                }

                // Parse existing signatures
                const currentSignatures = deposit.signatures.map(sig => JSON.parse(sig));

                // Update or add the signature for the current role
                const sigIndex = currentSignatures.findIndex(sig => sig.role === input.role);
                const newSignature = {
                    signer: input.signer,
                    role: input.role,
                    status: 'signed',
                    timestamp: new Date()
                };

                if (sigIndex >= 0) {
                    currentSignatures[sigIndex] = newSignature;
                } else {
                    currentSignatures.push(newSignature);
                }

                // Update the deposit record
                const updatedDeposit = await prisma.depositRecord.update({
                    where: { id: input.depositId },
                    data: {
                        signatures: currentSignatures.map(sig => JSON.stringify(sig))
                    }
                });

                return { success: true, data: updatedDeposit };
            } catch (error) {
                console.error('Error updating deposit signature:', error);
                return {
                    success: false,
                    error: handleRouterError(error)
                };
            }
        }),

    transferSpl: protectedProcedure
        .input(
            z.object({
                userId: z.string(),
                destinationAddress: z.string(),
                stable: z.enum(["usdc", "usdt"]),
                amount: z.number().positive()
            })
        )
        .mutation(async ({ ctx, input }) => {
            console.log('Starting transferSpl with input:', {
                ...input,
                userId: '[REDACTED]' // Don't log sensitive data
            });

            try {
                const usdcMint = new PublicKey(USDC_MINT);
                const usdtMint = new PublicKey(USDT_MINT);
                const mintPubkey = input.stable === "usdc" ? usdcMint : usdtMint;

                const user = await prisma.user.findUnique({
                    where: {
                        id: input.userId
                    }
                });

                if (!user) {
                    throw new TRPCError({
                        code: 'NOT_FOUND',
                        message: 'User not found'
                    });
                }

                const { connection, feePayer } = getProvider();
                const senderPk = new PublicKey(user.sendaWalletPublicKey);
                const receiverPk = new PublicKey(input.destinationAddress);

                // Create transaction to transfer tokens
                console.log('Setting up transfer transaction...');

                // Ensure ATAs exist
                await createAta(mintPubkey, senderPk);
                await createAta(mintPubkey, receiverPk);

                const senderAta = getAssociatedTokenAddressSync(mintPubkey, senderPk);
                const receiverAta = getAssociatedTokenAddressSync(mintPubkey, receiverPk);

                // Convert amount to lamports (USDC/USDT use 6 decimals)
                const lamports = Math.round(input.amount * 1_000_000);

                // Create the transfer transaction using SPL token program directly
                const tx = new Transaction().add(
                    createTransferCheckedInstruction(
                        senderAta,
                        mintPubkey,
                        receiverAta,
                        senderPk,
                        lamports,
                        6 // USDC/USDT have 6 decimals
                    )
                );

                tx.feePayer = feePayer.publicKey;
                // Load the sender's keypair
                console.log('Loading sender keypair...');
                const { keypair: senderKeypair } = await loadUserSignerKeypair(
                    ctx.session!.user.id
                );

                // Send the transaction
                console.log('Sending transfer transaction...');
                const signature = await connection.sendTransaction(
                    tx, 
                    [senderKeypair, feePayer],
                    {skipPreflight: false}
                );
                
                await connection.confirmTransaction(signature);
                console.log('Transfer transaction confirmed:', signature);

                // Create DB record of the transaction
                const transaction = await prisma.transaction.create({
                    data: {
                        userId: ctx.session.user.id,
                        walletPublicKey: user.sendaWalletPublicKey,
                        destinationAddress: input.destinationAddress,
                        amount: input.amount,
                        status: 'COMPLETED',
                        type: 'TRANSFER'
                    }
                });

                return { 
                    success: true, 
                    signature,
                    transaction: {
                        id: transaction.id,
                        status: transaction.status
                    }
                };

            } catch (error) {
                console.error('Error in transferSpl:', error);
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: error instanceof Error ? error.message : 'Failed to transfer tokens',
                    cause: error
                });
            }
        }),
});

export default sendaRouter;