'use client';

import { 
  WalletName, 
  WalletReadyState, 
  BaseMessageSignerWalletAdapter, 
  SendTransactionOptions,
} from '@solana/wallet-adapter-base';
import { Connection, Keypair, PublicKey, Transaction, VersionedTransaction, Ed25519Keypair } from '@solana/web3.js';

export class KeypairNotSetError extends Error {
  name = 'KeypairNotSetError';
  constructor() {
    super('Keypair not set');
  }
}

export interface KeypairAdapterConfig {
  name: string;
  publicKey?: PublicKey | null;
  keypair?: Keypair | null;
}


export class KeypairWalletAdapter extends BaseMessageSignerWalletAdapter {
  name = 'SendaWallet' as WalletName;
  url = 'https://senda.app';
  icon = 'data:image/svg+xml;base64,<svg>...</svg>';
  readonly supportedTransactionVersions = new Set(['legacy', 0] as const);

  private _publicKey: PublicKey | null = null;
  private _keypair: Keypair | null = null;
  private _connecting: boolean = false;
  private _connected: boolean = false;

  constructor(config: KeypairAdapterConfig) {
    super();
    this.name = config.name as WalletName;
    this._publicKey = config.publicKey || null;
    this._keypair = config.keypair || null;
    this._connected = !!this._keypair;
  }

  get publicKey(): PublicKey | null {
    return this._publicKey;
  }

  get connecting(): boolean {
    return this._connecting;
  }

  get connected(): boolean {
    return this._connected;
  }

  get readyState(): WalletReadyState {
    return WalletReadyState.Installed;
  }

  setKeypair(keypair: Keypair): void {
    this._keypair = keypair;
    this._publicKey = keypair.publicKey;
    if (!this._connected) {
      this._connected = true;
      this.emit('connect', this._publicKey);
    } else {
      this.emit('disconnect');
      this.emit('connect', this._publicKey);
    }
  }

  async connect(): Promise<void> {
    try {
      if (this.connected || this.connecting) return;
      this._connecting = true;

      if (!this._keypair) {
        throw new KeypairNotSetError();
      }

      this._publicKey = this._keypair.publicKey;
      this._connected = true;

      this.emit('connect', this._publicKey);
    } catch (error: any) {
      this.emit('error', error);
      throw error;
    } finally {
      this._connecting = false;
    }
  }

  async disconnect(): Promise<void> {
    if (!this._connected) return;
    this._connected = false;
    this.emit('disconnect');
  }

  async signTransaction<T extends Transaction | VersionedTransaction>(transaction: T): Promise<T> {
    try {
      if (!this._connected) {
        throw new Error('Wallet not connected');
      }

      if (!this._keypair) {
        throw new KeypairNotSetError();
      }

      // Handle legacy or versioned transactions
      if (transaction instanceof Transaction) {
        transaction.sign(this._keypair);
      } else if (transaction instanceof VersionedTransaction) {
        // Note: This implementation may vary depending on how versioned transactions are handled
        throw new Error('VersionedTransaction signing not implemented in this adapter');
      }

      return transaction;
    } catch (error: any) {
      this.emit('error', error);
      throw error;
    }
  }

  async signAllTransactions<T extends Transaction | VersionedTransaction>(transactions: T[]): Promise<T[]> {
    if (!this._connected) {
      throw new Error('Wallet not connected');
    }

    if (!this._keypair) {
      throw new KeypairNotSetError();
    }

    return transactions.map(transaction => {
      if (transaction instanceof Transaction) {
        transaction.sign(this._keypair!);
      } else {
        throw new Error('VersionedTransaction signing not implemented in this adapter');
      }
      return transaction;
    });
  }

  async signMessage(message: Uint8Array): Promise<Uint8Array> {
    if (!this._connected) {
      throw new Error('Wallet not connected');
    }

    if (!this._keypair) {
      throw new KeypairNotSetError();
    }

    //@todo implement proper message signing
    // For message signing with Ed25519, we need to use nacl
    // This is a simplified version - in production you would use TweetNaCl or similar
    const messageSignature = Buffer.from(message);
    return messageSignature;
  }
} 