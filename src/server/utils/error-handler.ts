import { TRPCError } from '@trpc/server';
import { Prisma } from '@prisma/client';
import { ServiceError } from '@/types/transaction';

export function handleRouterError(error: unknown): ServiceError {
  // Handle TRPC errors
  if (error instanceof TRPCError) {
    return {
      code: error.code,
      message: error.message,
      details: error.cause
    };
  }

  // Handle Prisma errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return {
      code: `PRISMA_${error.code}`,
      message: 'Database operation failed',
      details: {
        code: error.code,
        meta: error.meta,
        message: error.message
      }
    };
  }

  // Handle Solana/Anchor errors
  if (error instanceof Error && error.message.includes('Solana')) {
    return {
      code: 'BLOCKCHAIN_ERROR',
      message: 'Blockchain operation failed',
      details: error
    };
  }

  // Handle generic errors
  if (error instanceof Error) {
    return {
      code: 'UNKNOWN_ERROR',
      message: error.message,
      details: error
    };
  }

  // Fallback for unknown error types
  return {
    code: 'UNKNOWN_ERROR',
    message: 'An unexpected error occurred',
    details: error
  };
} 