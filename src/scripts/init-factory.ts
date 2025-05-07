import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

dotenv.config({ path: '.env' });

async function main() {
    console.log("Running init-factory.ts script...");
    
    const rpcUrl = process.env.SOLANA_URL || "https://api.devnet.solana.com";
    console.log("Using Solana RPC URL:", rpcUrl);

    const program = process.env.SENDA_PROGRAM_ID!;
    const connection = new Connection(rpcUrl, "confirmed");
    const programId = new PublicKey(program);
    
    const configPath = join(homedir(), '.config', 'solana', 'id.json');
    console.log("Loading keypair from:", configPath);
    
    try {
        const secret = JSON.parse(readFileSync(configPath, "utf-8")) as number[];
        const walletKeypair = Keypair.fromSecretKey(Uint8Array.from(secret));
        const wallet = walletKeypair.publicKey;
        
        console.log("Loaded wallet public key:", wallet.toBase58());

        // PDAs
        const [factoryPda, factoryBump] = PublicKey.findProgramAddressSync(
            [Buffer.from("factory"), wallet.toBuffer()],
            programId
        );
        const [mintAuthPda, mintAuthBump] = PublicKey.findProgramAddressSync(
            [Buffer.from("mint_auth"), factoryPda.toBuffer()],
            programId
        );

        console.log("Program ID:", programId.toBase58());
        console.log("Factory PDA:", factoryPda.toBase58());
        console.log("Factory Bump:", factoryBump);
        console.log("Mint Authority PDA:", mintAuthPda.toBase58());
        console.log("Mint Authority Bump:", mintAuthBump);
        
        const data = Buffer.from([0]);
        const initFactoryIx = new TransactionInstruction({
            keys: [
                { pubkey: factoryPda, isSigner: false, isWritable: true },
                { pubkey: mintAuthPda, isSigner: false, isWritable: true },
                { pubkey: wallet, isSigner: true, isWritable: true },
            ],
            programId,
            data,
        });
        
        try {
            const tx = new Transaction().add(initFactoryIx);
            const signature = await connection.sendTransaction(tx, [walletKeypair]);
            console.log("Transaction sent! Signature:", signature);
            
            await connection.confirmTransaction(signature, "confirmed");
            console.log("Transaction confirmed!");
        } catch (error) {
            console.error("Error sending transaction:", error);
        }
    } catch (error) {
        console.error("Error loading keypair:", error);
    }
}

main().catch(console.error);
