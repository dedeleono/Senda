export type TransactionStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'REJECTED';
export type TokenType = 'USDC' | 'USDT';
export type AuthorizationType = 'SENDER' | 'RECEIVER' | 'DUAL';
export type AuthorizedBy = 'sender' | 'receiver' | 'both';

export interface RecipientInfo {
  email: string;
  walletAddress?: string;
  exists: boolean;
}

export interface AmountInfo {
  value: number;
  token: TokenType;
}

export interface TransactionResult {
  success: boolean;
  depositId?: string;
  signature?: string;
  error?: string;
}

export interface ServerStartResult {
  recipientNotFound: boolean;
  escrowExists: boolean;
  escrowPublicKey: string;
  senderPublicKey: string;
  receiverPublicKey: string;
}

export interface ServerFinalResult extends ServerStartResult {
  transactionId: string;
  depositId: string;
}

export interface DepositFormData {
  recipient: {
    email: string;
    exists: boolean;
  };
  amount: {
    value: number;
    token: TokenType;
  };
  authorization: AuthorizationType;
}

export interface DepositInput {
  escrow: string;
  depositor: string;
  recipientEmail: string;
  stable: 'usdc' | 'usdt';
  authorization: AuthorizationType;
  amount: number;
}

export interface EscrowInput {
  senderPublicKey: string;
  receiverPublicKey: string;
  seed: number;
}

export interface EscrowResult {
  success: boolean;
  escrowPublicKey?: string;
  error?: string;
}

export interface UserResult {
  id: string;
  email: string;
  sendaWalletPublicKey: string;
  role: 'GUEST' | 'INDIVIDUAL' | 'BUSINESS';
}

// New Service Response Types
export interface ServiceError {
  code: string;
  message: string;
  details?: unknown;
}

export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: ServiceError;
}

export interface UserServiceResponse extends ServiceResponse<{
  id: string;
  email: string;
  publicKey: string;
  role: 'GUEST' | 'INDIVIDUAL' | 'BUSINESS';
}> {}

export interface EscrowServiceResponse extends ServiceResponse<{
  escrowAddress: string;
  senderPublicKey: string;
  receiverPublicKey: string;
}> {}

export interface CreateDepositResponse extends ServiceResponse<{
  signature: string;
  escrowAddress: string;
  depositId: string;
  user: {
    id: string;
    publicKey: string;
    role: 'GUEST' | 'INDIVIDUAL' | 'BUSINESS';
  };
  transaction: {
    id: string;
    status: TransactionStatus;
  };
}> {}

// UI Form Types
export interface DepositFormState {
  formData: DepositFormData;
  step: number;
  isSubmitting: boolean;
  error?: string;
}

export interface DepositFormActions {
  updateFormData: (data: Partial<DepositFormData>) => void;
  nextStep: () => void;
  prevStep: () => void;
  setStep: (step: number) => void;
  resetForm: () => void;
  setSubmitting: (isSubmitting: boolean) => void;
  setError: (error?: string) => void;
}

export interface TransactionDetailsData {
  id: string;  // escrowId
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
} 