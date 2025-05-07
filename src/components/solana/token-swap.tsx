'use client';

import { useState, useEffect } from 'react';
import { 
  getSwapQuote, 
  createSwapTransaction, 
  SOLANA_MINTS, 
  DEVNET_MINTS,
  DEFAULT_SWAP_CONFIG,
  type SwapParams,
  type SwapQuote
} from '@/lib/utils/swap';
import { useSendaProgram } from '@/stores/use-senda-program';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { toast } from 'sonner';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';

interface TokenSwapProps {
  className?: string;
}

export function TokenSwap({ className }: TokenSwapProps) {
  const [amount, setAmount] = useState<string>('0.1');
  const [outputToken, setOutputToken] = useState<'USDC' | 'USDT'>('USDC');
  const [slippage, setSlippage] = useState<number>(1); // 1%
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const { 
    connection, 
    sendaWalletPublicKey, 
    setProcessing,
    activeWallet,
    linkedWallets
  } = useSendaProgram();
  
  const MINTS = process.env.NEXT_PUBLIC_SOLANA_NETWORK === 'mainnet' 
    ? SOLANA_MINTS 
    : DEVNET_MINTS;
    
  useEffect(() => {
    setQuote(null);
    setError(null);
  }, [amount, outputToken, slippage]);
  
  const getActiveWalletPublicKey = (): string | null => {
    if (!sendaWalletPublicKey) return null;
    
    if (activeWallet === 'senda') {
      return sendaWalletPublicKey;
    }
    
    const linkedWallet = linkedWallets.find(wallet => wallet.id === activeWallet);
    return linkedWallet?.publicKey || sendaWalletPublicKey;
  };
  
  const getQuote = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      if (!connection) {
        throw new Error('Solana connection not established');
      }
      
      const walletPublicKey = getActiveWalletPublicKey();
      if (!walletPublicKey) {
        throw new Error('No wallet available for swapping');
      }
      
      const numericAmount = parseFloat(amount);
      if (isNaN(numericAmount) || numericAmount <= 0) {
        throw new Error('Invalid amount');
      }
      
      const swapParams: SwapParams = {
        fromMint: MINTS.SOL,
        toMint: MINTS[outputToken],
        amount: numericAmount,
        slippageBps: slippage * 100,
        walletPublicKey,
      };
      
      const swapQuote = await getSwapQuote(
        connection,
        swapParams,
        DEFAULT_SWAP_CONFIG
      );
      
      setQuote(swapQuote);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      toast.error(`Failed to get swap quote: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  const executeSwap = async () => {
    if (!quote || !connection || !sendaWalletPublicKey) {
      toast.error('Cannot execute swap: missing required data');
      return;
    }
    
    setIsLoading(true);
    setProcessing(true);
    
    try {
      const walletPublicKey = getActiveWalletPublicKey();
      if (!walletPublicKey) {
        throw new Error('No wallet available for swapping');
      }
      
      const transaction = createSwapTransaction(quote, walletPublicKey);
      
      // This should be replaced with your custom transaction signing and execution logic
      // For example, you might use API routes to sign and send transactions server-side
      // or use a connected client-side wallet - @todo replace with tRPC
      
      const response = await fetch('/api/solana/swap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          serializedTransaction: Buffer.from(transaction.serialize({ requireAllSignatures: false })).toString('base64'),
          walletPublicKey,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to execute swap');
      }
      
      const result = await response.json();
      
      // Reset state
      setQuote(null);
      setAmount('0.1');
      
      toast.success('Swap executed successfully!');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      toast.error(`Failed to execute swap: ${errorMessage}`);
    } finally {
      setIsLoading(false);
      setProcessing(false);
    }
  };
  
  return (
    <div className={`p-4 bg-card rounded-lg shadow-md ${className}`}>
      <h2 className="text-xl font-semibold mb-4">Swap Tokens</h2>
      
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="amount">SOL Amount</Label>
          <div className="flex items-center space-x-2">
            <Input
              id="amount"
              type="number"
              min="0.001"
              step="0.001"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={isLoading}
              className="flex-1"
            />
            <span className="text-sm font-medium">SOL</span>
          </div>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="outputToken">Receive</Label>
          <Select
            value={outputToken}
            onValueChange={(value) => setOutputToken(value as 'USDC' | 'USDT')}
            disabled={isLoading}
          >
            <SelectTrigger id="outputToken" className="w-full">
              <SelectValue placeholder="Select token" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="USDC">USDC</SelectItem>
              <SelectItem value="USDT">USDT</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {/* Slippage tolerance */}
        <div className="space-y-2">
          <Label htmlFor="slippage">Slippage Tolerance (%)</Label>
          <Input
            id="slippage"
            type="number"
            min="0.1"
            max="5"
            step="0.1"
            value={slippage}
            onChange={(e) => setSlippage(parseFloat(e.target.value))}
            disabled={isLoading}
          />
        </div>
        
        {/* Quote information */}
        {quote && (
          <div className="mt-4 p-3 bg-muted rounded-md">
            <h3 className="font-medium mb-2">Swap Quote</h3>
            <div className="space-y-1 text-sm">
              <p>You pay: {quote.inAmount.toFixed(6)} SOL</p>
              <p>You receive: {quote.expectedOutAmount.toFixed(6)} {outputToken}</p>
              {quote.feeAmount > 0 && (
                <p className="text-muted-foreground">
                  Fee: {quote.feeAmount.toFixed(6)} {outputToken}
                </p>
              )}
              <p className="text-muted-foreground">
                Price impact: {(quote.priceImpactPct * 100).toFixed(2)}%
              </p>
            </div>
          </div>
        )}
        
        {error && (
          <div className="mt-2 text-sm text-red-500">
            {error}
          </div>
        )}
        
        <div className="flex space-x-2 pt-2">
          {!quote ? (
            <Button
              onClick={getQuote}
              disabled={isLoading || !sendaWalletPublicKey || parseFloat(amount) <= 0}
              className="w-full"
            >
              {isLoading ? 'Loading...' : 'Get Quote'}
            </Button>
          ) : (
            <div className="flex w-full space-x-2">
              <Button
                variant="outline"
                onClick={() => setQuote(null)}
                disabled={isLoading}
                className="w-1/2"
              >
                Cancel
              </Button>
              <Button
                onClick={executeSwap}
                disabled={isLoading}
                className="w-1/2"
              >
                Swap Now
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 