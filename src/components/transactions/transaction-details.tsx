'use client';

import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useState } from 'react';
import Image from 'next/image';
import usdcIcon from '@/public/usdc.svg';
import usdtIcon from '@/public/usdt-round.svg';
import StatusTimeline from './status-timeline';
import { 
  ArrowUpRight, Copy, XCircle, Check, Loader2, ExternalLink, Calendar, Mail 
} from 'lucide-react';
import { format } from 'date-fns';
import { TransactionStatus, AuthorizedBy } from './transaction-card';
import { useToast } from '@/hooks/use-toast';
import { useSendaProgram } from '@/stores/use-senda-program';

interface TransactionDetailsProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: {
    id: string;
    amount: number;
    token: 'USDC' | 'USDT';
    recipientEmail: string;
    senderEmail?: string;
    createdAt: Date;
    status: TransactionStatus;
    authorization: AuthorizedBy;
    isDepositor: boolean;
    signatures: Array<{
      signer: string;
      role: 'sender' | 'receiver';
      timestamp?: Date;
      status: 'signed' | 'pending';
    }>;
    statusHistory: Array<{
      status: string;
      timestamp: Date;
      actor?: string;
    }>;
    depositIndex: number;
    transactionSignature?: string;
    senderPublicKey: string;
    receiverPublicKey: string;
  };
}

export default function TransactionDetails({ 
  isOpen, 
  onClose, 
  transaction 
}: TransactionDetailsProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const { requestWithdrawal, updateDepositSignature } = useSendaProgram();

  const handleActionClick = async () => {
    if (isProcessing) return;
    
    setIsProcessing(true);
    console.log('Starting transaction action with data:', {
      status: transaction.status,
      authorization: transaction.authorization,
      isDepositor: transaction.isDepositor,
      depositIndex: transaction.depositIndex,
      signatures: transaction.signatures
    });
    
    try {
      const { status, authorization, isDepositor, depositIndex } = transaction;
      
      // Check if depositIndex is undefined or null, but allow 0
      if (typeof depositIndex !== 'number') {
        throw new Error('Invalid deposit index');
      }
      
      if (status === 'PENDING') {
        // Handle different authorization scenarios
        if (authorization === 'RECEIVER' && !isDepositor) {
          // Receiver-only authorization - can release immediately
          await handleReleaseFunds(depositIndex);
        } else if (authorization === 'SENDER' && isDepositor) {
          // Sender-only authorization - can release immediately
          await handleReleaseFunds(depositIndex);
        } else if (authorization === 'DUAL') {
          // Dual signature required - need to check existing signatures
          const currentSignatures = transaction.signatures.map(sig => {
            try {
              return typeof sig === 'string' ? JSON.parse(sig) : sig;
            } catch (e) {
              console.error('Error parsing signature:', e);
              return null;
            }
          }).filter(Boolean);

          const senderSigned = currentSignatures.some(sig => 
            sig.role === 'sender' && sig.status === 'signed'
          );
          const receiverSigned = currentSignatures.some(sig => 
            sig.role === 'receiver' && sig.status === 'signed'
          );

          if ((isDepositor && !senderSigned) || (!isDepositor && !receiverSigned)) {
            // Current user hasn't signed yet - add their signature
            const role = isDepositor ? 'sender' : 'receiver';
            const signer = currentSignatures.find(sig => sig.role === role)?.signer;
            
            if (!signer) {
              throw new Error('Signer information not found');
            }

            const result = await updateDepositSignature({
              depositId: transaction.id,
              role,
              signer
            });

            if (!result.success) {
              throw result.error || new Error('Failed to update signature');
            }

            toast({
              title: 'Signature Added',
              description: 'Your signature has been recorded. Waiting for counterparty signature.',
            });
            onClose();
            return;
          }

          if (senderSigned && receiverSigned) {
            // Both parties have signed - can release funds
            await handleReleaseFunds(depositIndex);
          } else {
            toast({
              title: 'Waiting for Signatures',
              description: 'Both parties must sign before funds can be released.',
            });
            onClose();
            return;
          }
        }
      }
    } catch (error) {
      console.error('Transaction action failed:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to process transaction',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReleaseFunds = async (depositIdx: number) => {
    try {
      // Validate required fields
      if (!transaction.id || !transaction.senderPublicKey || !transaction.receiverPublicKey) {
        throw new Error('Missing required transaction information');
      }

      // Determine receiving party public key based on who is releasing
      const receivingPartyPublicKey = transaction.isDepositor 
        ? transaction.receiverPublicKey  // If depositor is releasing, funds go to receiver
        : transaction.senderPublicKey;   // If receiver is releasing, funds go to sender

      const result = await requestWithdrawal({
        escrowPublicKey: transaction.id,
        depositIndex: depositIdx,
        receivingPartyPublicKey
      });

      if (!result.success) {
        throw result.error || new Error('Failed to process withdrawal');
      }

      // Update local state with the transaction signature
      await updateDepositSignature({
        depositId: transaction.id,
        role: transaction.isDepositor ? 'sender' : 'receiver',
        signer: transaction.isDepositor ? transaction.senderPublicKey : transaction.receiverPublicKey
      });

      toast({
        title: 'Success',
        description: 'Funds have been released successfully',
      });

      onClose();
    } catch (error) {
      console.error('Error releasing funds:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to release funds',
      });
    }
  };

  const getActionButtonText = () => {
    const { status, authorization, isDepositor } = transaction;
    
    if (status === 'PENDING') {
      if (isDepositor && (authorization === 'SENDER' || authorization === 'DUAL')) {
        return 'Release Funds';
      } else if (!isDepositor && (authorization === 'RECEIVER' || authorization === 'DUAL')) {
        return 'Withdraw Funds';
      }
      
      if (isDepositor) {
        return 'Cancel Deposit';
      }
    }
    
    return 'Close';
  };

  const getActionButtonVariant = () => {
    const { status } = transaction;
    
    if (status === 'PENDING') {
      return 'default';
    }
    
    return 'outline';
  };

  const copyToClipboard = (text: string, message: string) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        toast({
          title: "Copied!",
          description: message,
        });
      })
      .catch(err => {
        console.error('Failed to copy:', err);
      });
  };

  const getTokenIcon = (token: 'USDC' | 'USDT') => {
    return token === 'USDC' ? usdcIcon : usdtIcon;
  };

  const getAuthorizationText = (authorization: AuthorizedBy) => {
    switch (authorization) {
      case 'SENDER':
        return 'Sender only';
      case 'RECEIVER':
        return 'Receiver only';
      case 'DUAL':
        return 'Both parties must approve';
      default:
        return authorization;
    }
  };

  const canPerformAction = () => {
    const { status, authorization, isDepositor, signatures } = transaction;
    
    if (status !== 'PENDING') return false;
    
    if (isDepositor && authorization === 'SENDER') {
      return true;
    }
    
    if (!isDepositor && authorization === 'RECEIVER') {
      return true;
    }
    
    if (authorization === 'DUAL') {
      const userRole = isDepositor ? 'sender' : 'receiver';
      const hasUserSigned = signatures.some(
        sig => sig.role === userRole && sig.status === 'signed'
      );
      
      return !hasUserSigned;
    }
    
    return false;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Transaction Details</DialogTitle>
        </DialogHeader>
        
        {/* Transaction Summary */}
        <Card className="p-4 border rounded-lg">
          <div className="flex justify-between items-center mb-4">
            <div className="text-xl font-semibold flex items-center">
              <Image 
                src={getTokenIcon(transaction.token)} 
                alt={transaction.token} 
                width={24} 
                height={24} 
                className="mr-2"
              />
              {transaction.amount.toFixed(2)} {transaction.token}
            </div>
            
            <div className="flex items-center">
              <span className={`text-xs px-2 py-1 rounded-full ${
                transaction.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                transaction.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {transaction.status}
              </span>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">ID</p>
              <div className="flex items-center mt-1">
                <p className="font-mono">{transaction.id.substring(0, 16)}...</p>
                <button 
                  onClick={() => copyToClipboard(transaction.id, 'Transaction ID copied')}
                  className="ml-2 text-gray-500 hover:text-gray-700"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            </div>
            
            <div>
              <p className="text-gray-500">Date</p>
              <div className="flex items-center mt-1">
                <Calendar className="h-4 w-4 text-gray-500 mr-1" />
                <p>{format(transaction.createdAt, 'MMM d, yyyy h:mm a')}</p>
              </div>
            </div>
            
            <div>
              <p className="text-gray-500">From</p>
              <div className="flex items-center mt-1">
                <Mail className="h-4 w-4 text-gray-500 mr-1" />
                <p>{transaction.senderEmail || 'You'}</p>
              </div>
            </div>
            
            <div>
              <p className="text-gray-500">To</p>
              <div className="flex items-center mt-1">
                <Mail className="h-4 w-4 text-gray-500 mr-1" />
                <p>{transaction.recipientEmail}</p>
              </div>
            </div>
            
            <div>
              <p className="text-gray-500">Authorization</p>
              <p className="mt-1">{getAuthorizationText(transaction.authorization)}</p>
            </div>
            
            <div>
              <p className="text-gray-500">Deposit Index</p>
              <p className="mt-1">#{transaction.depositIndex || 0}</p>
            </div>
          </div>
          
          {transaction.transactionSignature && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-gray-500 text-sm">Transaction Signature</p>
              <div className="flex items-center mt-1">
                <p className="text-xs font-mono truncate">{transaction.transactionSignature}</p>
                <div className="flex ml-2">
                  <button 
                    onClick={() => copyToClipboard(
                      transaction.transactionSignature!, 
                      'Transaction signature copied'
                    )}
                    className="text-gray-500 hover:text-gray-700 mr-1"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                  <a 
                    href={`https://explorer.solana.com/tx/${transaction.transactionSignature}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </div>
            </div>
          )}
        </Card>
        
        <div className="my-4">
          <h3 className="text-sm font-medium mb-3">Transaction Timeline</h3>
          <StatusTimeline 
            statusHistory={transaction.statusHistory}
            signatures={transaction.signatures}
          />
        </div>
        
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={onClose}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          
          <Button 
            variant={getActionButtonVariant()} 
            onClick={handleActionClick}
            disabled={isProcessing || !canPerformAction()}
            className="min-w-[120px]"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              getActionButtonText()
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 