
"use client";

import { useEffect, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { initWalletAdapter, loadKeypair, KeypairWalletAdapter } from "@/lib/services/wallet";

export function useSendaWallet(sendaPubkey?: string) {
  const [adapter, setAdapter] = useState<KeypairWalletAdapter | null>(null);
  const [publicKey, setPublicKey] = useState<PublicKey | null>(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    
    if (!sendaPubkey) {
      setAdapter(null);
      setPublicKey(null);
      setConnected(false);
      return;
    }

    setLoading(true);
    const wa = initWalletAdapter(sendaPubkey);
    setAdapter(wa as KeypairWalletAdapter);

    // 3) load (decrypt + attach) the private key and connect
    loadKeypair()
      .then((ok) => {
        if (ok) {
          setPublicKey(wa.publicKey);   // expose the PublicKey
          setConnected(true);
        } else {
          setPublicKey(null);
          setConnected(false);
        }
      })
      .catch(() => {
        setPublicKey(null);
        setConnected(false);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [sendaPubkey]);

  return { adapter, publicKey, connected, loading };
}
