import { Keypair, PublicKey, Transaction } from "@solana/web3.js";
import {
  KeypairWalletAdapter,
  KeypairAdapterConfig,
  KeypairNotSetError,
} from '@/lib/utils/keypair-wallet-adapter';

let _adapter: KeypairWalletAdapter | null = null;

export function initWalletAdapter(pubkey: string) {
  if (!_adapter) {
    const key = new PublicKey(pubkey);
    _adapter = new KeypairWalletAdapter({ publicKey: key, name: 'SendaWallet' });
  }
  return _adapter;
}

export async function loadKeypair(): Promise<boolean> {
  if (!_adapter) throw new Error("Adapter not initialized");

  // If the adapter is already connected, skip all the work.
  if (_adapter.connected) return true;

  const pkStr = _adapter.publicKey?.toString();
  if (!pkStr) return false;

  // Always fetch the (encrypted) secret from the backend and decrypt on the
  // server— no secrets ever touch localStorage.
  const res = await fetch('/api/user-wallet', {
    method: 'POST',
    body: JSON.stringify({ userId: pkStr }),
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) return false;
  const { encryptedPrivateKey, iv, authTag } = await res.json();

  const dec = await fetch('/api/decrypt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ encryptedPrivateKey, iv, authTag }),
  });
  if (!dec.ok) return false;
  const { decrypted } = await dec.json();
  const secret = Buffer.from(decrypted, 'base64');
  const kp = Keypair.fromSecretKey(secret);

  _adapter.setKeypair(kp);
  await _adapter.connect();
  return true;
}

export function getWalletAdapter(): KeypairWalletAdapter | null {
  return _adapter;
}

export function isSendaWalletConnected(): boolean {
  return !!(_adapter && _adapter.connected && _adapter.publicKey);
}

export type { KeypairWalletAdapter, KeypairAdapterConfig, KeypairNotSetError };