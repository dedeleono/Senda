import { initTRPC, TRPCError } from "@trpc/server";
import { auth } from "@/lib/auth/auth";
import { type NextRequest } from "next/server";
import { Session } from "next-auth";

export interface Context {
  req: NextRequest;
  session: Session | null;
}

const t = initTRPC.context<Context>().create();

const isAuthenticated = t.middleware(async ({ ctx, next }) => {
  const session = ctx.session || await auth();

  if (!session || !session.user) {
    console.log("Auth middleware - No session or user");
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in to access this resource",
    });
  }

  console.log("Auth middleware - Complete Session:", session);
  console.log("Auth middleware - User Object:", session.user);
  
  if (!session.user.id && !session.user.email) {
    console.log("Auth middleware - No user ID or email available");
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "User identity is incomplete",
    });
  }

  return next({
    ctx: {
      ...ctx,
      session,
      user: session.user,
    },
  });
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(isAuthenticated);
export const mergeRouters = t.mergeRouters;