import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      sendaWalletPublicKey: string;
      emailVerified: Date | null;
      needs2FA?: boolean;
    } & DefaultSession["user"]
  }

  interface User {
    id: string;
    sendaWalletPublicKey: string;
    emailVerified: Date | null;
    email: string;
    name?: string | null;
    image?: string | null;
    needs2FA?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    sendaWalletPublicKey: string;
    email: string;
    name?: string | null;
    picture?: string | null;
    emailVerified?: Date | null;
    needs2FA?: boolean;
  }
}