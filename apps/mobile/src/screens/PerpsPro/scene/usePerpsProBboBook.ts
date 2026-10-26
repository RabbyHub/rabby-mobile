import type { L2Book } from '@rabby-wallet/hyperliquid-sdk';
import { useEffect, useMemo, useRef, useState } from 'react';

import { apisPerps } from '@/core/apis/perps';

import { buildPerpsProBboPrices } from '../model/bbo';

interface Snapshot {
  book: L2Book | null;
  epoch: number;
  identity: string;
  status: 'error' | 'idle' | 'loading' | 'ready' | 'stale';
}

export const usePerpsProBboBook = ({
  coin,
  enabled,
}: {
  coin: string;
  enabled: boolean;
}) => {
  const identity = enabled && coin ? coin : 'disabled';
  const generationRef = useRef(0);
  const [snapshot, setSnapshot] = useState<Snapshot>({
    book: null,
    epoch: 0,
    identity,
    status: identity === 'disabled' ? 'idle' : 'loading',
  });

  useEffect(() => {
    const generation = ++generationRef.current;
    setSnapshot({
      book: null,
      epoch: generation,
      identity,
      status: identity === 'disabled' ? 'idle' : 'loading',
    });
    if (identity === 'disabled') return;
    const sdk = apisPerps.getPerpsSDK();
    const onLoss = () => {
      if (generationRef.current === generation) {
        setSnapshot(current => ({
          ...current,
          book: null,
          epoch: current.epoch + 1,
          status: 'stale',
        }));
      }
    };
    const onReconnectFailed = () => {
      if (generationRef.current === generation) {
        setSnapshot(current => ({ ...current, book: null, status: 'error' }));
      }
    };
    sdk.ws.on('close', onLoss);
    sdk.ws.on('reconnecting', onLoss);
    sdk.ws.on('reconnectFailed', onReconnectFailed);
    let unsubscribe: () => void = () => undefined;
    try {
      unsubscribe = sdk.ws.subscribeToL2Book({ coin }, book => {
        if (generationRef.current !== generation || book.coin !== coin) return;
        if (!Number.isFinite(book.time) || book.time <= 0) return;
        setSnapshot(current => ({
          ...current,
          book,
          identity,
          status: 'ready',
        }));
      }).unsubscribe;
    } catch {
      setSnapshot({ book: null, epoch: generation, identity, status: 'error' });
    }
    return () => {
      generationRef.current += 1;
      sdk.ws.off('close', onLoss);
      sdk.ws.off('reconnecting', onLoss);
      sdk.ws.off('reconnectFailed', onReconnectFailed);
      try {
        unsubscribe();
      } catch (error) {
        console.error('[usePerpsProBboBook] unsubscribe failed', error);
      }
    };
  }, [coin, identity]);

  return useMemo(() => {
    const current =
      snapshot.identity === identity
        ? snapshot
        : {
            book: null,
            epoch: generationRef.current,
            identity,
            status:
              identity === 'disabled'
                ? ('idle' as const)
                : ('loading' as const),
          };
    return {
      ...current,
      prices: buildPerpsProBboPrices(
        current.status === 'ready' ? current.book : null,
      ),
      sessionKey:
        current.status === 'ready'
          ? `${current.identity}:${current.epoch}`
          : null,
    };
  }, [identity, snapshot]);
};
