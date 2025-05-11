'use client';

import { useState, useEffect } from 'react';
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { useWalletStore } from '@/stores/use-wallet-store';

const NETWORK_MINTS = {
    mainnet: {
        USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    },
    devnet: {
        USDC: 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr',
        USDT: 'J2B12TxqtZkXtMAPY1BX2noiTSDNrz4VqiKfU5Sh9t5d'
    }
};

interface TokenBalance {
    mint: string;
    symbol: string;
    balance: number;
    decimals: number;
    uiBalance: number;
}

interface WalletBalances {
    isLoading: boolean;
    error: string | null;
    balances: TokenBalance[];
    refetch: () => Promise<void>;
}

export function useWalletBalances(): WalletBalances {
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [balances, setBalances] = useState<TokenBalance[]>([]);

    const { publicKey, connection } = useWalletStore();

    const isMainnet = process.env.NEXT_PUBLIC_SOLANA_NETWORK === 'mainnet';
    const network = isMainnet ? 'mainnet' : 'devnet';
    const mints = NETWORK_MINTS[network];

    const fetchBalances = async () => {
        if (!publicKey || !connection) {
            setBalances([]);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const tokens: TokenBalance[] = [];

            const tokensToFetch = [
                { mint: mints.USDC, symbol: 'USDC', decimals: 6 },
                { mint: mints.USDT, symbol: 'USDT', decimals: 9 }
            ];

            // Fetch each token's balance
            for (const token of tokensToFetch) {
                try {
                    const mintPubkey = new PublicKey(token.mint);
                    const tokenAccount = await getAssociatedTokenAddress(
                        mintPubkey,
                        publicKey
                    );

                    try {
                        const accountInfo = await connection.getTokenAccountBalance(tokenAccount);
                        const rawBalance = accountInfo.value.amount;
                        const uiBalance = accountInfo.value.uiAmount || 0;

                        tokens.push({
                            mint: token.mint,
                            symbol: token.symbol,
                            balance: Number(rawBalance),
                            decimals: token.decimals,
                            uiBalance
                        });
                    } catch (err) {
                        tokens.push({
                            mint: token.mint,
                            symbol: token.symbol,
                            balance: 0,
                            decimals: token.decimals,
                            uiBalance: 0
                        });
                    }
                } catch (err) {
                    console.error(`Error fetching ${token.symbol} balance:`, err);
                }
            }

            setBalances(tokens);
        } catch (err) {
            console.error('Error fetching token balances:', err);
            setError(err instanceof Error ? err.message : 'Unknown error fetching balances');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (publicKey) {
            fetchBalances();
        } else {
            setBalances([]);
        }
    }, [publicKey?.toString()]);

    return {
        isLoading,
        error,
        balances,
        refetch: fetchBalances
    };
}