'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Button } from '@/components/ui/button';
import { Wallet, Plus, Trash } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/app/_trpc/client';
import bs58 from 'bs58';
import Image from 'next/image';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { WalletName } from '@solana/wallet-adapter-base';
import { useAuth } from '@/hooks/use-auth';
import phantom from "@/public/phantom.svg"
import solflare from "@/public/solflare.svg"

interface LinkedWalletData {
  id: string;
  publicKey: string;
  linkedAt: string;
  isMain: boolean;
  provider?: string;
}

export function LinkExternalWalletButton() {
  const wallet = useWallet();
  const { publicKey, signMessage, connected, disconnect, select, connect, wallets } = wallet;
  
  const { session, isAuthenticated, isLoading } = useAuth();
  
  const [isLinking, setIsLinking] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [linkingStatus, setLinkingStatus] = useState<'idle' | 'requesting' | 'signing' | 'verifying'>('idle');
  const [clickMap, setClickMap] = useState<{[key: string]: boolean}>({});
  const [activeTab, setActiveTab] = useState<string>('wallets');
  
  // Queries and mutations
  const generateNonceMutation = trpc.walletRouter.generateNonce.useMutation();
  const verifyAndLinkMutation = trpc.walletRouter.verifyAndLinkWallet.useMutation();
  const removeLinkedWalletMutation = trpc.walletRouter.removeLinkedWallet.useMutation();
  
  const { 
    data: userWallets,
    isLoading: isLoadingWallets,
    refetch: refetchWallets
  } = trpc.walletRouter.getAllUserWallets.useQuery(undefined, {
    enabled: showDialog,
  });

  // Save the current wallet adapter name when connected
  const [connectedWalletName, setConnectedWalletName] = useState<string | undefined>(undefined);
  
  useEffect(() => {
    if (connected && wallet.wallet) {
      setConnectedWalletName(wallet.wallet.adapter.name);
      setClickMap({});
    } else {
      setConnectedWalletName(undefined);
    }
  }, [connected, wallet.wallet]);

  // Filter out only linked wallets (excludes the sendaWallet)
  const linkedWallets = userWallets?.filter(wallet => !wallet.isMain) as LinkedWalletData[] || [];

  const handleDisconnect = () => {
    disconnect().catch(error => {
      console.error('Error disconnecting wallet:', error);
    });
  };

  const handleConnectWallet = (walletName: WalletName) => {
    // Get the wallet adapter
    const adapter = wallets.find(w => w.adapter.name === walletName);
    if (!adapter) {
      toast.error(`Wallet ${walletName.toString()} not found`);
      return;
    }
    
    const walletKey = walletName.toString();
    const isFirstClick = !clickMap[walletKey];
    
    if (connected) {
      handleDisconnect();
      setTimeout(() => {
        select(walletName);
        console.log(`Selected wallet: ${walletName.toString()}`);
      }, 200);
      return;
    }
    
    if (isFirstClick) {
      select(walletName);
      setClickMap(prev => ({...prev, [walletKey]: true}));
      
      toast.info(`Wallet ${walletName} selected. Click again to connect.`, {
        duration: 4000,
        id: `wallet-connect-${walletKey}`
      });
      
      return;
    }
    
    connect().catch(error => {
      console.error('Connection error:', error);
      toast.error('Failed to connect wallet');
    });
    
    setClickMap(prev => ({...prev, [walletKey]: false}));
  };
  
  const hasClickedOnce = (walletName: string): boolean => {
    return !!clickMap[walletName];
  };

  const handleLinkWallet = async () => {
    if (!publicKey || !signMessage || !wallet.wallet) {
      toast.error('Wallet not connected. Please connect your wallet first.');
      return;
    }

    try {
      setIsLinking(true);
      setLinkingStatus('requesting');

      const { nonce } = await generateNonceMutation.mutateAsync({ 
        publicKey: publicKey.toString() 
      });

      setLinkingStatus('signing');
      
      const messageUint8 = new TextEncoder().encode(nonce);
      const signatureUint8 = await signMessage(messageUint8);
      const signature = bs58.encode(signatureUint8);

      setLinkingStatus('verifying');

      try {
        const result = await verifyAndLinkMutation.mutateAsync({
          publicKey: publicKey.toString(),
          signature,
          nonce,
          provider: wallet.wallet.adapter.name
        });

        if (result.success) {
          toast.success('Wallet linked successfully');
          refetchWallets();
          setActiveTab('wallets'); // Switch to wallets tab after linking
        }
      } catch (err: any) {
        console.error('Server error linking wallet:', err);
        
        if (err.message && err.message.includes('authentication')) {
          toast.error('Authentication error. Please sign in again.');
        } else if (err.data?.code === 'UNAUTHORIZED') {
          toast.error('Session expired. Please refresh the page and try again.');
        } else if (err.data?.code === 'CONFLICT') {
          toast.error('This wallet is already linked to another account.');
        } else {
          toast.error(err.message || 'Failed to link wallet on server');
        }
      }
    } catch (error) {
      console.error('Client error linking wallet:', error);
      toast.error(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setIsLinking(false);
      setLinkingStatus('idle');
    }
  };

  const handleRemoveWallet = async (walletpk: string) => {
    try {
      await removeLinkedWalletMutation.mutateAsync({ walletPk: walletpk });
      toast.success('Wallet removed successfully');
      refetchWallets();
    } catch (error) {
      console.error('Error removing wallet:', error);
      toast.error('Failed to remove wallet');
    }
  };

  // Format wallet address for display
  const formatWalletAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const walletProviderLogo = (provider: string) => {
    switch (provider) {
      case 'Phantom':
        return phantom.src;
      case 'Solflare':
        return solflare.src;
      default:
        return phantom.src;
    }
  };

  return (
    <>
      <Dialog
        open={showDialog}
        onOpenChange={(open) => {
          setShowDialog(open)
          if (open) {
            refetchWallets()
          }
        }}
      >
        <DialogTrigger asChild>
          <Button
            variant="outline"
            className="flex items-center gap-2 !bg-foreground/85 text-[#f6ead7] cursor-pointer"
            disabled={isLoading}
          >
            <Wallet className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Wallets</DialogTitle>
            <DialogDescription>Connect and manage external wallets with your Senda account.</DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="wallets" value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="wallets">My Wallets</TabsTrigger>
              <TabsTrigger value="link">Link New Wallet</TabsTrigger>
            </TabsList>

            <TabsContent value="wallets" className="space-y-4 mt-4">
              {isLoadingWallets ? (
                <div className="py-4 text-center text-sm text-muted-foreground">Loading your wallets...</div>
              ) : linkedWallets.length === 0 ? (
                <div className="py-6 text-center">
                  <p className="text-sm text-muted-foreground mb-4">You haven't linked any external wallets yet.</p>
                  <Button onClick={() => setActiveTab('link')} variant="outline" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Link a Wallet
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium mb-2">Your External Wallets</h3>
                  {linkedWallets.map((wallet) => (
                    <Card key={wallet.publicKey} className="overflow-hidden border border-muted/60 rounded-md">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full border-none flex items-center justify-center">
                              <Image
                                src={walletProviderLogo(wallet.provider || '')}
                                alt={wallet.provider || 'Wallet'}
                                width={24}
                                height={24}
                                className="object-contain"
                              />
                            </div>
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-xs">{wallet.provider || 'External Wallet'}</span>
                              </div>
                              {wallet.provider && (
                                <Badge variant="secondary" className="text-sm p-1 h-4 !bg-muted/60 !rounded-md">
                                  {formatWalletAddress(wallet.publicKey)}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive/90 hover:bg-destructive/10 cursor-pointer"
                            onClick={() => handleRemoveWallet(wallet.publicKey)}
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="link" className="space-y-4 mt-4">
              {!connected ? (
                <>
                  <p className="text-sm text-center text-muted-foreground mb-2">Connect your wallet first:</p>

                  <div className="flex flex-col gap-2 w-full">
                    {wallets.map((walletOption) => (
                      <Button
                        key={walletOption.adapter.name}
                        variant={hasClickedOnce(walletOption.adapter.name) ? 'default' : 'outline'}
                        className={`w-full flex items-center justify-between ${
                          hasClickedOnce(walletOption.adapter.name)
                            ? 'bg-primary text-primary-foreground animate-pulse'
                            : ''
                        }`}
                        onClick={() => handleConnectWallet(walletOption.adapter.name as WalletName)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="relative h-6 w-6 overflow-hidden rounded-full flex items-center justify-center">
                            <Image
                              src={'https://phantom.app/favicon.ico'}
                              alt={walletOption.adapter.name}
                              width={20}
                              height={20}
                              className="object-contain"
                            />
                          </div>
                          <span>{walletOption.adapter.name}</span>
                        </div>
                        <span
                          className={`text-xs ${hasClickedOnce(walletOption.adapter.name) ? 'text-primary-foreground' : 'text-muted-foreground'}`}
                        >
                          {wallet.connecting
                            ? 'Connecting...'
                            : hasClickedOnce(walletOption.adapter.name)
                              ? 'Click again to connect'
                              : 'Connect'}
                        </span>
                      </Button>
                    ))}
                  </div>
                  {Object.values(clickMap).some((v) => v) && (
                    <p className="text-xs text-center text-primary font-medium mt-2 px-2 py-1 bg-primary/10 rounded-md">
                      Wallet selected. Click the highlighted button again to open the wallet.
                    </p>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center gap-4 w-full">
                  <div className="flex flex-col items-center justify-between w-full rounded-lg border p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="relative h-8 w-8 overflow-hidden rounded-full flex items-center justify-center">
                        <Image
                          src={'https://phantom.app/favicon.ico'}
                          alt={connectedWalletName || 'Wallet'}
                          width={24}
                          height={24}
                          className="object-contain"
                        />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-medium">{connectedWalletName}</span>
                        <Badge variant="outline" className="text-xs py-0">
                          {publicKey ? formatWalletAddress(publicKey.toString()) : ''}
                        </Badge>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleDisconnect}>
                      Disconnect
                    </Button>
                  </div>

                  <Button className="w-full" onClick={handleLinkWallet} disabled={isLinking}>
                    {isLinking ? (
                      <>
                        {linkingStatus === 'requesting' && 'Generating nonce...'}
                        {linkingStatus === 'signing' && 'Please sign the message...'}
                        {linkingStatus === 'verifying' && 'Verifying signature...'}
                      </>
                    ) : (
                      'Link This Wallet'
                    )}
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter className="sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setShowDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
} 