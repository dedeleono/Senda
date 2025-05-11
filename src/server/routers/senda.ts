import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import {
    PublicKey,
    SystemProgram,
    SYSVAR_RENT_PUBKEY
} from "@solana/web3.js";
import {
    AnchorProvider,
    BN
} from "@coral-xyz/anchor";

import {
    findVaultPDA,
    findDepositRecordPDA
} from "@/lib/senda/helpers";
import { USDC_MINT, USDT_MINT } from "@/lib/constants";
import {
    ASSOCIATED_TOKEN_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    getAssociatedTokenAddress
} from "@solana/spl-token";
import { TRPCError } from "@trpc/server";
import { getProvider, loadSignerKeypair } from "@/utils/dapp-wallets";


export const sendaRouter = router({
    // ──────────────────────────────────────────────────────────────────────────
    // READ-ONLY helpers – keep business logic in the front-end store
    // ──────────────────────────────────────────────────────────────────────────
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

            // @todo Parse account once the type is in the IDL.
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
            const { program, feePayer } = getProvider();

            const senderPk = new PublicKey(input.sender);
            const receiverPk = new PublicKey(input.receiver);

            const { keypair: senderKp } = await loadSignerKeypair(
                ctx.session!.user.id,
                senderPk
            );

            const usdcMint = new PublicKey(USDC_MINT);
            const usdtMint = new PublicKey(USDT_MINT);

            // Compute PDAs & ATAs
            const [escrowPda] = PublicKey.findProgramAddressSync(
                [Buffer.from("escrow"), senderPk.toBuffer(), receiverPk.toBuffer()],
                program.programId
            );


            const tx = await program.methods
                .initializeEscrow(new BN(input.seed))
                .accounts({
                    feePayer: feePayer.publicKey,
                    escrow: escrowPda,
                    sender: senderPk,
                    receiver: receiverPk,
                    usdcMint,
                    usdtMint
                } as any)
                .transaction();

            const sig = await (program.provider as AnchorProvider).sendAndConfirm(tx, [feePayer, senderKp]);

            return { signature: sig, escrow: escrowPda.toBase58() };
        }),

    createDeposit: protectedProcedure
        .input(
            z.object({
                escrow: z.string(),
                depositor: z.string(),
                counterparty: z.string(),
                stable: z.enum(["usdc", "usdt"]),
                authorization: z.enum(["sender", "receiver", "both"]),
                amount: z.number().positive()
            })
        )
        .mutation(async ({ ctx, input }) => {
            const { program, feePayer } = getProvider();

            const depositorPk = new PublicKey(input.depositor);
            const counterpartyPk = new PublicKey(input.counterparty);
            const escrowPk = new PublicKey(input.escrow);

            const { keypair: depositorKp } = await loadSignerKeypair(
                ctx.session!.user.id,
                depositorPk
            );

            const usdcMint = new PublicKey(USDC_MINT);
            const usdtMint = new PublicKey(USDT_MINT);

            const [vaultUsdc] = findVaultPDA(escrowPk, usdcMint, "usdc", program.programId);
            const [vaultUsdt] = findVaultPDA(escrowPk, usdtMint, "usdt", program.programId);

            const depositorUsdcAta = await getAssociatedTokenAddress(usdcMint, depositorPk);
            const depositorUsdtAta = await getAssociatedTokenAddress(usdtMint, depositorPk);
            const counterpartyUsdcAta = await getAssociatedTokenAddress(usdcMint, counterpartyPk);
            const counterpartyUsdtAta = await getAssociatedTokenAddress(usdtMint, counterpartyPk);

            const stableEnum = input.stable === "usdc" ? { usdc: {} } : { usdt: {} };
            const authEnum =
                input.authorization === "sender"
                    ? { sender: {} }
                    : input.authorization === "receiver"
                    ? { receiver: {} }
                    : { both: {} };

            const lamports = Math.round(input.amount * 1_000_000);

            // For now, we assume the next deposit index is the current depositCount (0 if first deposit).
            // In production, retrieve the actual value from on-chain escrow account.
            const nextDepositIdx = 0;
            const [depositRecord] = findDepositRecordPDA(
                escrowPk,
                nextDepositIdx,
                program.programId
            );

            const tx = await program.methods
                .deposit(stableEnum as any, authEnum as any, new BN(lamports))
                .accounts({
                    escrow: escrowPk,
                    depositor: depositorPk,
                    counterparty: counterpartyPk,
                    depositorUsdcAta,
                    depositorUsdtAta,
                    counterpartyUsdcAta,
                    counterpartyUsdtAta,
                    usdcMint,
                    usdtMint,
                    vaultUsdc,
                    vaultUsdt,
                    feePayer: feePayer.publicKey,
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

            const depositorUsdcAta = await getAssociatedTokenAddress(usdcMint, depositorPk);
            const depositorUsdtAta = await getAssociatedTokenAddress(usdtMint, depositorPk);

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

            const depositorUsdcAta = await getAssociatedTokenAddress(usdcMint, depositorPk);
            const depositorUsdtAta = await getAssociatedTokenAddress(usdtMint, depositorPk);
            const counterpartyUsdcAta = await getAssociatedTokenAddress(
                usdcMint,
                counterpartyPk
            );
            const counterpartyUsdtAta = await getAssociatedTokenAddress(
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