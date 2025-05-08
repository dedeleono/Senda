'use client';

import { useEffect, useState } from 'react';
import { usePrivyClient } from '@/lib/privy/client';
import { useSendaProgram } from '@/stores/use-senda-program';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bold, ChevronLeft, Copy, Italic, Underline, Wallet } from 'lucide-react';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import IceDoodle from '@/public/GroovySittingDoodle.svg';
import USDCLogo from '@/public/usdc-inverse.svg';
import USDTLogo from '@/public/Tether Logo.svg';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth'
import { trpc } from '@/app/_trpc/client'

// Define the available funding amounts
const FUNDING_AMOUNTS = [25, 50, 100, 250];

// Define the available assets
const ASSETS = [
  { id: 'USDC', name: 'USD Coin', symbol: 'USDC', logo: USDCLogo },
  { id: 'USDT', name: 'Tether', symbol: 'USDT', logo: USDTLogo },
];

export default function FundingPage() {
  const privyClient = usePrivyClient();
  const { isAuthenticated } = useAuth()
  const { data: walletPk } = trpc.walletRouter.getUserMainWallet.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
  })
  const searchParams = useSearchParams();
  
  // UI state
  const [selectedAmount, setSelectedAmount] = useState<number>(50);
  const [isLoading, setIsLoading] = useState(false);
  
  // Process status from URL parameters (used for callback redirection)
  useEffect(() => {
    const status = searchParams.get('status');
    const targetAsset = searchParams.get('targetAsset');
    const amount = searchParams.get('amount');
    
    if (status === 'success' && targetAsset && amount) {
      toast.success(`Successfully funded ${amount} ${targetAsset}!`);
    } else if (status === 'funded-swap-failed' && amount) {
      toast.success(`Funded ${amount} SOL, but conversion failed. Contact support.`);
    } else if (status === 'failed') {
      toast.error('Funding failed. Please try again.');
    } else if (status === 'error') {
      toast.error('An error occurred. Please try again later.');
    }
  }, [searchParams]);
  
  // Initialize Privy client
  useEffect(() => {
    if (!privyClient.isInitialized) {
      privyClient.initialize({
        appId: process.env.NEXT_PUBLIC_PRIVY_APP_ID || '',
        enabled: true,
      });
    }
  }, [privyClient]);
  
  // Handle fund wallet action
  const handleFundWallet = async () => {
    const walletPublicKey = walletPk
    
    if (!walletPublicKey) {
      toast.error('No wallet available to fund');
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Generate a URL for funding the wallet
      const fundingUrl = await privyClient.generateFundWalletUrl(walletPublicKey, {
        amount: selectedAmount.toString(),
        cluster: { name: process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet' },
        targetAsset: 'USDC',
      });
      
      // Open the funding URL in a new window/tab
      window.open(fundingUrl, '_blank', 'noopener,noreferrer');
      
      toast.success(`Funding window opened for USDC`);
    } catch (error) {
      console.error('Error funding wallet:', error);
      toast.error('Failed to open funding page');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="flex flex-col h-full min-h-full mx-auto items-start md:flex-row md:max-w-3xl">
      <div className="flex items-center justify-center md:py-6.5 px-6 md:px-0">
        <Link href="/home" className="text-sm text-[#f6ead7]  bg-background rounded-md p-2">
          <ChevronLeft className="w-4 h-4" />
        </Link>
      </div>
      <main className="flex-1 p-6 space-y-6">
        <Card className="bg-white p-8 rounded-2xl shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-4xl font-bold text-black">Your Wallet</h2>
              <div className="flex flex-col space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Senda Wallet Address</p>
                </div>
                <div
                  className={`flex items-center gap-3 ${walletPk ? 'bg-[#d7dfbe]/30' : 'bg-gray-100 justify-center'} p-1 rounded-sm mt-3`}
                >
                  <p className="font-mono text-sm break-all text-black">{walletPk || 'Not connected'}</p>
                  {walletPk && (
                    <Copy
                      className="w-3 h-3 text-muted-foreground cursor-pointer"
                      onClick={() => {
                        if (walletPk) {
                          navigator.clipboard.writeText(walletPk)
                          toast.success('Address copied to clipboard')
                        }
                      }}
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 relative">
              <Image src={IceDoodle.src} alt="You've got this!" fill className="object-contain" />
            </div>
          </div>
        </Card>

        <Card className="bg-white rounded-2xl shadow-md p-6">
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Fund Your Account</h3>
              <p className="text-sm text-gray-500">
                Select an asset and amount to add funds using Apple Pay or Google Pay
              </p>
            </div>

            {/* Asset selection */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Select Asset</label>
              <ToggleGroup type="single" className="min-w-full grid grid-cols-2 gap-2">
                {Object.keys(ASSETS).map((asset, index) => (
                  <ToggleGroupItem
                    key={index}
                    value={`${asset}`}
                    aria-label="Toggle bold"
                    className={`flex items-center justify-center gap-2 px-5 py-9 border rounded-lg transition-colors focus:outline-none data-[state=checked]:bg-[#f6ead7] col-span-1 w-full bg-gray-100 ${ASSETS[index].logo === USDCLogo ? 'bg-[#0b53bf]/20 border-[#0b53bf]' : 'bg-[#009493]/10 border-[#009493]'}`}
                  >
                    <Image
                      src={ASSETS[index].logo}
                      alt={ASSETS[index].name}
                      width={100}
                      height={24}
                      className={` ${ASSETS[index].logo === USDCLogo && ' w-20'}`}
                    />
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>

              <p className="text-xs text-gray-500 mt-1">Fund with usdc converted automatically from SOL</p>
            </div>

            {/* Amount selection */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Select Amount</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {FUNDING_AMOUNTS.map((amount) => (
                  <button
                    key={amount}
                    className={`flex flex-col items-center justify-center px-4 py-8 border rounded-lg transition-colors focus:outline-none ${
                      selectedAmount === amount
                        ? 'bg-[#d7dfbe]/20 border-[#d7dfbe] ring-2 ring-[#d7dfbe] ring-opacity-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                    onClick={() => setSelectedAmount(amount)}
                  >
                    <span className="text-lg font-semibold text-gray-900">${amount}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <Button
                className="w-full text-lg bg-[#f6ead7] hover:bg-[#c1cd9e] text-gray-800 font-medium h-[5rem]"
                disabled={isLoading || !walletPk}
                onClick={handleFundWallet}
              >
                <Wallet className="w-9 h-9 mr-1" />
                {isLoading ? 'Processing...' : `Fund`}
              </Button>
            </div>
          </div>
        </Card>
      </main>
    </div>
  )
} 