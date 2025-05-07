import { NextResponse } from 'next/server';
import { z } from 'zod';

// Schema for request validation
const requestSchema = z.object({
  walletAddress: z.string().min(32).max(44), // Solana address length validation
  amount: z.string().optional(),
  cluster: z.enum(['mainnet-beta', 'devnet']).default('mainnet-beta'),
  targetAsset: z.enum(['SOL', 'USDC', 'USDT']).default('SOL'),
});

export async function POST(request: Request) {
  try {
    // Parse and validate the request body
    const body = await request.json();
    const validatedData = requestSchema.parse(body);
    
    // Get Privy App ID from environment variables
    const privyAppId = process.env.PRIVY_APP_ID;
    
    if (!privyAppId) {
      return NextResponse.json(
        { error: 'Privy configuration missing' },
        { status: 500 }
      );
    }
    
    // Prepare parameters for the funding URL
    const { walletAddress, amount, cluster, targetAsset } = validatedData;
    
    // Store target asset in the state via the redirect URI query parameters
    // This will be used after successful funding to convert if necessary
    const callbackUrl = new URL(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/privy/funding/callback`);
    callbackUrl.searchParams.append('targetAsset', targetAsset);
    
    // Create a simple funding URL - in a real implementation,
    // you would want to interact with Privy's API to generate this
    const baseUrl = 'https://pay.privy.io';
    const params = new URLSearchParams({
      app_id: privyAppId,
      address: walletAddress,
      cluster: cluster,
      ...(amount ? { amount } : {}),
      redirect_uri: callbackUrl.toString(),
    });
    
    const fundingUrl = `${baseUrl}?${params.toString()}`;
    
    return NextResponse.json({ 
      fundingUrl,
      targetAsset,
    });
  } catch (error) {
    console.error('Error generating funding URL:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to generate funding URL' },
      { status: 500 }
    );
  }
} 