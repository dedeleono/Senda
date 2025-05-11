import { create } from 'zustand';
import { PublicKey, TransactionInstruction, Transaction, VersionedTransaction } from '@solana/web3.js';
import { AnchorProvider, Program, setProvider, Idl } from '@coral-xyz/anchor';
import { SendaDapp } from '../lib/IDL';
import { executeTransaction, TransactionResult } from '@/lib/utils/solana-transaction';
import { USDC_MINT, USDT_MINT } from '@/lib/constants';
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { FactoryStats, EscrowStats, InitEscrowParams, DepositParams, CancelParams, ReleaseParams, EscrowState } from '@/types/senda-program';
import { findFactoryPDA, findMintAuthPDA, findEscrowPDA, findVaultPDA, findDepositRecordPDA, createInstructionData } from '@/lib/senda/helpers';
import { SENDA_IDL } from '../lib/IDL/sendaIDL';
import { useWalletStore } from './use-wallet-store';

const { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } = await import('@solana/spl-token');

// Constants for Solana system programs
const SYSTEM_PROGRAM_ID = new PublicKey("11111111111111111111111111111111");
const SYSVAR_RENT_PUBKEY = new PublicKey("SysvarRent111111111111111111111111111111111");

interface SendaProgramState {
  isProcessing: boolean;
  lastError: Error | null;
}

export interface SendaStore {
  program: Program<SendaDapp> | null;
  stats: FactoryStats | null;
  state: SendaProgramState;

  initState: () => Promise<void>;
  
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
  program: null,
  stats: {} as FactoryStats,
  state: {
    isProcessing: false,
    lastError: null,
  } as SendaProgramState,
  
  initState: async () => {
    const { program: existingProgram } = get();
    if (existingProgram) {
      console.log('[useSendaProgram] Program already initialized');
      return;
    }

    try {
      const { keypair, connection, publicKey } = useWalletStore.getState();
      
      if (!keypair || !connection || !publicKey) {
        throw new Error('Wallet not initialized');
      }

      // Create the provider with our wallet
      const provider = new AnchorProvider(
        connection as any,
        {
          publicKey,
          signTransaction: async (tx: any) => {
            tx.partialSign(keypair);
            return tx;
          },
          signAllTransactions: async (txs: any[]) => {
            txs.forEach(tx => tx.partialSign(keypair));
            return txs;
          },
        },
        AnchorProvider.defaultOptions()
      );
      
      setProvider(provider);

      // Initialize program
      const program = new Program<SendaDapp>(
        SENDA_IDL as unknown as Idl,
        provider
      );

      set({
        program,
        state: {
          isProcessing: false,
          lastError: null
        }
      });

      console.log('Program successfully initialized with wallet:', publicKey.toString());
      
    } catch (error) {
      console.error('Error during program initialization:', error);
      set({ 
        program: null,
        state: { 
          isProcessing: false,
          lastError: error instanceof Error ? error : new Error(String(error))
        }
      });
    }
  },

  getFactoryStats: async () => {
    try {
      set({ state: { ...get().state, isProcessing: true } });
      const { program } = get();
      
      if (!program) {
        throw new Error('Program not initialized');
      }
      
      const programId = program.programId;
      
      if (!program.provider || !program.provider.connection) {
        throw new Error('Provider connection not available');
      }
      
      // Find the factory PDA - need a wallet or owner
      let factoryOwner: PublicKey;
      
      if (program.provider.publicKey) {
        factoryOwner = program.provider.publicKey;
      } else {
        // If no wallet is connected, we can't get the factory stats
        throw new Error('Wallet connection required to fetch factory stats');
      }
      
      const [factoryPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("factory"), factoryOwner.toBuffer()],
        programId
      );
      
      console.log("Fetching factory stats for:", factoryPda.toString());
      
      // Fetch the factory account data
      const factoryAccount = await program.provider.connection.getAccountInfo(factoryPda);
      
      if (!factoryAccount) {
        console.log("Factory account not found, it may need to be initialized first");
        set({ 
          stats: null, 
          state: { 
            ...get().state, 
            isProcessing: false,
            lastError: new Error("Factory account not found. Please initialize the factory first.")
          } 
        });
        return null;
      }
      
      // In a real implementation with IDL, you would decode the account data
      // For now, we'll create a placeholder implementation
      
      // Let's try to get all escrow accounts for this factory
      const escrows: Array<{ Escrow: PublicKey, state: EscrowState, stats: EscrowStats }> = [];
      
      // Here we would typically query for all escrow accounts associated with this factory
      
      const factoryStats: FactoryStats = {
        totalDeposits: 0,
        totalDepositsValue: 0,
        totalDepositsCount: 0,
        totalDepositsValueUSDC: 0,
        totalDepositsValueUSDT: 0,
        totalDepositsCountUSDC: 0,
        totalDepositsCountUSDT: 0,
        escrows: escrows
      };
      
      set({ 
        stats: factoryStats, 
        state: { 
          ...get().state, 
          isProcessing: false,
          lastError: null
        } 
      });
      return factoryStats;
    } catch (error) {
      console.error("Error fetching factory stats:", error);
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

      // Fetch the escrow account data
      const escrowAccount = await program.provider.connection.getAccountInfo(escrowPublicKey);
      
      if (!escrowAccount) {
        console.log("Escrow account not found:", escrowPublicKey.toString());
        set({ 
          state: { 
            ...get().state, 
            isProcessing: false,
            lastError: new Error(`Escrow account not found: ${escrowPublicKey.toString()}`)
          }
        });
        return null;
      }
      
      console.log(`Fetched escrow account data for ${escrowPublicKey.toString()}, size: ${escrowAccount.data.length} bytes`);
      
      // In a production implementation with full IDL, you would decode the account data
      // For now, we'll create a placeholder that would be replaced with actual decoded data
      
      // First try to read some basic data from the account (simplified parsing)
      // This is a placeholder - in production, use proper account deserialization based on your IDL
      
      let originalDepositor = PublicKey.default;
      let receiver = PublicKey.default;
      let state = EscrowState.Active;
      
      // If account data is of sufficient size, we can try to extract PublicKeys
      // This assumes your account structure starts with pubkeys - adjust based on your actual layout
      if (escrowAccount.data.length >= 64) {
        try {
          // Extract pubkeys from first 32 bytes and second 32 bytes
          originalDepositor = new PublicKey(escrowAccount.data.slice(0, 32));
          receiver = new PublicKey(escrowAccount.data.slice(32, 64));
          console.log(`Parsed pubkeys - depositor: ${originalDepositor.toString()}, receiver: ${receiver.toString()}`);
        } catch (e) {
          console.warn("Could not parse public keys from escrow data:", e);
        }
      }
      
      // Here we would query for all deposits associated with this escrow
      // For now, returning a placeholder implementation
      
      const escrowStats: EscrowStats = {
        originalDepositor: originalDepositor.toString(),
        receiver: receiver.toString(),
        pendingWithdrawals: 0,
        completedDeposits: 0,
        cancelledDeposits: 0,
        disputedDeposits: 0,
        totalValue: 0,
        totalValueUSDC: 0,
        totalValueUSDT: 0,
        state: state,
        deposits: []
      };
      
      set({ 
        state: { 
          ...get().state, 
          isProcessing: false,
          lastError: null
        }
      });
      return escrowStats;
    } catch (error) {
      console.error("Error fetching escrow stats:", error);
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
  
  initEscrow: async ({ senderPublicKey, receiverPublicKey, seed = 0 }: InitEscrowParams): Promise<TransactionResult> => {
    try {
      const { program } = get();
      if (!program) {
        throw new Error('Program not initialized');
      }

      if (!program.provider.publicKey || !program.provider.wallet) {
        throw new Error('Wallet connection required for escrow creation. Please connect your wallet to continue.');
      }

      // Make sure we're using the connected wallet as the sender
      if (program.provider.publicKey.toString() !== senderPublicKey) {
        throw new Error('The connected wallet must be the sender. Please connect the correct wallet.');
      }

      const programId = program.programId;
      const sender = new PublicKey(senderPublicKey);
      const receiver = new PublicKey(receiverPublicKey);

      // Define mint PublicKeys
      const usdcMintPubkey = new PublicKey(USDC_MINT);
      const usdtMintPubkey = new PublicKey(USDT_MINT);

      // Use helper functions for PDA derivation
      const [escrowPda] = findEscrowPDA(sender, receiver, programId);
      const [vaultUsdc] = findVaultPDA(escrowPda, usdcMintPubkey, "usdc", programId);
      const [vaultUsdt] = findVaultPDA(escrowPda, usdtMintPubkey, "usdt", programId);
      
      // Get the token accounts for sender and receiver - exactly as in the tests
      const senderUsdcAta = await getAssociatedTokenAddress(usdcMintPubkey, sender, false);
      const senderUsdtAta = await getAssociatedTokenAddress(usdtMintPubkey, sender, false);
      const receiverUsdcAta = await getAssociatedTokenAddress(usdcMintPubkey, receiver, false);
      const receiverUsdtAta = await getAssociatedTokenAddress(usdtMintPubkey, receiver, false);

      // Utility: Check and create ATAs if missing
      const ataChecks: Array<{ ata: PublicKey; owner: PublicKey; mint: PublicKey } > = [
        { ata: senderUsdcAta, owner: sender, mint: usdcMintPubkey },
        { ata: senderUsdtAta, owner: sender, mint: usdtMintPubkey },
        { ata: receiverUsdcAta, owner: receiver, mint: usdcMintPubkey },
        { ata: receiverUsdtAta, owner: receiver, mint: usdtMintPubkey },
      ];
      const ataInstructions: TransactionInstruction[] = [];
      for (const { ata, owner, mint } of ataChecks) {
        const info = await program.provider.connection.getAccountInfo(ata);
        if (!info) {
          ataInstructions.push(
            createAssociatedTokenAccountInstruction(
              sender, // payer
              ata,    // ata
              owner,  // owner
              mint,
              TOKEN_PROGRAM_ID,
              ASSOCIATED_TOKEN_PROGRAM_ID
            )
          );
        }
      }
      if (ataInstructions.length > 0) {
        // Create all missing ATAs in a single transaction
        const ataResult = await executeTransaction(
          program.provider.connection as any,
          program.provider.wallet as any,
          ataInstructions
        );
        if (!ataResult.success) {
          return ataResult;
        }
      }

      // Use the helper function to create instruction data
      const initEscrowData = createInstructionData(
        [243, 160, 77, 153, 11, 92, 48, 209], // discriminator for init_escrow
        { type: 'u64', value: seed }
      );
      
      // Create the instruction with the exact same account structure as in the tests
      const initEscrowIx = new TransactionInstruction({
        keys: [
          { pubkey: escrowPda, isSigner: false, isWritable: true },
          { pubkey: sender, isSigner: true, isWritable: true },
          { pubkey: receiver, isSigner: false, isWritable: false },
          { pubkey: senderUsdcAta, isSigner: false, isWritable: true },
          { pubkey: senderUsdtAta, isSigner: false, isWritable: true },
          { pubkey: receiverUsdcAta, isSigner: false, isWritable: true },
          { pubkey: receiverUsdtAta, isSigner: false, isWritable: true },
          { pubkey: usdcMintPubkey, isSigner: false, isWritable: false },
          { pubkey: usdtMintPubkey, isSigner: false, isWritable: false },
          { pubkey: vaultUsdc, isSigner: false, isWritable: true },
          { pubkey: vaultUsdt, isSigner: false, isWritable: true },
          { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
        ],
        programId,
        data: initEscrowData
      });
      
      return await executeTransaction(
        program.provider.connection as any,
        program.provider.wallet as any,
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
      
      // Find vault addresses using helper function
      const [vaultUsdc] = findVaultPDA(escrow, usdcMintPubkey, "usdc", programId);
      const [vaultUsdt] = findVaultPDA(escrow, usdtMintPubkey, "usdt", programId);
      
      // Map enum values
      const stableValue = stable === 'usdc' ? 0 : 1; // 0 for USDC, 1 for USDT
      const authValue = authorization === 'sender' ? 0 : authorization === 'receiver' ? 1 : 2; // 0 for sender, 1 for receiver, 2 for both
      
      // Create the instruction data with the helper function
      const instructionData = createInstructionData(
        [98, 231, 20, 217, 235, 33, 213, 28], // deposit discriminator
        { type: 'u64', value: amount * 1000000 } // Convert to micros (USDC/USDT have 6 decimals)
      );
      
      // Get the next deposit index
      const depositCount = 0; // This would ideally come from the escrow account state
      
      // Find the deposit record PDA using helper function
      const [depositRecord] = findDepositRecordPDA(escrow, depositCount, programId);
      
      // Get associated token addresses
      const { getAssociatedTokenAddress } = await import('@solana/spl-token');
      
      // Find the associated token accounts for the depositor
      const depositorUsdcAta = await getAssociatedTokenAddress(
        usdcMintPubkey,
        depositor,
        false
      );
      
      const depositorUsdtAta = await getAssociatedTokenAddress(
        usdtMintPubkey,
        depositor,
        false
      );
      
      // Choose which vault to interact with based on stable
      const targetVault = stable === 'usdc' ? vaultUsdc : vaultUsdt;
      const targetMint = stable === 'usdc' ? usdcMintPubkey : usdtMintPubkey;
      const depositorAta = stable === 'usdc' ? depositorUsdcAta : depositorUsdtAta;

      const depositIx = new TransactionInstruction({
        keys: [
          { pubkey: depositor, isSigner: true, isWritable: true },
          { pubkey: counterparty, isSigner: false, isWritable: false },
          { pubkey: usdcMintPubkey, isSigner: false, isWritable: false },
          { pubkey: usdtMintPubkey, isSigner: false, isWritable: false },
          // Add the required additional accounts
          { pubkey: escrow, isSigner: false, isWritable: true },
          { pubkey: depositorAta, isSigner: false, isWritable: true },
          { pubkey: targetVault, isSigner: false, isWritable: true },
          { pubkey: depositRecord, isSigner: false, isWritable: true },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false }
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
        program.provider.wallet as any,
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
      
      // Use helper functions for PDAs
      const [vaultUsdc] = findVaultPDA(escrow, usdcMintPubkey, "usdc", programId);
      const [vaultUsdt] = findVaultPDA(escrow, usdtMintPubkey, "usdt", programId);
      const [depositRecord] = findDepositRecordPDA(escrow, depositIdx, programId);

      // Get the depositor's ATAs
      const { getAssociatedTokenAddress } = await import('@solana/spl-token');
      const depositorUsdcAta = await getAssociatedTokenAddress(usdcMintPubkey, originalDepositor, false);
      const depositorUsdtAta = await getAssociatedTokenAddress(usdtMintPubkey, originalDepositor, false);
      
      // Create instruction data with helper function
      const cancelData = createInstructionData(
        [232, 219, 223, 41, 219, 236, 220, 190], // cancel discriminator
        { type: 'u64', value: depositIdx }
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
          { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false }
        ],
        programId,
        data: cancelData
      });
      
      console.log("Cancelling deposit with parameters:", {
        escrow: escrow.toString(),
        depositor: originalDepositor.toString(),
        depositIdx,
        depositRecord: depositRecord.toString(),
      });
      
      return await executeTransaction(
        program.provider.connection as any,
        program.provider.wallet as any,
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
      
      // Use helper functions for PDAs
      const [vaultUsdc] = findVaultPDA(escrow, usdcMintPubkey, "usdc", programId);
      const [vaultUsdt] = findVaultPDA(escrow, usdtMintPubkey, "usdt", programId);
      const [depositRecord] = findDepositRecordPDA(escrow, depositIdx, programId);
      
      // Get token accounts for the relevant parties
      const { getAssociatedTokenAddress } = await import('@solana/spl-token');
      
      // Get depositor token accounts
      const depositorUsdcAta = await getAssociatedTokenAddress(usdcMintPubkey, originalDepositor, false);
      const depositorUsdtAta = await getAssociatedTokenAddress(usdtMintPubkey, originalDepositor, false);
      
      // Get counterparty token accounts
      const counterpartyUsdcAta = await getAssociatedTokenAddress(usdcMintPubkey, counterparty, false);
      const counterpartyUsdtAta = await getAssociatedTokenAddress(usdtMintPubkey, counterparty, false);
      
      // Create instruction data with helper function
      const releaseData = createInstructionData(
        [253, 249, 15, 206, 28, 127, 193, 241], // release discriminator
        { type: 'u64', value: depositIdx }
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
          { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false }
        ],
        programId,
        data: releaseData
      });
      
      return await executeTransaction(
        program.provider.connection as any,
        program.provider.wallet as any,
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
        isProcessing: false,
        lastError: null,
      }
    });
  }
}));