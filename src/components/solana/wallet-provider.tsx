'use client'

import React, { useMemo, useState, useEffect, useCallback } from 'react'
import { ConnectionProvider, WalletProvider, useWallet } from '@solana/wallet-adapter-react'
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base'
import { PhantomWalletAdapter, SolflareWalletAdapter, TrezorWalletAdapter } from '@solana/wallet-adapter-wallets'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import '@solana/wallet-adapter-react-ui/styles.css'
import { clusterApiUrl } from '@solana/web3.js'
import { AnchorWallet } from '@solana/wallet-adapter-react'

import { initWalletAdapter, loadKeypair } from '@/lib/services/wallet'
import { useAuth } from '@/hooks/use-auth'
import { useSendaProgram } from '@/stores/use-senda-program'

interface WalletProps {
  children: React.ReactNode
  userWalletPublicKey?: string
}

const SendaWalletAutoConnect = ({ userWalletPublicKey }: { userWalletPublicKey?: string }) => {
  const [initialized, setInitialized] = useState(false)
  const { session } = useAuth()
  const store = useSendaProgram()

  useEffect(() => {
    if (initialized || !userWalletPublicKey) return
    ;(async () => {
      console.log('🔄 Initializing Senda wallet adapter…')

      try {
        initWalletAdapter(userWalletPublicKey)
        await loadKeypair()

        console.log('✅ Senda wallet connected')

        let userId = session?.user?.id
        if (!userId) {
          const res = await fetch('/api/auth/session')
          const data = await res.json()
          userId = data?.user?.id
        }
        await store.initState()

        setInitialized(true)
      } catch (e) {
        console.error('❌ Failed to init Senda wallet adapter:', e)
      }
    })()
  }, [userWalletPublicKey, initialized, session?.user?.id, store])

  return null
}

export function Wallet({ children, userWalletPublicKey }: WalletProps) {
  const network = WalletAdapterNetwork.Devnet
  const endpoint = process.env.NEXT_PUBLIC_SOLANA_RPC || clusterApiUrl(network)

  const wallets = useMemo(() => {
    const std = [
      new PhantomWalletAdapter({ appIdentity: { name: 'Senda' } }),
      new SolflareWalletAdapter(),
      new TrezorWalletAdapter(),
    ]

    if (userWalletPublicKey) {
      try {
        const sendaAdapter = initWalletAdapter(userWalletPublicKey)
        return [sendaAdapter, ...std]
      } catch (e) {
        console.error('Error initializing Senda adapter:', e)
      }
    }

    return std
  }, [userWalletPublicKey])

  const onError = useCallback((error: Error) => {
    console.error('WalletProvider error:', error)
  }, [])

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect={false} onError={onError}>
        <WalletModalProvider>
          <SendaWalletAutoConnect userWalletPublicKey={userWalletPublicKey} />
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  )
}

export default Wallet