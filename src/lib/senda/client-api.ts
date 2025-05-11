import { PublicKey } from "@solana/web3.js";
import { TransactionResult } from "../utils/solana-transaction";

export const initEscrow = async (senderPublicKey: PublicKey, receiverPublicKey: PublicKey, seed: number) => {
    try {
        const res = await fetch('/api/trpc/sendaRouter.initEscrow', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                sender: senderPublicKey,
                receiver: receiverPublicKey,
                seed
            }),
        }).then(r => r.json());
        return { success: true, signature: res.signature } as TransactionResult;
    } catch (error) {
        const typed = error instanceof Error ? error : new Error(String(error));
        return { success: false, error: typed } as TransactionResult;
    }
};