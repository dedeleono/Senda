'use client'

import React, { forwardRef, useImperativeHandle, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Copy } from 'lucide-react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import QRCode from 'react-qr-code'

export interface WalletQRDialogRef {
  open: () => void
  close: () => void
}

interface WalletQRDialogProps {
  walletAddress: string
}

const WalletQRDialog = forwardRef<WalletQRDialogRef, WalletQRDialogProps>(({ walletAddress }, ref) => {
  const [isOpen, setIsOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  useImperativeHandle(ref, () => ({
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
  }))

  const copyToClipboard = () => {
    navigator.clipboard.writeText(walletAddress)
    setCopied(true)
    toast.success('Wallet address copied to clipboard')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md bg-white border-none shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-center">Your Senda Wallet</DialogTitle>
        </DialogHeader>
        <AnimatePresence>
          <motion.div
            className="flex flex-col items-center gap-6 py-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <motion.div
              className="bg-white p-4 rounded-xl shadow-md border border-[#d7dfbe]/30"
              whileHover={{ scale: 1.02 }}
              transition={{ type: 'spring', stiffness: 300 }}
            >
              <QRCode
                size={220}
                value={walletAddress}
                viewBox="0 0 220 220"
                fgColor="#000000"
                bgColor="#FFFFFF"
                level="H"
                className="rounded-md"
              />
            </motion.div>
            <p className="text-xs text-gray-500 text-center">Scan this QR code or copy the address below</p>
            <div className="w-full">
              <motion.div
                className="flex items-center justify-between border rounded-lg p-3 bg-[#f8faf3]"
                whileHover={{ boxShadow: '0 4px 8px rgba(0,0,0,0.05)' }}
              >
                <p className="text-sm font-medium text-gray-700 truncate max-w-[220px]">{walletAddress}</p>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={copyToClipboard}
                  className={`px-2 hover:bg-[#d7dfbe]/20 transition-all duration-300 ${copied ? 'text-green-500' : ''}`}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </motion.div>
            </div>

            <motion.p
              className="text-sm text-center text-gray-500 mt-2 max-w-xs"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              Share this address with others to receive funds directly to your Senda wallet
            </motion.p>
          </motion.div>
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  )
})

WalletQRDialog.displayName = 'WalletQRDialog'

export default WalletQRDialog
