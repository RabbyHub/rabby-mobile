import type { L2Book } from '@rabby-wallet/hyperliquid-sdk';
import { useEffect, useMemo, useRef, useState } from 'react';

import { apisPerps } from '@/core/apis/perps';
import type { PerpsBookPrecision } from '@/core/services/perpsService';

export type PerpsRealtimeStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'stale'
  | 'error';

type FastL2Snapshot = {
  book: L2Book | null;
  error: Error | null;
  identity: string;
  status: PerpsRealtimeStatus;
};

const createIdentity = (
  enabled: boolean,
  coin: string,
  precision: PerpsBookPrecision | null,
) =>
  enabled && coin && precision
    ? `${coin}:${precision.nSigFigs}:${precision.mantissa ?? 'null'}`
    : 'disabled';

const hasFastL2BookShape = (data: L2Book | null | undefined): data is L2Book =>
  Array.isArray(data?.levels) &&
  Array.isArray(data.levels[0]) &&
  Array.isArray(data.levels[1]);

export const usePerpsFastL2 = ({
  coin,
  enabled,
  precision,
}: {
  coin: string;
  enabled: boolean;
  precision: PerpsBookPrecision | null;
}) => {
  const nSigFigs = precision?.nSigFigs;
  const mantissa = precision?.mantissa;
  const identity = createIdentity(enabled, coin, precision);
  const generationRef = useRef(0);
  const [snapshot, setSnapshot] = useState<FastL2Snapshot>({
    book: null,
    error: null,
    identity,
    status: identity === 'disabled' ? 'idle' : 'loading',
  });

  useEffect(() => {
    generationRef.current += 1;
    const generation = generationRef.current;
    setSnapshot({
      book: null,
      error: null,
      identity,
      status: identity === 'disabled' ? 'idle' : 'loading',
    });
    if (identity === 'disabled' || nSigFigs == null) {
      return;
    }

    const sdk = apisPerps.getPerpsSDK();
    const handleConnectionLoss = () => {
      if (generationRef.current !== generation) {
        return;
      }
      setSnapshot({
        book: null,
        error: null,
        identity,
        status: 'stale',
      });
    };
    const handleOpen = () => {
      if (generationRef.current !== generation) {
        return;
      }
      setSnapshot({
        book: null,
        error: null,
        identity,
        status: 'loading',
      });
    };
    const handleReconnectFailed = () => {
      if (generationRef.current !== generation) {
        return;
      }
      setSnapshot({
        book: null,
        error: new Error('Perps order book reconnect failed'),
        identity,
        status: 'error',
      });
    };

    sdk.ws.on('close', handleConnectionLoss);
    sdk.ws.on('reconnecting', handleConnectionLoss);
    sdk.ws.on('open', handleOpen);
    sdk.ws.on('reconnectFailed', handleReconnectFailed);

    let unsubscribe = () => {};
    const handleInvalidPayload = () => {
      setSnapshot(previous =>
        previous.identity === identity
          ? {
              ...previous,
              error: new Error('Invalid Perps order book payload'),
              status: previous.book ? 'stale' : 'error',
            }
          : previous,
      );
    };
    try {
      const subscription = sdk.ws.subscribeToFastL2(
        {
          coin,
          nSigFigs,
          mantissa: mantissa ?? undefined,
        },
        data => {
          if (generationRef.current !== generation) {
            return;
          }
          if (!data) {
            handleInvalidPayload();
            return;
          }
          if (data.coin !== coin) {
            return;
          }
          if (!hasFastL2BookShape(data)) {
            handleInvalidPayload();
            return;
          }
          setSnapshot({
            book: data,
            error: null,
            identity,
            status: 'ready',
          });
        },
      );
      unsubscribe = subscription.unsubscribe;
    } catch (error) {
      setSnapshot({
        book: null,
        error:
          error instanceof Error
            ? error
            : new Error('Failed to subscribe to Perps order book'),
        identity,
        status: 'error',
      });
    }

    return () => {
      generationRef.current += 1;
      sdk.ws.off('close', handleConnectionLoss);
      sdk.ws.off('reconnecting', handleConnectionLoss);
      sdk.ws.off('open', handleOpen);
      sdk.ws.off('reconnectFailed', handleReconnectFailed);
      try {
        unsubscribe();
      } catch (error) {
        console.error('[usePerpsFastL2] unsubscribe failed', error);
      }
    };
  }, [coin, identity, mantissa, nSigFigs]);

  return useMemo(
    () =>
      snapshot.identity === identity
        ? snapshot
        : {
            book: null,
            error: null,
            identity,
            status:
              identity === 'disabled'
                ? ('idle' as const)
                : ('loading' as const),
          },
    [identity, snapshot],
  );
};
