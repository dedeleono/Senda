import { Suspense } from 'react'
import Logo from '@/components/logo'
// import ThemeToggle from '@/components/layouts/ThemeToggle/theme-toggle'
import Link from 'next/link'
import dynamic from 'next/dynamic'

// Import AuthForm with dynamic import for code splitting, but maintain SSR
const AuthForm = dynamic(() => import('./_components/auth-form'), {
  ssr: true,
  loading: () => (
    <div className="w-full backdrop-blur-lg bg-background/80 rounded-3xl shadow-lg p-8 border border-border/50 h-[400px] flex items-center justify-center">
      <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  ),
})

export default function AuthPage() {

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="absolute top-6 right-6 flex items-center gap-2 flex-row">
        
        {/* <Suspense fallback={<div className="w-9 h-9" />}>
          <ThemeToggle />
        </Suspense> */}
      </div>

      <div className="flex flex-col items-center w-full max-w-md">
        <div className="mb-8 transform hover:scale-105 transition-transform duration-200">
          <Link href="/">
            <Logo width={150} height={150} />
          </Link>
        </div>

        <Suspense
          fallback={
            <div className="w-full backdrop-blur-md bg-background/80 rounded-3xl shadow-lg p-8 border border-border/50 h-[400px] flex items-center justify-center">
              <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          }
        >
          <AuthForm />
        </Suspense>
      </div>
    </div>
  )
}