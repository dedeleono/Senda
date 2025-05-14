import { Program } from "@coral-xyz/anchor";
import { SendaDapp } from "@/lib/IDL";
import { Keypair, PublicKey } from "@solana/web3.js";

type ProgramType = Program<SendaDapp>;
const program = null as unknown as ProgramType;

export type InitFactoryAccounts = Parameters<
    ReturnType<typeof program.methods.initFactory>["accounts"]
>[0];

export type InitEscrowAccounts = Parameters<
    ReturnType<typeof program.methods.initializeEscrow>["accounts"]
>[0];

export type DepositAccounts = Parameters<
    ReturnType<typeof program.methods.deposit>["accounts"]
>[0];

export type ReleaseAccounts = Parameters<
    ReturnType<typeof program.methods.release>["accounts"]
>[0];

export type CancelAccounts = Parameters<
    ReturnType<typeof program.methods.cancel>["accounts"]
>[0];

export type Stable = 'usdc' | 'usdt';
export type AuthorizedBy = 'sender' | 'receiver' | 'both';

export enum EscrowState {
    Active,
    Closed
}

export enum SignaturePolicy {
    Dual,
    Single
}

export enum DepositState {
    PendingWithdrawal,
    Completed,
    Cancelled,
    Disputed
}

export interface InitEscrowParams {
    senderPublicKey: string;
    receiverPublicKey: string;
    seed?: number;
}

export interface DepositParams {
    escrowPublicKey: string;
    depositorPublicKey: string;
    counterpartyPublicKey: string;
    stable: Stable;
    authorization: AuthorizedBy;
    amount: number;
}

export interface CancelParams {
    escrowPublicKey: string;
    depositorPublicKey: string;
    counterpartyPublicKey: string;
    depositIdx: number;
}

export interface ReleaseParams {
    escrowPublicKey: string;
    depositIndex: number;
    receivingPartyPublicKey: string;
}

export interface ReleaseResult {
    success: boolean;
    data?: {
        signature: string;
    };
    error?: Error;
}

export interface SignatureUpdateParams {
    depositId: string;
    role: 'sender' | 'receiver';
    signature: string;
}

export type FactoryStats = {
    totalDeposits: number;
    totalDepositsValue: number;
    totalDepositsCount: number;
    totalDepositsValueUSDC: number;
    totalDepositsValueUSDT: number;
    totalDepositsCountUSDC: number;
    totalDepositsCountUSDT: number;
    escrows: Array<{ Escrow: PublicKey | string, state: EscrowState, stats: EscrowStats }>;
}

export type EscrowStats = {
    originalDepositor: PublicKey | string;
    receiver: PublicKey | string;
    pendingWithdrawals: number;
    completedDeposits: number;
    cancelledDeposits: number;
    disputedDeposits: number;
    totalValue: number;
    totalValueUSDC: number;
    totalValueUSDT: number;
    state: EscrowState;
    deposits: Array<DepositRecord>;
}

export type DepositRecord = {
    escrow: PublicKey;
    deposit_idx: number;
    amount: number;
    policy: SignaturePolicy;
    stable: Stable;
    state: DepositState;
}