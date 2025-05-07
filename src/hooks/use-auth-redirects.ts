'use client';

import { useSession } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

export function useAuthRedirects() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  
  useEffect(() => {
    if (status === 'loading') {
      return;
    }
    
    if (typeof window !== 'undefined' && sessionStorage.getItem('in-logout-flow') === 'true') {
      return;
    }
    
    if (status === 'authenticated' && pathname === '/login') {
      router.replace('/home');
      return;
    }
    
    if (status === 'authenticated' && 
        session?.user?.needs2FA && 
        !pathname.includes('/2fa-verify')) {
      router.replace('/2fa-verify');
    }
  }, [status, pathname, router, session]);
  
  return null;
} 