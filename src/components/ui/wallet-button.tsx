'use client'

import React, { FC, useEffect, useState } from 'react'
import { Button } from './button'
import { WalletMultiButton, BaseWalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { useWallet } from '@solana/wallet-adapter-react'
import { Wallet as WalletIcon } from 'lucide-react'

interface WalletMultiButtonStyledProps {
  className?: string
}

const LABELS = {
  'change-wallet': 'Change wallet',
  connecting: 'Connecting ...',
  'copy-address': 'Copy address',
  copied: 'Copied',
  disconnect: 'Disconnect',
  'has-wallet': 'Connect Wallet',
  'no-wallet': 'Connect Wallet',
} as const

const WalletMultiButtonStyled: FC<WalletMultiButtonStyledProps> = ({ className }) => {
  const { connected, publicKey, wallet } = useWallet();
  const [mounted, setMounted] = useState(false);

  // Only show the component after mounting to prevent hydration errors
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <Button variant="outline" className="gap-2">
      <WalletIcon className="h-4 w-4" />
      Connect Wallet
    </Button>;
  }

  return (
    <BaseWalletMultiButton
      labels={LABELS}
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50
        ${connected ? 'bg-green-100 text-green-900 hover:bg-green-200' : 'bg-slate-100 text-slate-900 hover:bg-slate-200'}
        h-10 px-4 py-2 ${className}`}
      style={{
        fontFamily: 'var(--font-talk-comic)',
      }}
    />
  )
}

export default WalletMultiButtonStyled
