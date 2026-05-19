import { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useMemoizedFn } from 'ahooks';
import { apisPerps } from '@/core/apis';
import { perpsStore } from '@/hooks/perps/usePerpsStore';
import { writeActiveAssetDataToCache } from '@/hooks/perps/useActiveAssetDataCache';
import {
  WsActiveAssetCtx,
  WsActiveAssetData,
} from '@rabby-wallet/hyperliquid-sdk';

/**
 * Manages WebSocket subscriptions for active asset context and data.
 * Handles coin switching, app foreground/background transitions,
 * and cleanup on unmount.
 */
export const useActiveAssetSubscription = (coin: string) => {
  const [activeAssetCtx, setActiveAssetCtx] = useState<
    WsActiveAssetCtx['ctx'] | null
  >(null);
  const [activeAssetData, setActiveAssetData] =
    useState<WsActiveAssetData | null>(null);

  const currentAddress = perpsStore(s => s.currentPerpsAccount?.address);

  const coinRef = useRef(coin);
  useEffect(() => {
    coinRef.current = coin;
  }, [coin]);

  const unsubCtxRef = useRef<() => void>(() => {});
  const unsubDataRef = useRef<() => void>(() => {});

  const subscribeCtx = useMemoizedFn(() => {
    const sdk = apisPerps.getPerpsSDK();
    const { unsubscribe } = sdk.ws.subscribeToActiveAssetCtx(coin, data => {
      if (coinRef.current !== data.coin) {
        return;
      }
      setActiveAssetCtx(data.ctx);
    });
    return unsubscribe;
  });

  const subscribeData = useMemoizedFn(() => {
    const address = perpsStore.getState().currentPerpsAccount?.address;
    if (!address) {
      return () => {};
    }
    const sdk = apisPerps.getPerpsSDK();
    const { unsubscribe } = sdk.ws.subscribeToActiveAssetData(
      coin,
      address,
      data => {
        if (coinRef.current !== data.coin) {
          return;
        }
        // Late frame after account switch: don't leak old-account leverage into
        // the new account's cache, even if the WS hasn't finished unsubscribing.
        const liveAddress = perpsStore.getState().currentPerpsAccount?.address;
        if (liveAddress !== address) {
          return;
        }
        setActiveAssetData(data);
        // Keep home cache hot so returning to home avoids a REST round-trip.
        writeActiveAssetDataToCache(data.coin, address, data);
      },
    );
    return unsubscribe;
  });

  const subscribeAll = useMemoizedFn(() => {
    unsubCtxRef.current?.();
    unsubDataRef.current?.();
    // Avoid leaking previous coin's leverage into the new coin's marginUsage
    // between coin switch and the first WS push.
    setActiveAssetCtx(null);
    setActiveAssetData(null);
    unsubCtxRef.current = subscribeCtx();
    unsubDataRef.current = subscribeData();
  });

  const unsubscribeAll = useMemoizedFn(() => {
    unsubCtxRef.current?.();
    unsubDataRef.current?.();
    unsubCtxRef.current = () => {};
    unsubDataRef.current = () => {};
  });

  // Resubscribe on coin or account switch so the WS itself is bound to the
  // right address; the in-callback guard above only covers late frames.
  useEffect(() => {
    subscribeAll();
    return () => {
      unsubscribeAll();
    };
  }, [coin, currentAddress, subscribeAll, unsubscribeAll]);

  // Re-subscribe when app returns to foreground
  useEffect(() => {
    let appStateRef = AppState.currentState;
    const subscription = AppState.addEventListener(
      'change',
      (nextAppState: AppStateStatus) => {
        if (
          appStateRef.match(/inactive|background/) &&
          nextAppState === 'active'
        ) {
          subscribeAll();
        }
        appStateRef = nextAppState;
      },
    );
    return () => subscription.remove();
  }, [subscribeAll]);

  return {
    activeAssetCtx,
    activeAssetData,
  };
};
