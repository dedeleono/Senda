'use client'

import { useRef, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArrowUp, Plus, PlusIcon, Wallet } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { trpc } from '@/app/_trpc/client'
import path from '@/public/2.svg'
import IceDoodle from '@/public/IceCreamDoodle.svg'
import Image from 'next/image'
import WalletQRDialog, { WalletQRDialogRef } from './wallet-qr-dialog'
import { useWalletBalances } from '@/hooks/use-wallet-balances'
import { useSendaWallet } from '@/hooks/use-senda-wallet'
import { getSendaWalletPublicKey } from '@/lib/services/wallet'
import usdcIcon from '@/public/usdc.svg'
import usdtIcon from '@/public/usdt-round.svg'
import DepositModal, { DepositModalRef } from '@/components/deposit/deposit-modal'
import TransactionCard from '@/components/transactions/transaction-card'
import TransactionDetails from '@/components/transactions/transaction-details'

export default function SendaWallet() {
  const { isAuthenticated } = useAuth()
  const walletQRDialogRef = useRef<WalletQRDialogRef>(null)
  const depositModalRef = useRef<DepositModalRef>(null)
  
  const { sendaWalletPublicKey } = useSendaWallet()
  const sendaWalletAddress = sendaWalletPublicKey?.toString() || null
  
  const { isLoading, error, balances } = useWalletBalances(null)
  
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null)
  const [isTransactionDetailsOpen, setIsTransactionDetailsOpen] = useState(false)

  const { data: transactions, isLoading: isLoadingTransactions } = trpc.transactionRouter.getUserTransactions.useQuery(
    { limit: 10 },
    {
      enabled: isAuthenticated,
      retry: false,
    }
  )

  const handleOpenWalletQR = () => {
    walletQRDialogRef.current?.open()
  }

  const handleOpenDepositModal = () => {
    depositModalRef.current?.open()
  }

  const handleDepositComplete = (data: any) => {
    // Handle deposit completion
    console.log('Deposit completed:', data)
    // Refresh transactions
    // @todo Implement invalidation or refresh
  }

  const handleOpenTransactionDetails = (transaction: any) => {
    setSelectedTransaction(transaction)
    setIsTransactionDetailsOpen(true)
  }

  return (
    <div className="flex flex-col h-full min-h-full mx-auto md:flex-row md:max-w-3xl">
      <main className="flex-1 p-6 space-y-6">
        <Card className="bg-white p-8 rounded-2xl shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex flex-col space-y-3">
              {/* Total Balance */}
              <h2 className="md:text-4xl text-3xl font-bold text-black text-nowrap">
                ${balances.reduce((sum, token) => sum + token.uiBalance, 0).toFixed(2)}{' '}
                <span className="text-gray-500 md:text-base text-xs">USD</span>
              </h2>

              <div className="flex gap-2 items-center -ml-3">
                {balances.map((token) => (
                  <div key={token.mint} className="items-center md:flex hidden">
                    <div className="w-auto rounded-full mr-1 flex items-center justify-center">
                      <Image
                        src={token.symbol === 'USDC' ? usdcIcon : usdtIcon}
                        alt={token.symbol}
                        width={100}
                        height={100}
                        className={` ${token.symbol === 'USDC' ? 'md:w-[56px] md:h-[56px] w-9 h-9' : 'md:w-7 md:h-7 '}`}
                      />
                    </div>
                    <span className={`text-gray-700 ${token.symbol === 'USDC' ? '-ml-3.5' : 'text-gray-500'}`}>
                      <span className="font-medium text-lg">
                        {token.uiBalance.toFixed(0)}
                        <span className="text-gray-500 text-xs">{token.symbol}</span>
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 relative">
              <Image src={IceDoodle.src} alt="You've got this!" fill className="object-contain" />
            </div>
          </div>

          <div className="md:mt-3 mt-7 grid md:grid-cols-3 grid-cols-1 gap-2 md:w-5/6">
            <Button
              onClick={handleOpenDepositModal}
              variant="default"
              className="bg-[#d7dfbe] text-black font-semibold"
            >
              Send <ArrowUp className="h-4 w-4" />
            </Button>

            <Button
              variant="default"
              className="bg-[#f6ead7] text-black hover:bg-[#f6ead7] hover:font-bold font-semibold cursor-pointer"
            >
              Add Funds <PlusIcon />
            </Button>

            <Button
              variant="ghost"
              className="border border-[#d7dfbe] text-black font-semibold hover:!bg-transparent hover:!scale-103 hover:!text-black hover:!border-[#d7dfbe] transition-all duration-300 cursor-pointer"
              onClick={handleOpenWalletQR}
            >
              Your Senda Wallet <Wallet className="h-4 w-4" />
            </Button>

            <WalletQRDialog ref={walletQRDialogRef} walletAddress={sendaWalletAddress || ''} />

            {/* Deposit Modal */}
            <DepositModal
              ref={depositModalRef}
              onClose={() => console.log('Deposit modal closed')}
              onComplete={handleDepositComplete}
            />
          </div>
        </Card>

        <Card className="bg-white rounded-2xl shadow-md">
          <Tabs defaultValue="deposits" className="p-0">
            <div className="overflow-x-auto">
              <TabsList className="w-full grid grid-cols-3 bg-transparent border-b-2 border-gray-400/5 p-0 rounded-none h-auto">
                <TabsTrigger
                  value="paths"
                  className="py-4 px-6 data-[state=active]:border-b-3 data-[state=active]:border-[#d7dfbe] data-[state=active]:shadow-none rounded-none rounded-tl-lg data-[state=active]:text-foreground data-[state=active]:font-bold"
                >
                  My Paths
                </TabsTrigger>

                <TabsTrigger
                  value="deposits"
                  className="py-4 px-6 data-[state=active]:border-b-3 data-[state=active]:border-[#d7dfbe] data-[state=active]:shadow-none rounded-none data-[state=active]:text-foreground data-[state=active]:font-bold"
                >
                  Active deposits
                </TabsTrigger>
                <TabsTrigger
                  value="history"
                  className="py-4 px-6 data-[state=active]:border-b-3 data-[state=active]:border-[#d7dfbe] data-[state=active]:shadow-none rounded-none rounded-tr-lg data-[state=active]:text-foreground data-[state=active]:font-bold"
                >
                  Activity History
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="deposits" className="p-4 mt-0">
              {isLoadingTransactions ? (
                <div className="py-8 flex justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#d7dfbe] border-t-transparent" />
                </div>
              ) : transactions?.transactions && transactions.transactions.length > 0 ? (
                <div className="space-y-4">
                  {transactions.transactions
                    .filter((tx) => tx.status === 'PENDING')
                    .map((transaction) => (
                      <TransactionCard
                        key={transaction.id}
                        id={transaction.id}
                        amount={transaction.amount}
                        token={transaction.depositRecord?.stable === 'usdc' ? 'USDC' : 'USDT'}
                        recipientEmail="recipient@example.com"
                        createdAt={new Date(transaction.createdAt)}
                        status={transaction.status}
                        authorization={transaction.depositRecord?.policy === 'DUAL' ? 'both' : 'sender'}
                        isDepositor={true}
                        onClick={() => handleOpenTransactionDetails(transaction)}
                      />
                    ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                  <h3 className="text-xl font-medium text-slate-700 mb-2">You don't have any active transactions!</h3>
                  <p className="text-slate-500 mb-6">Start by buying or depositing funds:</p>
                  <Button
                    className="bg-[#f6ead7] text-black font-semibold hover:font-bold hover:bg-[#f6ead7] cursor-pointer"
                    onClick={handleOpenDepositModal}
                  >
                    <PlusIcon className="h-4 w-4 mr-2" />
                    Add Funds
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="history" className="p-4 mt-0">
              {isLoadingTransactions ? (
                <div className="py-8 flex justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#d7dfbe] border-t-transparent" />
                </div>
              ) : transactions?.transactions && transactions.transactions.length > 0 ? (
                <div className="space-y-4">
                  {transactions.transactions
                    .filter((tx) => tx.status !== 'PENDING')
                    .map((transaction) => (
                      <TransactionCard
                        key={transaction.id}
                        id={transaction.id}
                        amount={transaction.amount}
                        token={transaction.depositRecord?.stable === 'usdc' ? 'USDC' : 'USDT'}
                        recipientEmail="recipient@example.com"
                        createdAt={new Date(transaction.createdAt)}
                        status={transaction.status}
                        authorization={transaction.depositRecord?.policy === 'DUAL' ? 'both' : 'sender'}
                        isDepositor={true}
                        onClick={() => handleOpenTransactionDetails(transaction)}
                      />
                    ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                  <h3 className="text-xl font-medium text-slate-700 mb-2">Nothing to be found here!</h3>
                  <p className="text-slate-500 mb-6">Start by sending or depositing funds.</p>
                  <Button
                    className="bg-[#f6ead7] text-black font-semibold hover:font-bold hover:bg-[#f6ead7] cursor-pointer"
                    onClick={handleOpenDepositModal}
                  >
                    <PlusIcon className="h-4 w-4 mr-2" />
                    Add Funds
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="paths" className="p-0 mt-0">
              <div className="py-12 text-center">
                <img src={path.src} className="mx-auto mb-6 h-12 rounded-lg" />
                <h3 className="text-gray-900 text-lg font-medium">You have no trust paths yet!</h3>
                <p className="text-gray-500">Start connecting with your people here.</p>
                <Button className="bg-[#f6ead7] text-black font-semibold hover:font-bold hover:bg-[#f6ead7] cursor-pointer mt-6">
                  Add New Persona <PlusIcon />
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </Card>
      </main>

      {selectedTransaction && (
        <TransactionDetails
          isOpen={isTransactionDetailsOpen}
          onClose={() => setIsTransactionDetailsOpen(false)}
          transaction={{
            id: selectedTransaction.id,
            amount: selectedTransaction.amount,
            token: selectedTransaction.depositRecord?.stable === 'usdc' ? 'USDC' : 'USDT',
            recipientEmail: 'recipient@example.com',
            createdAt: new Date(selectedTransaction.createdAt),
            status: selectedTransaction.status,
            authorization: selectedTransaction.depositRecord?.policy === 'DUAL' ? 'both' : 'sender',
            isDepositor: true,
            signatures: [],
            statusHistory: [
              {
                status: 'CREATED',
                timestamp: new Date(selectedTransaction.createdAt),
                actor: 'You',
              },
            ],
            depositIndex: selectedTransaction.depositRecord?.depositIndex || 0,
            transactionSignature: undefined,
          }}
        />
      )}
    </div>
  )
}
