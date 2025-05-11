'use client'

import { ThemeProvider } from '@/components/theme-provider'
import { SessionProvider } from 'next-auth/react'
import React from 'react'
import TRPCProvider from '@/app/_trpc/TRPCProvider'

export function AppProviders({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <SessionProvider>
        <TRPCProvider>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            {children}
          </ThemeProvider>
        </TRPCProvider>
    </SessionProvider>
  )
}
