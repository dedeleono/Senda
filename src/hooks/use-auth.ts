'use client';

import { useEffect } from 'react';
import { Session } from 'next-auth';
import { useSession } from 'next-auth/react';

export function useAuth() {
  const { data: sessionData, status } = useSession();
  
  useEffect(() => {
    console.log('Session Status:', {
      status,
      hasUser: !!sessionData?.user,
      userId: sessionData?.user?.id || 'No ID',
      email: sessionData?.user?.email || 'No email' 
    });
  }, [sessionData, status]);
  
  return {
    session: sessionData,
    isAuthenticated: status === 'authenticated',
    isLoading: status === 'loading' 
  };
} 