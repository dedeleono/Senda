import { create } from 'zustand';
import { clusterApiUrl, Connection, PublicKey, Transaction, TransactionInstruction, Keypair, VersionedTransaction } from '@solana/web3.js';
import { AnchorProvider, getProvider, Program, Provider, setProvider } from '@coral-xyz/anchor';
import { SendaDapp } from '../lib/IDL';
import { AnchorWallet } from '@solana/wallet-adapter-react';
import { executeTransaction, TransactionResult } from '@/lib/utils/solana-transaction';
import { trpc } from '@/app/_trpc/client';
import { getProgramId } from '@/utils/common';
import { getWalletAdapter, isSendaWalletConnected } from '@/lib/services/wallet';
import { USDC_MINT, USDT_MINT } from '@/lib/constants';

export type Stable = 'usdc' | 'usdt';
export type AuthorizedBy = 'sender' | 'receiver' | 'both';

enum EscrowState {
  Active,
  Closed
}

enum SignaturePolicy {
  Dual,
  Single
}

enum DepositState {
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
  originalDepositorPublicKey: string;
  counterpartyPublicKey: string;
  receivingPartyPublicKey: string;
  authorizedSignerPublicKey: string;
  depositIdx: number;
}

type FactoryStats = {
  totalDeposits: number;
  totalDepositsValue: number;
  totalDepositsCount: number;
  totalDepositsValueUSDC: number;
  totalDepositsValueUSDT: number;
  totalDepositsCountUSDC: number;
  totalDepositsCountUSDT: number;
  escrows: Array<{Escrow: PublicKey | string, state: EscrowState, stats: EscrowStats}>;
}

type EscrowStats = {
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

type DepositRecord = {
  escrow: PublicKey;
  deposit_idx: number;
  amount: number;
  policy: SignaturePolicy;
  stable: Stable;
  state: DepositState;
}

interface SendaProgramState {
  wallet: AnchorWallet | null;
  connection: Connection | null;
  isProcessing: boolean;
  lastError: Error | null;
}

export interface SendaStore {
  program: Program<SendaDapp> | null;
  stats: FactoryStats | null;
  state: SendaProgramState;

  initState: (options: { 
    externalWallet?: AnchorWallet; 
    userId: string;
  }) => Promise<void>;
  
  getFactoryStats: () => Promise<FactoryStats | null>;
  getEscrowStats: (escrowPublicKey: PublicKey) => Promise<EscrowStats | null>;

  setProcessing: (isProcessing: boolean) => void;
  setError: (error: Error | null) => void;
  
  initEscrow: (params: InitEscrowParams) => Promise<TransactionResult>;
  createDeposit: (params: DepositParams) => Promise<TransactionResult>;
  cancelDeposit: (params: CancelParams) => Promise<TransactionResult>;
  requestWithdrawal: (params: ReleaseParams) => Promise<TransactionResult>;

  resetState: () => void;
}

export const useSendaProgram = create<SendaStore>((set, get) => ({
  // Base state
  program: null,
  stats: {} as FactoryStats,
  state: {} as SendaProgramState,
  
  initState: async (options: { 
    externalWallet?: AnchorWallet; 
    userId: string;
  }) => {
    console.log('Initializing Senda Program with options:', { 
      externalWallet: !!options.externalWallet,
      userId: options.userId 
    });

    let provider: Provider;
    let connection: Connection;
    let wallet: AnchorWallet | undefined = undefined;
    const programId = getProgramId();
    
    console.log('Using Program ID:', programId);

    // Always create a new connection
    connection = new Connection(
      process.env.NEXT_PUBLIC_SOLANA_RPC || clusterApiUrl("devnet")
    );
    console.log('Created connection to:', process.env.NEXT_PUBLIC_SOLANA_RPC || clusterApiUrl("devnet"));
    
    try {
      const isConnected = isSendaWalletConnected();
      const sendaWallet = getWalletAdapter();
      
      if (isConnected && sendaWallet && sendaWallet.publicKey) {
        console.log('Using connected Senda wallet:', sendaWallet.publicKey.toString());
        wallet = sendaWallet as unknown as AnchorWallet;
      }
      else if (options.externalWallet) {
        console.log('Using provided external wallet');
        wallet = options.externalWallet;
      } 
      else if (options.userId) {
        console.log('Attempting to use userId wallet - userId is available, but we will proceed with a limited provider for read-only operations');
      }
      
      if (wallet) {
        console.log('Creating AnchorProvider with wallet');
        const anchorOptions = AnchorProvider.defaultOptions();
        provider = new AnchorProvider(
          connection as any, 
          wallet as any, 
          anchorOptions
        );
      } else {
        console.log('Creating limited provider without wallet - read-only mode');
        provider = {
          connection: connection as any,
          send: async () => {
            throw new Error(
              "Wallet connection required for sending transactions. Please connect your wallet to continue."
            );
          },
          signAndSendTransaction: async () => {
            throw new Error(
              "Wallet connection required for sending transactions. Please connect your wallet to continue."
            );
          },
          publicKey: undefined,
        } as unknown as Provider;
      }
      
      setProvider(provider);
    } catch (error) {
      console.error('Error during wallet setup:', error);
      
      // Fall back to a limited provider
      provider = {
        connection: connection as any,
        send: async () => {
          throw new Error(
            "Wallet connection required for sending transactions. Please connect your wallet to continue."
          );
        },
        signAndSendTransaction: async () => {
          throw new Error(
            "Wallet connection required for sending transactions. Please connect your wallet to continue."
          );
        },
        publicKey: undefined,
      } as unknown as Provider;
      
      setProvider(provider);
    }
    
    console.log('Creating program with ID:', programId);
    try {
      
      const { SENDA_IDL } = require('../lib/IDL/sendaIDL');
      const programPubkey = new PublicKey(programId);
      
      const program = {
        programId: programPubkey,
        provider: provider,
        idl: SENDA_IDL,
        rpc: {},
        account: {},
        coder: {
          instruction: {
            encode: () => {
              throw new Error("Not implemented");
            }
          },
          accounts: {
            decode: () => {
              throw new Error("Not implemented");
            }
          }
        }
      };
      
      console.log('Program created successfully');
      
      const isWalletConnected = !!(provider && 
                                  provider.publicKey && 
                                  provider.wallet);
      
      if (!isWalletConnected) {
        // We'll allow the program to be initialized in read-only mode,
        // but we'll set an error state indicating wallet connection is required for transactions
        set({
          state: {
            ...get().state,
            lastError: new Error("Wallet connection is required for transactions. Program initialized in read-only mode.")
          },
          program: program as unknown as Program<SendaDapp>
        });
      } else {
        console.log('Program initialized with full transaction capabilities');
        
        // Clear any previous errors if wallet is properly connected
        set({
          state: {
            ...get().state,
            lastError: null,
          },
          program: program as unknown as Program<SendaDapp>
        });
      }
    } catch (error) {
      console.error('Error creating program:', error);
      set({ 
        program: null,
        state: { 
          ...get().state, 
          lastError: error instanceof Error ? error : new Error(String(error))
        }
      });
    }
    return;
  },

  getFactoryStats: async () => {
    try {

      const { program } = get();
      
      if (!program) {
        throw new Error('Program not initialized');
      }
      
      // Mock implementation
      const mockStats: FactoryStats = {
        totalDeposits: 0,
        totalDepositsValue: 0,
        totalDepositsCount: 0,
        totalDepositsValueUSDC: 0,
        totalDepositsValueUSDT: 0,
        totalDepositsCountUSDC: 0,
        totalDepositsCountUSDT: 0,
        escrows: []
      };
      
      set({ 
        stats: mockStats, 
        state: { 
          ...get().state, 
          isProcessing: false,
        } 
      });
      return mockStats;
    } catch (error) {
      const typedError = error instanceof Error ? error : new Error(String(error));
      set({ 
        state: { 
          ...get().state, 
          isProcessing: false,
          lastError: typedError
        }
      });
      return null;
    }
  },

  getEscrowStats: async (escrowPublicKey: PublicKey) => {
    try {
      set({ state: { ...get().state, isProcessing: true } });
      const { program } = get();
      
      if (!program || !escrowPublicKey || !PublicKey.isOnCurve(escrowPublicKey)) {
        throw new Error('Invalid program state or escrow address');
      }

      // Mock implementation
      const mockStats: EscrowStats = {
        originalDepositor: PublicKey.default.toString(),
        receiver: PublicKey.default.toString(),
        pendingWithdrawals: 0,
        completedDeposits: 0,
        cancelledDeposits: 0,
        disputedDeposits: 0,
        totalValue: 0,
        totalValueUSDC: 0,
        totalValueUSDT: 0,
        state: EscrowState.Active,
        deposits: []
      };
      
      set({ 
        state: { 
          ...get().state, 
          isProcessing: false,
        }
      });
      return mockStats;
    } catch (error) {
      const typedError = error instanceof Error ? error : new Error(String(error));
      set({ 
        state: { 
          ...get().state, 
          isProcessing: false,
          lastError: typedError
        }
      });
      return null;
    }
  },
  
  setProcessing: (isProcessing: boolean) => {
    set({ state: { ...get().state, isProcessing } });
  },
  
  setError: (error: Error | null) => {
    set({ state: { ...get().state, lastError: error } });
  },
  
  initEscrow: async ({ senderPublicKey, receiverPublicKey }: InitEscrowParams): Promise<TransactionResult> => {
    try {
      const { program } = get();
      if (!program) {
        throw new Error('Program not initialized');
      }

      if (!program.provider.publicKey || !program.provider.wallet) {
        throw new Error('Wallet connection required for escrow creation. Please connect your wallet to continue.');
      }

      const programId = program.programId;
      const connection = program.provider.connection;
      
      const sender = new PublicKey(senderPublicKey);
      const receiver = new PublicKey(receiverPublicKey);
      
      // Define mint PublicKeys once to reuse
      const usdcMintPubkey = new PublicKey(USDC_MINT);
      const usdtMintPubkey = new PublicKey(USDT_MINT);
      
      const [escrowPda, escrowBump] = PublicKey.findProgramAddressSync(
        [Buffer.from("escrow"), sender.toBuffer(), receiver.toBuffer()],
        programId
      );
      
      const [vaultUsdc, vaultUsdcBump] = PublicKey.findProgramAddressSync(
        [Buffer.from("usdc-vault"), escrowPda.toBuffer(), usdcMintPubkey.toBuffer()],
        programId
      );
      
      const [vaultUsdt, vaultUsdtBump] = PublicKey.findProgramAddressSync(
        [Buffer.from("usdt-vault"), escrowPda.toBuffer(), usdtMintPubkey.toBuffer()],
        programId
      );
      
      console.log("Program ID:", programId.toBase58());
      console.log("Escrow PDA:", escrowPda.toBase58());
      console.log("Escrow Bump:", escrowBump);
      console.log("USDC Mint:", usdcMintPubkey.toBase58());
      console.log("USDT Mint:", usdtMintPubkey.toBase58());
      console.log("Vault USDC PDA:", vaultUsdc.toBase58());
      console.log("Vault USDC Bump:", vaultUsdcBump);
      console.log("Vault USDT PDA:", vaultUsdt.toBase58());
      console.log("Vault USDT Bump:", vaultUsdtBump);

      const data = Buffer.from([243, 160, 77, 153, 11, 92, 48, 209]);
      
      const initEscrowIx = new TransactionInstruction({
        keys: [
          { pubkey: escrowPda, isSigner: false, isWritable: true },
          { pubkey: sender, isSigner: true, isWritable: true },
          { pubkey: receiver, isSigner: false, isWritable: false },
          { pubkey: vaultUsdc, isSigner: false, isWritable: true },
          { pubkey: vaultUsdt, isSigner: false, isWritable: true },
          
        ],
        programId,
        data
      });

      console.log("Executing escrow creation transaction");
      return await executeTransaction(
        program.provider.connection as any,
        program.provider.wallet as AnchorWallet,
        [initEscrowIx]
      );
    } catch (error) {
      console.error("Error during initEscrow:", error);
      const typedError = error instanceof Error ? error : new Error(String(error));
      return {
        success: false,
        error: typedError
      };
    }
  },
  
  createDeposit: async ({ 
    escrowPublicKey,
    depositorPublicKey,
    counterpartyPublicKey,
    stable,
    authorization,
    amount
  }: DepositParams): Promise<TransactionResult> => {
    try {
      const { program } = get();
      if (!program) {
        throw new Error('Program not initialized');
      }

      if (!program.provider || 
          !program.provider.publicKey || 
          !program.provider.wallet) {
        
        console.error('Wallet not properly connected for deposit operations');
        throw new Error('Wallet connection required for deposit operations. Please connect your wallet to continue.');
      }

      const currentWalletPubkey = program.provider.publicKey.toString();
      const expectedDepositor = new PublicKey(depositorPublicKey);
      
      if (currentWalletPubkey !== expectedDepositor.toString()) {
        console.error(`Wallet mismatch: connected=${currentWalletPubkey}, expected=${expectedDepositor.toString()}`);
        throw new Error('The connected wallet does not match the expected depositor. Please connect the correct wallet.');
      }

      const programId = program.programId;
      
      // Create proper PublicKeys
      const escrow = new PublicKey(escrowPublicKey);
      const depositor = new PublicKey(depositorPublicKey);
      const counterparty = new PublicKey(counterpartyPublicKey);
      const usdcMintPubkey = new PublicKey(USDC_MINT);
      const usdtMintPubkey = new PublicKey(USDT_MINT);
      
      // Find vault addresses - use the appropriate mint pubkey for each vault
      const [vaultUsdc] = PublicKey.findProgramAddressSync(
        [Buffer.from("usdc-vault"), escrow.toBuffer(), usdcMintPubkey.toBuffer()],
        programId
      );
      
      const [vaultUsdt] = PublicKey.findProgramAddressSync(
        [Buffer.from("usdt-vault"), escrow.toBuffer(), usdtMintPubkey.toBuffer()],
        programId
      );
      
      const stableValue = stable === 'usdc' ? 0 : 1; // 0 for USDC, 1 for USDT
      const authValue = authorization === 'sender' ? 0 : authorization === 'receiver' ? 1 : 2; // 0 for sender, 1 for receiver, 2 for both
      
      // Create the instruction data with the actual deposit parameters
      const instructionData = Buffer.alloc(16); // 8 bytes for discriminator, 4 for amount, etc.
      
      // Deposit discriminator (8 bytes)
      Buffer.from([98, 231, 20, 217, 235, 33, 213, 28]).copy(instructionData, 0);
      
      // Amount (as u64 LE)
      const amountBuf = Buffer.alloc(8);
      try {
        amountBuf.writeBigUInt64LE(BigInt(amount * 1000000), 0); // Convert to micros (USDC/USDT have 6 decimals)
      } catch (error) {
        // Fallback for environments without BigInt support
        const amountMicros = amount * 1000000; // 6 decimal places
        const view = new DataView(new ArrayBuffer(8));
        view.setUint32(0, amountMicros, true);  // Lower 32 bits
        view.setUint32(4, 0, true);             // Upper 32 bits
        Buffer.from(new Uint8Array(view.buffer)).copy(amountBuf);
      }
      amountBuf.copy(instructionData, 8);
      
      // Get the next deposit index
      const depositCount = 0; // This would ideally come from the escrow account state
      const depositCountBuf = Buffer.alloc(8);
      depositCountBuf.writeUInt32LE(depositCount, 0);
      
      // Find the deposit record PDA
      const [depositRecord] = PublicKey.findProgramAddressSync(
        [Buffer.from("deposit"), escrow.toBuffer(), depositCountBuf],
        programId
      );
      
      // Find the associated token accounts for the depositor
      const depositorUsdcAta = depositor;
      const depositorUsdtAta = depositor;
      
      // Choose which vault to interact with based on stable
      const targetVault = stable === 'usdc' ? vaultUsdc : vaultUsdt;
      const targetMint = stable === 'usdc' ? usdcMintPubkey : usdtMintPubkey;

      const depositIx = new TransactionInstruction({
        keys: [
          { pubkey: escrow, isSigner: false, isWritable: true },
          { pubkey: depositor, isSigner: true, isWritable: true },
          { pubkey: counterparty, isSigner: false, isWritable: false },
          { pubkey: usdcMintPubkey, isSigner: false, isWritable: false },
          { pubkey: usdtMintPubkey, isSigner: false, isWritable: false },
          // Add the required additional accounts
     
          { pubkey: depositRecord, isSigner: false, isWritable: true },

        ],
        programId,
        data: instructionData
      });
      
      console.log("Creating deposit with parameters:", {
        escrow: escrow.toString(),
        depositor: depositor.toString(),
        amount: amount,
        stable: stable,
        authorization: authorization,
        depositRecord: depositRecord.toString(),
        targetVault: targetVault.toString(),
        targetMint: targetMint.toString()
      });
      
      return await executeTransaction(
        program.provider.connection as any,
        program.provider.wallet as AnchorWallet,
        [depositIx]
      );
    } catch (error) {
      console.error("Error during createDeposit:", error);
      const typedError = error instanceof Error ? error : new Error(String(error));
      return {
        success: false,
        error: typedError
      };
    }
  },
  
  cancelDeposit: async ({ 
    escrowPublicKey,
    depositorPublicKey, 
    counterpartyPublicKey,
    depositIdx 
  }: CancelParams): Promise<TransactionResult> => {
    try {
      const { program } = get();
      if (!program) {
        throw new Error('Program not initialized');
      }

      // Check if we have a connected wallet
      if (!program.provider.publicKey || !program.provider.wallet) {
        throw new Error('Wallet connection required for deposit cancellation. Please connect your wallet to continue.');
      }

      const programId = program.programId;
      
      const escrow = new PublicKey(escrowPublicKey);
      const originalDepositor = new PublicKey(depositorPublicKey);
      const counterparty = new PublicKey(counterpartyPublicKey);
      
      // Create proper PublicKey objects for the mints
      const usdcMintPubkey = new PublicKey(USDC_MINT);
      const usdtMintPubkey = new PublicKey(USDT_MINT);
      
      // Derive vault PDAs correctly with the appropriate mint for each
      const [vaultUsdc] = PublicKey.findProgramAddressSync(
        [Buffer.from("usdc-vault"), escrow.toBuffer(), usdcMintPubkey.toBuffer()],
        programId
      );
      
      const [vaultUsdt] = PublicKey.findProgramAddressSync(
        [Buffer.from("usdt-vault"), escrow.toBuffer(), usdtMintPubkey.toBuffer()],
        programId
      );

      const depositorUsdcAta = new PublicKey(originalDepositor.toString());
      const depositorUsdtAta = new PublicKey(originalDepositor.toString());
      
      const data = Buffer.alloc(16);
      Buffer.from([232, 219, 223, 41, 219, 236, 220, 190]).copy(data, 0);
      
      const depositIdxBuf = Buffer.alloc(8);
      
      // Use a more compatible approach for writing to the buffer
      try {
        // Try the BigInt approach first (Node.js)
        depositIdxBuf.writeBigUInt64LE(BigInt(depositIdx), 0);
      } catch (error) {
        console.log('Using fallback buffer writing method for deposit index');
        
        // Fallback method for environments that don't support writeBigUInt64LE
        const view = new DataView(new ArrayBuffer(8));
        view.setUint32(0, depositIdx, true); // Little-endian, lower 32 bits
        view.setUint32(4, 0, true);         // Little-endian, upper 32 bits (zero)
        
        // Copy the ArrayBuffer to our Buffer
        Buffer.from(new Uint8Array(view.buffer)).copy(depositIdxBuf);
      }
      
      depositIdxBuf.copy(data, 8);
      
      const depositIdxBufForPDA = Buffer.alloc(8);
      
      // Use a more compatible approach for writing to the buffer
      try {
        // Try the BigInt approach first (Node.js)
        depositIdxBufForPDA.writeBigUInt64LE(BigInt(depositIdx), 0);
      } catch (error) {
        console.log('Using fallback buffer writing method for deposit index PDA');
        
        // Fallback method for environments that don't support writeBigUInt64LE
        const view = new DataView(new ArrayBuffer(8));
        view.setUint32(0, depositIdx, true); // Little-endian, lower 32 bits
        view.setUint32(4, 0, true);         // Little-endian, upper 32 bits (zero)
        
        // Copy the ArrayBuffer to our Buffer
        Buffer.from(new Uint8Array(view.buffer)).copy(depositIdxBufForPDA);
      }
      
      // Restore the deleted line that finds the deposit record PDA
      const [depositRecord] = PublicKey.findProgramAddressSync(
        [Buffer.from("deposit"), escrow.toBuffer(), depositIdxBufForPDA],
        programId
      );

      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: escrow, isSigner: false, isWritable: true },
          { pubkey: originalDepositor, isSigner: true, isWritable: true },
          { pubkey: counterparty, isSigner: false, isWritable: false },
          { pubkey: depositorUsdcAta, isSigner: false, isWritable: true },
          { pubkey: depositorUsdtAta, isSigner: false, isWritable: true },
          { pubkey: usdcMintPubkey, isSigner: false, isWritable: false },
          { pubkey: usdtMintPubkey, isSigner: false, isWritable: false },
          { pubkey: vaultUsdc, isSigner: false, isWritable: true },
          { pubkey: vaultUsdt, isSigner: false, isWritable: true },
          { pubkey: depositRecord, isSigner: false, isWritable: true },
          { pubkey: new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'), isSigner: false, isWritable: false },
          { pubkey: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'), isSigner: false, isWritable: false },
          { pubkey: PublicKey.default, isSigner: false, isWritable: false },
          { pubkey: new PublicKey('SysvarRent111111111111111111111111111111111'), isSigner: false, isWritable: false }
        ],
        programId,
        data
      });
      
      // Use as any to avoid the type incompatibility between the two Connection types
      return await executeTransaction(
        program.provider.connection as any,
        program.provider.wallet as AnchorWallet,
        [instruction]
      );
    } catch (error) {
      console.error("Error during cancelDeposit:", error);
      const typedError = error instanceof Error ? error : new Error(String(error));
      return {
        success: false,
        error: typedError
      };
    }
  },
  
  requestWithdrawal: async ({ 
    escrowPublicKey,
    originalDepositorPublicKey,
    counterpartyPublicKey,
    receivingPartyPublicKey,
    authorizedSignerPublicKey,
    depositIdx
  }: ReleaseParams): Promise<TransactionResult> => {
    try {
      const { program } = get();
      if (!program) {
        throw new Error('Program not initialized');
      }

      // Check if we have a connected wallet
      if (!program.provider.publicKey || !program.provider.wallet) {
        throw new Error('Wallet connection required for withdrawal requests. Please connect your wallet to continue.');
      }

      const programId = program.programId;
      
      const escrow = new PublicKey(escrowPublicKey);
      const originalDepositor = new PublicKey(originalDepositorPublicKey);
      const counterparty = new PublicKey(counterpartyPublicKey);
      const receivingParty = new PublicKey(receivingPartyPublicKey);
      const authorizedSigner = new PublicKey(authorizedSignerPublicKey);
      
      // Create PublicKey objects for mints
      const usdcMintPubkey = new PublicKey(USDC_MINT);
      const usdtMintPubkey = new PublicKey(USDT_MINT);
      
      // Derive vault PDAs correctly with the appropriate mint for each
      const [vaultUsdc] = PublicKey.findProgramAddressSync(
        [Buffer.from("usdc-vault"), escrow.toBuffer(), usdcMintPubkey.toBuffer()],
        programId
      );
      
      const [vaultUsdt] = PublicKey.findProgramAddressSync(
        [Buffer.from("usdt-vault"), escrow.toBuffer(), usdtMintPubkey.toBuffer()],
        programId
      );
      
      // In a production implementation, these would be derived properly using the Solana associated token program
      const depositorUsdcAta = new PublicKey(originalDepositor.toString());
      const depositorUsdtAta = new PublicKey(originalDepositor.toString());
      const counterpartyUsdcAta = new PublicKey(counterparty.toString());
      const counterpartyUsdtAta = new PublicKey(counterparty.toString());
      
      const data = Buffer.alloc(16);
      Buffer.from([253, 249, 15, 206, 28, 127, 193, 241]).copy(data, 0);
      
      const depositIdxBuf = Buffer.alloc(8);
      
      // Use a more compatible approach for writing to the buffer
      try {
        // Try the BigInt approach first (Node.js)
        depositIdxBuf.writeBigUInt64LE(BigInt(depositIdx), 0);
      } catch (error) {
        console.log('Using fallback buffer writing method for withdrawal deposit index');
        
        // Fallback method for environments that don't support writeBigUInt64LE
        const view = new DataView(new ArrayBuffer(8));
        view.setUint32(0, depositIdx, true); // Little-endian, lower 32 bits
        view.setUint32(4, 0, true);         // Little-endian, upper 32 bits (zero)
        
        // Copy the ArrayBuffer to our Buffer
        Buffer.from(new Uint8Array(view.buffer)).copy(depositIdxBuf);
      }
      
      depositIdxBuf.copy(data, 8);

      const depositIdxBufForPDA = Buffer.alloc(8);
      
      // Use a more compatible approach for writing to the buffer
      try {
        // Try the BigInt approach first (Node.js)
        depositIdxBufForPDA.writeBigUInt64LE(BigInt(depositIdx), 0);
      } catch (error) {
        console.log('Using fallback buffer writing method for withdrawal deposit index PDA');
        
        // Fallback method for environments that don't support writeBigUInt64LE
        const view = new DataView(new ArrayBuffer(8));
        view.setUint32(0, depositIdx, true); // Little-endian, lower 32 bits
        view.setUint32(4, 0, true);         // Little-endian, upper 32 bits (zero)
        
        // Copy the ArrayBuffer to our Buffer
        Buffer.from(new Uint8Array(view.buffer)).copy(depositIdxBufForPDA);
      }
      
      const [depositRecord] = PublicKey.findProgramAddressSync(
        [Buffer.from("deposit"), escrow.toBuffer(), depositIdxBufForPDA],
        programId
      );
      
      console.log("Request withdrawal parameters:", {
        escrow: escrow.toString(),
        originalDepositor: originalDepositor.toString(),
        counterparty: counterparty.toString(),
        receivingParty: receivingParty.toString(),
        depositIdx,
        depositRecord: depositRecord.toString(),
      });
      
      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: escrow, isSigner: false, isWritable: true },
          { pubkey: originalDepositor, isSigner: false, isWritable: true },
          { pubkey: counterparty, isSigner: false, isWritable: true },
          { pubkey: authorizedSigner, isSigner: true, isWritable: true },
          { pubkey: receivingParty, isSigner: false, isWritable: true },
          { pubkey: depositorUsdcAta, isSigner: false, isWritable: true },
          { pubkey: depositorUsdtAta, isSigner: false, isWritable: true },
          { pubkey: counterpartyUsdcAta, isSigner: false, isWritable: true },
          { pubkey: counterpartyUsdtAta, isSigner: false, isWritable: true },
          { pubkey: usdcMintPubkey, isSigner: false, isWritable: false },
          { pubkey: usdtMintPubkey, isSigner: false, isWritable: false },
          { pubkey: vaultUsdc, isSigner: false, isWritable: true },
          { pubkey: vaultUsdt, isSigner: false, isWritable: true },
          { pubkey: depositRecord, isSigner: false, isWritable: true },
          { pubkey: new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'), isSigner: false, isWritable: false },
          { pubkey: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'), isSigner: false, isWritable: false },
          { pubkey: PublicKey.default, isSigner: false, isWritable: false },
          { pubkey: new PublicKey('SysvarRent111111111111111111111111111111111'), isSigner: false, isWritable: false }
        ],
        programId,
        data
      });
      
      // Use as any to avoid the type incompatibility between the two Connection types
      return await executeTransaction(
        program.provider.connection as any,
        program.provider.wallet as AnchorWallet,
        [instruction]
      );
    } catch (error) {
      console.error("Error during requestWithdrawal:", error);
      const typedError = error instanceof Error ? error : new Error(String(error));
      return {
        success: false,
        error: typedError
      };
    }
  },

  resetState: () => {
    set({
      program: null,
      stats: null,
      state: {
        wallet: null,
        connection: null,
        isProcessing: false,
        lastError: null,
      }
    });
  }
}));