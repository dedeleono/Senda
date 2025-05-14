import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, publicProcedure } from "../trpc";
import { prisma } from "@/lib/db";
import nodemailer from "nodemailer";
import crypto from "crypto";
import { 
  TokenType, 
  AuthorizationType, 
} from "@/types/transaction";

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_SERVER_HOST,
  port: Number(process.env.EMAIL_SERVER_PORT),
  auth: {
    user: process.env.EMAIL_SERVER_USER,
    pass: process.env.EMAIL_SERVER_PASSWORD,
  },
  secure: process.env.EMAIL_SERVER_SECURE === "true",
});

async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  return transporter.sendMail({
    from: process.env.EMAIL_FROM || "noreply@senda.com",
    to,
    subject,
    html,
  });
}

const createDepositSchema = z.object({
  recipientEmail: z.string().email(),
  amount: z.number().positive(),
  token: z.enum(["USDC", "USDT"]) as z.ZodType<TokenType>,
  authorization: z.enum(["SENDER", "RECEIVER", "DUAL"]) as z.ZodType<AuthorizationType>,
});

const createInvitationSchema = z.object({
  recipientEmail: z.string().email(),
  depositId: z.string().optional(),
  amount: z.number().optional(),
  token: z.string().optional(),
});

export const transactionRouter = router({

  // sendInvitation: protectedProcedure
  //   .input(createInvitationSchema)
  //   .mutation(async ({ ctx, input }) => {
  //     const { recipientEmail, depositId, amount, token } = input;

  //     try {
  //       const inviteToken = crypto.randomBytes(32).toString("hex");
        
  //       await prisma.verificationToken.create({
  //         data: {
  //           identifier: recipientEmail,
  //           token: inviteToken,
  //           expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
  //         },
  //       });

  //       const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  //       const inviteUrl = `${baseUrl}/invitation?token=${inviteToken}`;

  //       const emailHtml = generateInvitationEmail({
  //         inviteUrl,
  //         userEmail: recipientEmail,
  //         amount: amount?.toString(),
  //         token,
  //         senderName: ctx.session.user.name || "Someone",
  //         hasFunds: !!depositId,
  //       });

  //       await sendEmail({
  //         to: recipientEmail,
  //         subject: depositId ? "You've received funds on Senda!" : "Invitation to join Senda",
  //         html: emailHtml,
  //       });

  //       return { success: true, inviteToken };
  //     } catch (error) {
  //       console.error("Send invitation error:", error);
  //       throw new TRPCError({
  //         code: "INTERNAL_SERVER_ERROR",
  //         message: error instanceof Error ? error.message : "Failed to send invitation",
  //       });
  //     }
  //   }),

  getTransactionById: protectedProcedure
    .input(z.object({ transactionId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { transactionId } = input;
      const userId = ctx.session.user.id;

      const transaction = await prisma.transaction.findUnique({
        where: { id: transactionId },
        include: {
          depositRecord: true,
        },
      });

      if (!transaction) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Transaction not found",
        });
      }

      if (transaction.userId !== userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this transaction",
        });
      }

      return transaction;
    }),

  getUserTransactions: protectedProcedure
    .input(
      z.object({
        status: z.enum(["PENDING", "COMPLETED", "CANCELLED", "REJECTED", "FAILED"]).optional(),
        limit: z.number().min(1).max(100).optional(),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { status, limit = 10, cursor } = input;
      const userId = ctx.session.user.id;

      const transactions = await prisma.transaction.findMany({
        where: {
          userId,
          ...(status && { status }),
        },
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: {
          createdAt: "desc",
        },
        include: {
          depositRecord: true,
          destinationUser: true,
        },
      });

      let nextCursor: typeof cursor | undefined = undefined;
      if (transactions.length > limit) {
        const nextItem = transactions.pop();
        nextCursor = nextItem?.id;
      }

      return {
        transactions,
        nextCursor,
      };
    }),

  getReceivedTransactions: protectedProcedure
    .input(
      z.object({
        status: z.enum(["PENDING", "COMPLETED", "CANCELLED", "REJECTED", "FAILED"]).optional(),
        limit: z.number().min(1).max(100).optional(),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { status, limit = 10, cursor } = input;
      const userId = ctx.session.user.id;
      
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { sendaWalletPublicKey: true, email: true }
      });
      
      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }
      
      const transactions = await prisma.transaction.findMany({
        where: {
          destinationAddress: user.sendaWalletPublicKey,
          ...(status && { status }),
        },
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: {
          createdAt: "desc",
        },
        include: {
          depositRecord: true,
          user: {
            select: {
              name: true,
              email: true,
            }
          }
        },
      });
      
      let nextCursor: typeof cursor | undefined = undefined;
      if (transactions.length > limit) {
        const nextItem = transactions.pop();
        nextCursor = nextItem?.id;
      }
      
      return {
        transactions,
        nextCursor,
      };
    }),

  // Publicly accessible procedure for handling invitations and claiming funds
  claimFunds: publicProcedure
    .input(
      z.object({
        token: z.string(),
        email: z.string().email(),
      })
    )
    .mutation(async ({ input }) => {
      const { token, email } = input;

      // Verify token
      const verificationToken = await prisma.verificationToken.findUnique({
        where: { token }
      });

      if (!verificationToken || verificationToken.expires < new Date()) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid or expired invitation token",
        });
      }

      // Token is valid, check if it matches the provided email
      if (verificationToken.identifier !== email) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Email doesn't match invitation",
        });
      }

      // Get the metadata containing escrow and deposit information
      const metadata = verificationToken.metadata ? JSON.parse(verificationToken.metadata as string) : null;
      if (!metadata?.escrowId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No escrow information found",
        });
      }

      // Find the user by email
      const user = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          sendaWalletPublicKey: true,
        }
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      // Find the escrow
      const escrow = await prisma.escrow.findUnique({
        where: { id: metadata.escrowId },
        select: {
          id: true,
          receiverPublicKey: true,
          state: true,
        }
      });

      if (!escrow) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Escrow not found",
        });
      }

      if (escrow.state !== "Active") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Escrow is not in an active state",
        });
      }

      if (escrow.receiverPublicKey !== user.sendaWalletPublicKey) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Escrow does not belong to this user",
        });
      }

      // Update escrow state to indicate funds are being claimed
      await prisma.escrow.update({
        where: { id: escrow.id },
        data: { state: "Active" }
      });

      // Delete the verification token as it's no longer needed
      await prisma.verificationToken.delete({
        where: { token }
      });
      
      return {
        success: true,
        escrowId: escrow.id,
        email,
      };
    }),
});

export default transactionRouter; 