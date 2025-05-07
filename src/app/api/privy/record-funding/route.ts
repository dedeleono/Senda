import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth/auth';
import { prisma } from '@/lib/db';

// Schema for request validation
const requestSchema = z.object({
  transactionId: z.string(),
  walletAddress: z.string().min(32).max(44), // Solana address length validation
  amount: z.number().positive(),
  asset: z.string(),
  method: z.string(),
});

export async function POST(request: Request) {
  try {
    // Get authenticated user
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized access' },
        { status: 401 }
      );
    }
    
    // Parse and validate the request body
    const body = await request.json();
    const validatedData = requestSchema.parse(body);
    
    // Record the funding transaction in the database
    const result = await prisma.fiatFunding.create({
      data: {
        userId: session.user.id,
        publicKey: validatedData.walletAddress,
        method: validatedData.method,
        chain: 'solana', // Hardcoded for now since we're focusing on Solana
        asset: validatedData.asset,
        amount: validatedData.amount,
      },
    });
    
    // If this is the user's first funding, you might want to update their status
    // or trigger other events
    
    return NextResponse.json({ 
      success: true,
      id: result.id,
    });
  } catch (error) {
    console.error('Error recording funding transaction:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to record funding transaction' },
      { status: 500 }
    );
  }
} 