import { prisma } from "@/lib/db"
import { UserRole } from "@prisma/client"

interface VerifyGuestParams {
    email: string
    escrowId: string
}

interface VerifyGuestResult {
    success: boolean
    data?: {
        id: string
        email: string
        role: UserRole
        sendaWalletPublicKey: string
    }
    error?: {
        message: string
        code: string
    }
}

export const GuestService = {
    async verifyAndCreateSession({ email, escrowId }: VerifyGuestParams): Promise<VerifyGuestResult> {
        try {
            const escrow = await prisma.escrow.findUnique({
                where: { id: escrowId },
                include: {
                    receiver: {
                        select: {
                            id: true,
                            email: true,
                            role: true,
                            sendaWalletPublicKey: true,
                        }
                    }
                }
            })

            if (!escrow) {
                return {
                    success: false,
                    error: {
                        code: "NOT_FOUND",
                        message: "Escrow not found"
                    }
                }
            }

            if (escrow.receiver.email !== email) {
                return {
                    success: false,
                    error: {
                        code: "UNAUTHORIZED",
                        message: "Email does not match escrow recipient"
                    }
                }
            }

            return {
                success: true,
                data: {
                    id: escrow.receiver.id,
                    email: escrow.receiver.email,
                    role: escrow.receiver.role,
                    sendaWalletPublicKey: escrow.receiver.sendaWalletPublicKey
                }
            }
        } catch (error) {
            console.error('Error in verifyAndCreateSession:', error)
            return {
                success: false,
                error: {
                    code: "INTERNAL_SERVER_ERROR",
                    message: "Failed to verify guest"
                }
            }
        }
    }
}