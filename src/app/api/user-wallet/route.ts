import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';
import { prisma } from '@/lib/db';

export async function POST(request: Request) {
  try {
    // Check auth session
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get the current user's ID
    const authenticatedUserId = session.user.id;

    // Get user ID from request, only proceed if it matches the authenticated user
    const { userId } = await request.json();
    if (userId !== authenticatedUserId) {
      return NextResponse.json(
        { error: 'Access denied. Can only retrieve your own wallet data.' },
        { status: 403 }
      );
    }

    // Get the user's encrypted wallet data
    const user = await prisma.user.findUnique({
      where: { id: authenticatedUserId },
      select: {
        id: true,
        sendaWalletPublicKey: true,
        encryptedPrivateKey: true,
        iv: true,
        authTag: true,
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Return the wallet data
    return NextResponse.json({
      sendaWalletPublicKey: user.sendaWalletPublicKey,
      encryptedPrivateKey: user.encryptedPrivateKey,
      iv: user.iv,
      authTag: user.authTag,
    });
  } catch (error) {
    console.error('Error fetching user wallet data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch wallet data' },
      { status: 500 }
    );
  }
} 