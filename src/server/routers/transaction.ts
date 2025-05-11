import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, publicProcedure } from "../trpc";
import { prisma } from "@/lib/db";
import nodemailer from "nodemailer";
import crypto from "crypto";
import { Keypair, Connection, PublicKey } from "@solana/web3.js";
import { encryptPrivateKey } from "@/lib/utils/crypto";
import { loadFeePayerKeypair } from "@/utils/dapp-wallets";
import { getOrCreateAssociatedTokenAccount } from "@solana/spl-token";
import { getSharedConnection } from "@/lib/senda/helpers";

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_SERVER_HOST,
  port: Number(process.env.EMAIL_SERVER_PORT),
  auth: {
    user: process.env.EMAIL_SERVER_USER,
    pass: process.env.EMAIL_SERVER_PASSWORD,
  },
  secure: process.env.EMAIL_SERVER_SECURE === "true",
});

function generateInvitationEmail({
  inviteUrl,
  userEmail,
  amount,
  token,
  senderName = "Someone",
  hasFunds = false,
}: {
  inviteUrl: string;
  userEmail: string;
  amount?: string;
  token?: string;
  senderName?: string;
  hasFunds?: boolean;
}) {
  const subject = hasFunds 
    ? `${senderName} has sent you ${amount} ${token} through Senda` 
    : "You've been invited to join Senda";
  
  const mainTitle = hasFunds ? "You've received funds!" : "Welcome to Senda";
  
  let fundsSection = '';
  if (hasFunds) {
    fundsSection = `
      <div style="background-color: rgba(246, 234, 215, 0.3); border: 1px solid #f6ead7; border-radius: 0.5rem; padding: 1.5rem; margin-bottom: 1.5rem;">
        <h2 style="font-size: 1.25rem; font-weight: bold; text-align: center; margin-bottom: 0.5rem;">
          ${senderName} has sent you
        </h2>
        <h2 style="font-size: 1.5rem; font-weight: bold; text-align: center; margin-bottom: 1rem;">
          ${amount} ${token}
        </h2>
        <p style="color: #4b5563; text-align: center;">
          To claim these funds, you'll need to set up your Senda account.
        </p>
      </div>
      
      <p style="color: #4b5563; margin-bottom: 1rem;">
        Senda is a secure platform for sending and receiving digital currency. Creating your account takes just a minute.
      </p>
    `;
  } else {
    fundsSection = `
      <p style="color: #4b5563; margin-bottom: 1rem;">
        You've been invited to join Senda. Set up your account to start sending and receiving payments securely.
      </p>
    `;
  }
  
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
      </head>
      <body style="background-color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0;">
        <div style="max-width: 600px; margin: 0 auto; padding: 2rem 1rem;">
          <h1 style="color: #034180; font-size: 1.5rem; font-weight: bold; text-align: center; margin-bottom: 1rem;">
            ${mainTitle}
          </h1>
          
          ${fundsSection}
          
          <p style="color: #4b5563; margin-bottom: 1rem;">
            You can use this email address (${userEmail}) to sign in with Google, or create a new account.
          </p>
          
          <div style="text-align: center; margin-bottom: 1.5rem;">
            <a href="${inviteUrl}" style="background-color: #034180; color: white; padding: 0.75rem 1.5rem; border-radius: 0.375rem; font-weight: 500; text-decoration: none; display: inline-block;">
              ${hasFunds ? "Claim Your Funds" : "Accept Invitation"}
            </a>
          </div>
          
          <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 1.5rem 0;">
          
          <p style="color: #6b7280; font-size: 0.875rem;">
            This invitation link will expire in 24 hours. If you have any questions, please contact support@senda.com.
          </p>
          
          <p style="color: #9ca3af; font-size: 0.75rem; text-align: center; margin-top: 1.5rem;">
            © 2023 Senda. All rights reserved.
          </p>
        </div>
      </body>
    </html>
  `;
}

function generateDepositNotificationEmail({
  userEmail,
  amount,
  token,
  senderName = "Someone",
  dashboardUrl,
}: {
  userEmail: string;
  amount: string;
  token: string;
  senderName: string;
  dashboardUrl: string;
}) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${senderName} has sent you ${amount} ${token} through Senda</title>
      </head>
      <body style="background-color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0;">
        <div style="max-width: 600px; margin: 0 auto; padding: 2rem 1rem;">
          <h1 style="color: #034180; font-size: 1.5rem; font-weight: bold; text-align: center; margin-bottom: 1rem;">
            You've received funds!
          </h1>
          
          <div style="background-color: rgba(246, 234, 215, 0.3); border: 1px solid #f6ead7; border-radius: 0.5rem; padding: 1.5rem; margin-bottom: 1.5rem;">
            <h2 style="font-size: 1.25rem; font-weight: bold; text-align: center; margin-bottom: 0.5rem;">
              ${senderName} has sent you
            </h2>
            <h2 style="font-size: 1.5rem; font-weight: bold; text-align: center; margin-bottom: 1rem;">
              ${amount} ${token}
            </h2>
          </div>
          
          <p style="color: #4b5563; margin-bottom: 1rem;">
            Log in to your Senda account to view and manage this transaction.
          </p>
          
          <div style="text-align: center; margin-bottom: 1.5rem;">
            <a href="${dashboardUrl}" style="background-color: #034180; color: white; padding: 0.75rem 1.5rem; border-radius: 0.375rem; font-weight: 500; text-decoration: none; display: inline-block;">
              View Transaction
            </a>
          </div>
          
          <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 1.5rem 0;">
          
          <p style="color: #9ca3af; font-size: 0.75rem; text-align: center; margin-top: 1.5rem;">
            © 2023 Senda. All rights reserved.
          </p>
        </div>
      </body>
    </html>
  `;
}

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
  token: z.enum(["USDC", "USDT"]),
  authorization: z.enum(["sender", "receiver", "both"]),
});

const createInvitationSchema = z.object({
  recipientEmail: z.string().email(),
  depositId: z.string().optional(),
  amount: z.number().optional(),
  token: z.string().optional(),
});

export const transactionRouter = router({
  startDeposit: protectedProcedure
    .input(createDepositSchema)
    .mutation(async ({ ctx, input }) => {
      const { recipientEmail, amount, token, authorization } = input;
      const userId = ctx.session.user.id;

      try {
        console.log('Starting deposit process with params:', {
          recipientEmail,
          amount,
          token,
          authorization,
          userId,
          senderWalletPublicKey: ctx.session.user.sendaWalletPublicKey
        });

        let recipient = await prisma.user.findUnique({
          where: { email: recipientEmail },
          select: { 
            id: true, 
            role: true, 
            sendaWalletPublicKey: true,
            email: true,
            name: true
          }
        });

        console.log('Found recipient:', recipient);

        if (!recipient) {
          console.log('Creating new GUEST user');
          // Create new user with GUEST role if they don't exist
          const keypair = Keypair.generate();
          const secretBuffer = Buffer.from(keypair.secretKey);
          
          const { iv, authTag, data: encryptedPrivateKey } = encryptPrivateKey(secretBuffer);

          try {
            recipient = await prisma.user.create({
              data: {
                email: recipientEmail,
                sendaWalletPublicKey: keypair.publicKey.toString(),
                encryptedPrivateKey,
                iv,
                authTag,
                role: "GUEST",
              },
              select: {
                id: true,
                role: true,
                sendaWalletPublicKey: true,
                email: true,
                name: true
              }
            });
            console.log('Created new GUEST user:', recipient);
          } catch (createError) {
            console.error('Error creating new user:', createError);
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to create new user account",
              cause: createError
            });
          }

          try {
            // Send invitation email for new users
            const inviteToken = crypto.randomBytes(32).toString("hex");
            await prisma.verificationToken.create({
              data: {
                identifier: recipientEmail,
                token: inviteToken,
                expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
              },
            });

            const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
            const inviteUrl = `${baseUrl}/invitation?token=${inviteToken}`;

            await sendEmail({
              to: recipientEmail,
              subject: `${ctx.session.user.name || "Someone"} has sent you ${amount} ${token} through Senda`,
              html: generateInvitationEmail({
                inviteUrl,
                userEmail: recipientEmail,
                amount: amount.toString(),
                token,
                senderName: ctx.session.user.name || "Someone",
                hasFunds: true,
              }),
            });
            console.log('Sent invitation email to new user');
          } catch (emailError) {
            console.error('Error sending invitation email:', emailError);
            // Don't throw here, we want to continue with the deposit even if email fails
          }
        } else if (recipient.role === "GUEST") {
          console.log('Sending invitation to existing GUEST user');
          try {
            // Send invitation email for existing GUEST users
            const inviteToken = crypto.randomBytes(32).toString("hex");
            await prisma.verificationToken.create({
              data: {
                identifier: recipientEmail,
                token: inviteToken,
                expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
              },
            });

            const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
            const inviteUrl = `${baseUrl}/invitation?token=${inviteToken}`;

            await sendEmail({
              to: recipientEmail,
              subject: `${ctx.session.user.name || "Someone"} has sent you ${amount} ${token} through Senda`,
              html: generateInvitationEmail({
                inviteUrl,
                userEmail: recipientEmail,
                amount: amount.toString(),
                token,
                senderName: ctx.session.user.name || "Someone",
                hasFunds: true,
              }),
            });
            console.log('Sent invitation email to existing GUEST user');
          } catch (emailError) {
            console.error('Error sending invitation email to GUEST:', emailError);
            // Don't throw here, continue with deposit
          }
        } else {
          console.log('Sending notification to INDIVIDUAL user');
          try {
            // For INDIVIDUAL users, just send a regular deposit notification
            const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
            const dashboardUrl = `${baseUrl}/home`;
            
            await sendEmail({
              to: recipientEmail,
              subject: `${ctx.session.user.name || "Someone"} has sent you ${amount} ${token} through Senda`,
              html: generateDepositNotificationEmail({
                userEmail: recipientEmail,
                amount: amount.toString(),
                token,
                senderName: ctx.session.user.name || "Someone",
                dashboardUrl,
              }),
            });
            console.log('Sent notification email to INDIVIDUAL user');
          } catch (emailError) {
            console.error('Error sending notification email:', emailError);
            // Don't throw here, continue with deposit
          }
        }

        console.log('Looking for existing escrow between users');
        const escrow = await prisma.escrow.findFirst({
          where: {
            OR: [
              {
                senderPublicKey: ctx.session.user.sendaWalletPublicKey,
                receiverPublicKey: recipient.sendaWalletPublicKey,
              },
              {
                senderPublicKey: recipient.sendaWalletPublicKey,
                receiverPublicKey: ctx.session.user.sendaWalletPublicKey,
              },
            ],
          },
        });

        console.log('Found escrow:', escrow);

        const result = {
          senderPublicKey: ctx.session.user.sendaWalletPublicKey,
          receiverPublicKey: recipient.sendaWalletPublicKey,
          escrowExists: !!escrow,
          escrowPublicKey: escrow?.id || null,
          recipientRole: recipient.role,
        };

        console.log('Returning result:', result);
        return result;

      } catch (error) {
        console.error("Error starting deposit:", error);
        if (error instanceof Error) {
          console.error("Error details:", {
            message: error.message,
            name: error.name,
            stack: error.stack
          });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to start deposit process",
          cause: error
        });
      }
    }),

  createDepositRecord: protectedProcedure
    .input(z.object({
      recipientEmail: z.string().email(),
      amount: z.number().positive(),
      token: z.enum(["USDC", "USDT"]),
      authorization: z.enum(["sender", "receiver", "both"]),
      escrowPublicKey: z.string(),
      depositSignature: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { recipientEmail, amount, token, authorization, escrowPublicKey, depositSignature } = input;
      const userId = ctx.session.user.id;

      try {
        const recipient = await prisma.user.findUnique({
          where: { email: recipientEmail },
        });

        if (!recipient) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Recipient not found",
          });
        }

        const result = await prisma.$transaction(async (tx) => {
          // Create transaction record
          const transaction = await tx.transaction.create({
            data: {
              userId,
              walletPublicKey: ctx.session.user.sendaWalletPublicKey || "",
              destinationAddress: recipient.sendaWalletPublicKey,
              amount,
              status: "PENDING",
              type: "TRANSFER",
            },
          });

          // Create deposit record
          const depositRecord = await tx.depositRecord.create({
            data: {
              userId,
              amount,
              stable: token.toLowerCase(),
              policy: authorization === "both" ? "DUAL" : "SINGLE",
              signatures: [depositSignature],
              state: "PENDING",
              depositIndex: Math.floor(Math.random() * 1000000), // @todo replace with proper index
              transactionId: transaction.id,
              escrowId: escrowPublicKey,
            },
          });

          return {
            transactionId: transaction.id,
            depositId: depositRecord.id,
            signature: depositSignature,
          };
        });

        if (recipient.email) {
          const dashboardUrl = `${process.env.NEXTAUTH_URL}/home`;
          await sendEmail({
            to: recipient.email,
            subject: `${ctx.session.user.name || "Someone"} has sent you ${amount} ${token} through Senda`,
            html: generateDepositNotificationEmail({
              userEmail: recipient.email,
              amount: amount.toString(),
              token,
              senderName: ctx.session.user.name || "Someone",
              dashboardUrl,
            }),
          });
        }

        return result;
      } catch (error) {
        console.error("Error creating deposit record:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create deposit record",
        });
      }
    }),

  sendInvitation: protectedProcedure
    .input(createInvitationSchema)
    .mutation(async ({ ctx, input }) => {
      const { recipientEmail, depositId, amount, token } = input;

      try {
        const inviteToken = crypto.randomBytes(32).toString("hex");
        
        await prisma.verificationToken.create({
          data: {
            identifier: recipientEmail,
            token: inviteToken,
            expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
          },
        });

        const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
        const inviteUrl = `${baseUrl}/invitation?token=${inviteToken}`;

        const emailHtml = generateInvitationEmail({
          inviteUrl,
          userEmail: recipientEmail,
          amount: amount?.toString(),
          token,
          senderName: ctx.session.user.name || "Someone",
          hasFunds: !!depositId,
        });

        await sendEmail({
          to: recipientEmail,
          subject: depositId ? "You've received funds on Senda!" : "Invitation to join Senda",
          html: emailHtml,
        });

        return { success: true, inviteToken };
      } catch (error) {
        console.error("Send invitation error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to send invitation",
        });
      }
    }),

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
        where: {
          token,
        },
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

      // At this point, the user has proven they own the email
      // This would continue with account creation or login flow
      
      return {
        success: true,
        email,
      };
    }),

  // Withdraw funds from a deposit for senda verified users
  withdrawFunds: protectedProcedure
    .input(
      z.object({
        transactionId: z.string(),
        destinationAddress: z.string().optional(), // Optional external wallet address
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { transactionId, destinationAddress } = input;
      const userId = ctx.session.user.id;

      // Get user information
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

      // Find the transaction
      const transaction = await prisma.transaction.findUnique({
        where: { id: transactionId },
        include: {
          depositRecord: true,
          user: {
            select: {
              email: true,
              name: true,
            },
          },
        },
      });

      if (!transaction) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Transaction not found",
        });
      }

      // Verify the transaction is pending and intended for this user
      if (transaction.status !== "PENDING") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Transaction is not in a withdrawable state",
        });
      }

      if (transaction.destinationAddress !== user.sendaWalletPublicKey) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not the recipient of this transaction",
        });
      }

      try {
        // Update transaction status
        const updatedTransaction = await prisma.$transaction(async (tx) => {
          // Update transaction status to COMPLETED
          const updated = await tx.transaction.update({
            where: { id: transactionId },
            data: {
              status: "COMPLETED",
              updatedAt: new Date(),
              // If there's a destination address, update it
              ...(destinationAddress && { destinationAddress }),
            },
          });

          // Update deposit record state if it exists
          if (transaction.depositRecord) {
            await tx.depositRecord.update({
              where: { id: transaction.depositRecord.id },
              data: {
                state: "COMPLETED",
              },
            });
          }

          // Add a transaction history entry
          await tx.transactionHistory.create({
            data: {
              transactionId: transaction.id,
              status: "COMPLETED",
              message: `Funds withdrawn by ${user.email}`,
              userId: userId,
            },
          });

          return updated;
        });

        // Send notification email to the sender
        if (transaction.user?.email) {
          const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
          const transactionUrl = `${baseUrl}/dashboard/transactions/${transactionId}`;
          
          const emailHtml = `
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Your transaction has been completed</title>
              </head>
              <body style="background-color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0;">
                <div style="max-width: 600px; margin: 0 auto; padding: 2rem 1rem;">
                  <h1 style="color: #034180; font-size: 1.5rem; font-weight: bold; text-align: center; margin-bottom: 1rem;">
                    Transaction Completed
                  </h1>
                  
                  <div style="background-color: rgba(209, 250, 229, 0.3); border: 1px solid #d1fae5; border-radius: 0.5rem; padding: 1.5rem; margin-bottom: 1.5rem;">
                    <h2 style="font-size: 1.25rem; font-weight: bold; text-align: center; margin-bottom: 0.5rem;">
                      ${user.email} has withdrawn
                    </h2>
                    <h2 style="font-size: 1.5rem; font-weight: bold; text-align: center; margin-bottom: 1rem;">
                      ${transaction.amount} ${transaction.depositRecord?.stable.toUpperCase() || 'tokens'}
                    </h2>
                  </div>
                  
                  <p style="color: #4b5563; margin-bottom: 1rem;">
                    Your transaction has been completed successfully. The recipient has withdrawn the funds.
                  </p>
                  
                  <div style="text-align: center; margin-bottom: 1.5rem;">
                    <a href="${transactionUrl}" style="background-color: #034180; color: white; padding: 0.75rem 1.5rem; border-radius: 0.375rem; font-weight: 500; text-decoration: none; display: inline-block;">
                      View Transaction
                    </a>
                  </div>
                  
                  <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 1.5rem 0;">
                  
                  <p style="color: #9ca3af; font-size: 0.75rem; text-align: center; margin-top: 1.5rem;">
                    © 2023 Senda. All rights reserved.
                  </p>
                </div>
              </body>
            </html>
          `;
          
          await sendEmail({
            to: transaction.user.email,
            subject: "Your transaction has been completed",
            html: emailHtml,
          });
        }

        return {
          success: true,
          transaction: updatedTransaction,
        };
      } catch (error) {
        console.error("Withdraw funds error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to withdraw funds",
        });
      }
    }),

  getFeePayerPublicKey: protectedProcedure
    .mutation(async () => {
      try {
        const { publicKey } = loadFeePayerKeypair();
        return { publicKey: publicKey.toBase58() };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get fee payer public key',
        });
      }
    }),

  createAssociatedTokenAccount: protectedProcedure
    .input(z.object({
      mint: z.string(),
      owner: z.string(),
    }))
    .mutation(async ({ input }) => {
      try {
        const { keypair: feePayerKeypair } = loadFeePayerKeypair();
        const connection = getSharedConnection();
        
        const mintPubkey = new PublicKey(input.mint);
        const ownerPubkey = new PublicKey(input.owner);
        
        const ata = await getOrCreateAssociatedTokenAccount(
          connection,
          feePayerKeypair,
          mintPubkey,
          ownerPubkey
        );

        return { 
          address: ata.address.toBase58(),
          created: ata.isInitialized !== null 
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to create ATA',
        });
      }
    }),
});

export default transactionRouter; 