import React from 'react'
import Logo from '@/components/logo'
import WalletMultiButtonStyled from '@/components/ui/wallet-button'
import DashboardLayoutClient from './_components/layout-client'
import { LinkExternalWalletButton } from '@/components/wallet/link-wallet-button'
import { auth } from '@/lib/auth/auth'
import { redirect } from 'next/navigation'
import { Wallet } from '@/components/solana/wallet-provider'

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {

  const session = await auth()
  
  if (!session) {
    return redirect('/login')
  }

  return (
    <Wallet userWalletPublicKey={session.user.sendaWalletPublicKey}>
      <div className="min-h-screen ">
        <header className="flex items-center justify-between p-4">
          <Logo width={150} />
          <div className="flex items-center gap-2 mr-5">
            <DashboardLayoutClient />
            <LinkExternalWalletButton />
          </div>
        </header>
        <div>{children}</div>
      </div>
    </Wallet>
  )
}
