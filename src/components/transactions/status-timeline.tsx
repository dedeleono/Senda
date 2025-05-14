'use client';

import { CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { SignatureType } from '@prisma/client';

interface TimelineEvent {
  status: string;
  timestamp: Date;
  actor?: string;
}

interface SignatureEvent {
  signer: string;
  role: SignatureType;
  timestamp?: Date;
  status: 'signed' | 'pending';
}

interface StatusTimelineProps {
  statusHistory: TimelineEvent[];
  signatures: SignatureEvent[];
}

export default function StatusTimeline({ statusHistory, signatures }: StatusTimelineProps) {
  const allEvents = [...statusHistory];
  
  signatures.forEach(sig => {
    if (sig.timestamp && sig.status === 'signed') {
      allEvents.push({
        status: `SIGNATURE_${sig.role}`,
        timestamp: sig.timestamp,
        actor: sig.signer
      });
    }
  });
  
  const sortedEvents = [...allEvents].sort((a, b) => 
    b.timestamp.getTime() - a.timestamp.getTime()
  );

  const getStatusIcon = (status: string) => {
    if (status.includes('COMPLETED') || status.includes('SIGNATURE')) {
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    } else if (status.includes('CANCELLED') || status.includes('REJECTED') || status.includes('FAILED')) {
      return <XCircle className="h-5 w-5 text-red-500" />;
    } else if (status.includes('PENDING')) {
      return <Clock className="h-5 w-5 text-yellow-500" />;
    } else {
      return <AlertCircle className="h-5 w-5 text-blue-500" />;
    }
  };

  const getStatusText = (event: TimelineEvent) => {
    const status = event.status;
    
    if (status.includes('SIGNATURE')) {
      const role = status.includes('SENDER') ? 'Sender' : 
                  status.includes('RECEIVER') ? 'Receiver' : 'Dual';
      return `${role} signed`;
    }
    
    switch (status) {
      case 'CREATED':
        return 'Deposit created';
      case 'PENDING':
        return 'Pending withdrawal';
      case 'COMPLETED':
        return 'Deposit completed';
      case 'CANCELLED':
        return 'Deposit cancelled';
      case 'REJECTED':
        return 'Withdrawal rejected';
      case 'FAILED':
        return 'Transaction failed';
      default:
        return status;
    }
  };

  const formatDate = (date: Date) => {
    return format(date, 'MMM d, yyyy h:mm a');
  };

  const pendingSignatures = signatures.filter(sig => sig.status === 'pending');

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        {sortedEvents.map((event, index) => (
          <div key={index} className="relative pl-6">
            {index < sortedEvents.length - 1 && (
              <div className="absolute top-5 bottom-0 left-[10px] w-0.5 bg-gray-200"></div>
            )}
            
            <div className="absolute left-0 top-0 bg-white">
              {getStatusIcon(event.status)}
            </div>
            
            <div className="pb-4">
              <div className="flex items-start">
                <div>
                  <h3 className="text-sm font-medium">{getStatusText(event)}</h3>
                  <p className="text-xs text-gray-500 mt-1">{formatDate(event.timestamp)}</p>
                </div>
                
                {event.actor && (
                  <div className="ml-auto text-xs bg-gray-100 px-2 py-1 rounded-full">
                    {event.actor.includes('@') 
                      ? event.actor 
                      : `${event.actor.substring(0, 4)}...${event.actor.substring(event.actor.length - 4)}`}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        
        {sortedEvents.length === 0 && (
          <div className="text-sm text-gray-500 italic">
            No transaction events found
          </div>
        )}
      </div>
      
      {pendingSignatures.length > 0 && (
        <div className="mt-6 border-t pt-4">
          <h3 className="text-sm font-medium mb-3">Pending Signatures</h3>
          
          <div className="space-y-3">
            {pendingSignatures.map((sig, index) => (
              <div key={index} className="flex items-center">
                <Clock className="h-4 w-4 text-yellow-500 mr-2" />
                <div>
                  <span className="text-sm">
                    {sig.role === SignatureType.SENDER ? 'Sender' : 
                     sig.role === SignatureType.RECEIVER ? 'Receiver' : 'Dual'} signature required
                  </span>
                  <p className="text-xs text-gray-500">{sig.signer}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 