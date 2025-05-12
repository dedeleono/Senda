import { clusterApiUrl, Connection, PublicKey, Transaction } from "@solana/web3.js";
import { trpc } from "@/app/_trpc/client";
import { getProvider } from "@/utils/dapp-wallets";
import { loadFeePayerKeypair } from "@/utils/dapp-wallets";
import { 
    createAssociatedTokenAccountInstruction,
    getAssociatedTokenAddressSync,
} from "@solana/spl-token";

export const findFactoryPDA = (owner: PublicKey, programId: PublicKey): [PublicKey, number] => {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("factory"), owner.toBuffer()],
        programId
    );
};

export const findMintAuthPDA = (factoryPda: PublicKey, programId: PublicKey): [PublicKey, number] => {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("mint_auth"), factoryPda.toBuffer()],
        programId
    );
};

export const findEscrowPDA = (
    sender: PublicKey,
    receiver: PublicKey,
    programId: PublicKey
): [PublicKey, number] => {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("escrow"), sender.toBuffer(), receiver.toBuffer()],
        programId
    );
};

export const findVaultPDA = (
    escrowPda: PublicKey,
    mint: PublicKey,
    stableStr: string,
    programId: PublicKey
): [PublicKey, number] => {
    return PublicKey.findProgramAddressSync(
        [Buffer.from(`${stableStr}-vault`), escrowPda.toBuffer(), mint.toBuffer()],
        programId
    );
};

export const findDepositRecordPDA = (
    escrowPda: PublicKey,
    depositIdx: number,
    programId: PublicKey
): [PublicKey, number] => {

    const depositIdxBuf = Buffer.alloc(8);
    try {
        depositIdxBuf.writeBigUInt64LE(BigInt(depositIdx), 0);
    } catch (error) {
        const view = new DataView(new ArrayBuffer(8));
        view.setUint32(0, depositIdx, true)
        view.setUint32(4, 0, true);        

        Buffer.from(new Uint8Array(view.buffer)).copy(depositIdxBuf);
    }

    return PublicKey.findProgramAddressSync(
        [Buffer.from("deposit"), escrowPda.toBuffer(), depositIdxBuf],
        programId
    );
};

//Memoised RPC connection
let _sharedConnection: Connection | null = null;
export function getSharedConnection(): Connection {
    if (!_sharedConnection) {
        _sharedConnection = new Connection(
            process.env.NEXT_PUBLIC_SOLANA_RPC || clusterApiUrl('devnet')
        );
    }
    return _sharedConnection;
}

export const createInstructionData = (
    discriminator: number[],
    ...args: Array<{ type: 'u8' | 'u64' | 'pubkey', value: number | PublicKey }>
): Buffer => {

    let totalSize = 8;
    for (const arg of args) {
        switch (arg.type) {
            case 'u8': totalSize += 1; break;
            case 'u64': totalSize += 8; break;
            case 'pubkey': totalSize += 32; break;
        }
    }

    const data = Buffer.alloc(totalSize);

    Buffer.from(discriminator).copy(data, 0);

    let offset = 8;
    for (const arg of args) {
        switch (arg.type) {
            case 'u8':
                data.writeUInt8(arg.value as number, offset);
                offset += 1;
                break;
            case 'u64':
                try {
                    data.writeBigUInt64LE(BigInt(arg.value as number), offset);
                } catch (error) {
                    const view = new DataView(new ArrayBuffer(8));
                    view.setUint32(0, arg.value as number, true);
                    view.setUint32(4, 0, true);
                    Buffer.from(new Uint8Array(view.buffer)).copy(data, offset);
                }
                offset += 8;
                break;
            case 'pubkey':
                (arg.value as PublicKey).toBuffer().copy(data, offset);
                offset += 32;
                break;
        }
    }

    return data;
};

export const createAta = async (mint: PublicKey, owner: PublicKey) => {
    try {
        const { connection } = getProvider();
        const { keypair: feePayer } = loadFeePayerKeypair();
        
        // Get the ATA address
        const ataAddress = getAssociatedTokenAddressSync(
            mint,
            owner
        );

        try {
            // Check if the account already exists
            const account = await connection.getAccountInfo(ataAddress);
            if (account !== null) {
                return [ataAddress, false];
            }
        } catch (error) {
            console.log("Error checking account, proceeding with creation:", error);
        }

        // Create the instruction
        const ix = createAssociatedTokenAccountInstruction(
            feePayer.publicKey,
            ataAddress,
            owner,
            mint
        );

        // Create and send transaction
        const tx = new Transaction().add(ix);
        const latestBlockhash = await connection.getLatestBlockhash();
        tx.recentBlockhash = latestBlockhash.blockhash;
        tx.feePayer = feePayer.publicKey;

        const signature = await connection.sendTransaction(tx, [feePayer], {
            skipPreflight: false,
            preflightCommitment: "confirmed",
            maxRetries: 3
        });
        
        // Wait for confirmation
        await connection.confirmTransaction({
            signature,
            blockhash: latestBlockhash.blockhash,
            lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
        }, "confirmed");

        return [ataAddress, true];
    } catch (error: any) {
        // If the error indicates the account already exists, return the address
        if (error.message?.includes("already in use")) {
            const ataAddress = getAssociatedTokenAddressSync(mint, owner);
            return [ataAddress, false];
        }
        console.error("Failed to create ATA:", error);
        throw error;
    }
};