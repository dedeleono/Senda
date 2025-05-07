import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if 2FA is enabled and if there's a confirmation
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { 
        isTwoFactorEnabled: true,
        twoFactorConfirmation: {
          select: { id: true }
        }
      }
    });

    console.log("2FA status check for user:", {
      userId: session.user.id,
      twoFactorEnabled: user?.isTwoFactorEnabled || false,
      hasConfirmation: !!user?.twoFactorConfirmation || false
    });

    // Return 2FA status
    return NextResponse.json({
      twoFactorEnabled: user?.isTwoFactorEnabled || false,
      hasConfirmation: !!user?.twoFactorConfirmation || false,
    });
  } catch (error) {
    console.error("Error checking 2FA status:", error);
    return NextResponse.json({ error: "Failed to check 2FA status" }, { status: 500 });
  }
} 