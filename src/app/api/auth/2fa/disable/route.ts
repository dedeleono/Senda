import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db";

// POST: Disable 2FA for the current user
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if 2FA is currently enabled
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isTwoFactorEnabled: true }
    });

    if (!user?.isTwoFactorEnabled) {
      return NextResponse.json(
        { error: "Two-factor authentication is not enabled" },
        { status: 400 }
      );
    }

    // Disable 2FA by performing these actions in a transaction:
    // 1. Set isTwoFactorEnabled to false
    // 2. Delete the 2FA confirmation if it exists
    // 3. Delete the 2FA secret if it exists
    await prisma.$transaction([
      // Update user to disable 2FA
      prisma.user.update({
        where: { id: session.user.id },
        data: { isTwoFactorEnabled: false }
      }),
      // Delete 2FA confirmation if it exists
      prisma.twoFactorConfirmation.deleteMany({
        where: { userId: session.user.id }
      }),
      // Delete 2FA secret if it exists
      prisma.twoFactorSecret.deleteMany({
        where: { userId: session.user.id }
      })
    ]);

    console.log("2FA disabled for user:", session.user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error disabling 2FA:", error);
    return NextResponse.json(
      { error: "Failed to disable two-factor authentication" },
      { status: 500 }
    );
  }
} 