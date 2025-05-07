import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";
import { authConfig } from "./auth.config";
import { sendAuthEmail } from "@/lib/validations/auth-email";
import Email from "next-auth/providers/email";
import { customPrismaAdapter } from "./auth-adapter";

export const { handlers, auth, signIn, signOut } = NextAuth({
    ...authConfig,
    adapter: customPrismaAdapter,
    session: { strategy: "jwt" },
    secret: process.env.AUTH_SECRET,
    debug: true, // Enable debugging
    logger: {
        error(code, ...message) {
            console.error('[AUTH ERROR]', code, ...message);
        },
        warn(code, ...message) {
            console.warn('[AUTH WARNING]', code, ...message);
        },
        debug(code, ...message) {
            console.log('[AUTH DEBUG]', code, ...message);
        }
    },
    providers: [
        ...authConfig.providers,
        Email({
            server: {
                host: process.env.EMAIL_SERVER_HOST,
                port: 465,
                secure: true,
                auth: {
                    user: process.env.EMAIL_SERVER_USER,
                    pass: process.env.EMAIL_SERVER_PASSWORD
                }
            },
            from: process.env.EMAIL_FROM,
            maxAge: 10 * 60,
            async sendVerificationRequest({ identifier: email, url }) {
                try {
                    if (!process.env.EMAIL_SERVER_USER || !process.env.EMAIL_SERVER_PASSWORD) {
                        console.error('Missing email configuration:', {
                            hasEmailUser: !!process.env.EMAIL_SERVER_USER,
                            hasEmailPassword: !!process.env.EMAIL_SERVER_PASSWORD,
                            emailHost: process.env.EMAIL_SERVER_HOST,
                            emailPort: process.env.EMAIL_SERVER_PORT
                        });
                        throw new Error('Missing required email configuration');
                    }

                    await sendAuthEmail(email, url);
                    console.log('Verification email sent successfully');
                } catch (error) {
                    console.error('Error in sendVerificationRequest:', error);
                    throw error;
                }
            }
        }),
    ],
    callbacks: {
        ...authConfig.callbacks,
        async jwt({ token, user }) {
            console.log('[AUTH DEBUG] JWT Callback', { 
                hasUser: !!user, 
                tokenSub: token.sub 
            });
            if (user?.sendaWalletPublicKey) {
                token.sendaWalletPublicKey = user.sendaWalletPublicKey;
            }
            return token;
        },
        async session({ session, token }) {
            console.log('[AUTH DEBUG] Session Callback', { 
                hasToken: !!token, 
                hasSession: !!session 
            });
            
            if (session.user) {
                // Add id from token.sub to the user object
                session.user.id = token.sub as string;
                
                // Add wallet public key if available
                if (token.sendaWalletPublicKey) {
                    session.user.sendaWalletPublicKey = token.sendaWalletPublicKey as string;
                }
            }
            
            return session;
        },
    },
});

export type AuthSession = {
    session: {
        user: {
            id: string;
            email: string;
            sendaWalletPublicKey: string;
            name?: string | null;
            image?: string | null;
        };
    } | null;
};