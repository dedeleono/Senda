'use client'

import { ThemeProvider } from './theme-provider'
import { Toaster } from './ui/sonner'
import React from 'react'
import { useAuthRedirects } from '@/hooks/use-auth-redirects'

export function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  
  useAuthRedirects();
  
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <main className="bg-[#d7dfbe] overflow-hidden">{children}</main>
      <Toaster />
    </ThemeProvider>
  )
}
