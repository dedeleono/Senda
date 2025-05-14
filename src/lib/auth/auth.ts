import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { sendAuthEmail } from "@/lib/validations/auth-email";
import Email from "next-auth/providers/email";
import { customPrismaAdapter } from "./auth-adapter";
import { GuestService } from "@/server/services/guest"
import { sendGuestDepositNotificationEmail } from "../validations/guest-deposit-notification";
import { UserRole } from "@prisma/client";

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
                        throw new Error('Missing required email configuration');
                    }
                    await sendAuthEmail(email, url);
                } catch (error) {
                    console.error('Error in sendVerificationRequest:', error);
                    throw error;
                }
            }
        }),
    ],
    callbacks: {
        ...authConfig.callbacks,
        async jwt({ token, user, trigger, session }) {
            console.log('[AUTH DEBUG] JWT Callback', { 
                hasUser: !!user, 
                tokenSub: token.sub,
                trigger,
                userDetails: user ? JSON.stringify(user) : 'no user'
            });

            if (user) {
                token.id = user.id;
                token.email = user.email;
                token.name = user.name;
                token.picture = user.image;
                if (user.sendaWalletPublicKey) {
                    token.sendaWalletPublicKey = user.sendaWalletPublicKey;
                }
            }

            if (trigger === 'update' && session) {
                return { ...token, ...session.user };
            }

            return token;
        },
        async session({ session, token }) {
            console.log('[AUTH DEBUG] Session Callback', { 
                hasToken: !!token, 
                hasSession: !!session,
                tokenDetails: token ? JSON.stringify(token) : 'no token'
            });
            
            if (token && session.user) {
                session.user.id = token.id as string;
                session.user.email = token.email as string;
                session.user.name = token.name as string;
                session.user.image = token.picture as string;
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