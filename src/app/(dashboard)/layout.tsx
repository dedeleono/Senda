import React from 'react'
import Logo from '@/components/logo'
import DashboardLayoutClient from './_components/layout-client'
import { auth } from '@/lib/auth/auth'
import { redirect } from 'next/navigation'

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await auth()
  
  if (!session) {
    return redirect('/login')
  }

  return (
      <div className="min-h-screen ">
        <header className="flex items-center justify-between p-4">
          <Logo width={150} />
          <div className="flex items-center gap-2 mr-5">
            <DashboardLayoutClient />
          </div>
        </header>
        <div>{children}</div>
      </div>
  )
}
