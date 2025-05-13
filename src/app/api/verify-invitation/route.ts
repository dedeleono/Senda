import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const { token } = await req.json();

    if (!token) {
      return NextResponse.json({
        success: false,
        error: 'Token is required'
      }, { status: 400 });
    }

    // Find the verification token
    const verificationToken = await prisma.verificationToken.findUnique({
      where: { token }
    });

    if (!verificationToken) {
      return NextResponse.json({
        success: false,
        error: 'Invalid or expired token'
      }, { status: 400 });
    }

    if (verificationToken.expires < new Date()) {
      return NextResponse.json({
        success: false,
        error: 'Token has expired'
      }, { status: 400 });
    }

    // Find the user and their pending deposits
    const user = await prisma.user.findUnique({
      where: { email: verificationToken.identifier },
      include: {
        deposits: {
          where: { state: 'PENDING' },
          take: 1
        }
      }
    });

    const pendingDeposit = user?.deposits[0];

    return NextResponse.json({
      success: true,
      data: {
        email: verificationToken.identifier,
        amount: pendingDeposit?.amount.toString(),
        token: pendingDeposit?.stable.toUpperCase()
      }
    });

  } catch (error) {
    console.error('[VERIFY_INVITATION]', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to verify invitation'
    }, { status: 500 });
  }
} 