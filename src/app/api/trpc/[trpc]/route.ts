import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '@/server';
import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth/auth';

// Create a proper context with authenticated session
const handler = async (req: NextRequest) => {
  // Get auth session
  const session = await auth();
  
  // Debug session
  console.log("API Route - Auth Session:", {
    hasSession: !!session,
    hasUser: !!session?.user,
    userId: session?.user?.id || 'No ID',
    email: session?.user?.email || 'No email'
  });
  
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: async () => {
      // Get a fresh session for each request to ensure latest data
      const freshSession = await auth();
      
      console.log("TRPC Context - Fresh Session:", {
        hasSession: !!freshSession,
        hasUser: !!freshSession?.user,
        userId: freshSession?.user?.id || 'No ID',
        email: freshSession?.user?.email || 'No email'
      });
      
      return {
        req,
        session: freshSession
      };
    }
  });
};

export { handler as GET, handler as POST }