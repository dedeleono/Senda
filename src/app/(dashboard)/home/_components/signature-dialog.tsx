'use client'

import { forwardRef, useImperativeHandle, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { trpc } from '@/app/_trpc/client'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export interface SignatureDialogRef {
  open: (depositId: string, role: 'sender' | 'receiver', signerId: string) => void
}

interface SignatureDialogProps {
  onComplete?: (depositId: string) => void
}

const SignatureDialog = forwardRef<SignatureDialogRef, SignatureDialogProps>(
  ({ onComplete }, ref) => {
    const [isOpen, setIsOpen] = useState(false)
    const [depositId, setDepositId] = useState<string>('')
    const [role, setRole] = useState<'sender' | 'receiver'>('sender')
    const [signerId, setSignerId] = useState<string>('')

    const { mutate: updateDeposit } = trpc.sendaRouter.updateDepositSignature.useMutation({
      onSuccess: () => {
        toast.success('Transaction signed successfully')
        setIsOpen(false)
        onComplete?.(depositId)
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to sign transaction')
      },
    })

    useImperativeHandle(ref, () => ({
      open: (newDepositId: string, newRole: 'sender' | 'receiver', newSignerId: string) => {
        setDepositId(newDepositId)
        setRole(newRole)
        setSignerId(newSignerId)
        setIsOpen(true)
      },
    }))

    const handleSign = () => {
      if (!depositId) return

      updateDeposit({
        depositId,
        role,
        signerId,
      })
    }

    return (
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Sign Transaction</DialogTitle>
            <DialogDescription>
              {role === 'sender'
                ? 'Please confirm you want to approve this deposit. This action cannot be undone.'
                : 'Please confirm you want to receive these funds. This action cannot be undone.'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSign}
                className="bg-[#d7dfbe] text-black hover:bg-[#d7dfbe] hover:text-black"
              >
               
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing...
                  
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }
)

SignatureDialog.displayName = 'SignatureDialog'

export default SignatureDialog 