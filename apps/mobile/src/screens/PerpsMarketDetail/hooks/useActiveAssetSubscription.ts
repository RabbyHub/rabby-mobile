import { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useMemoizedFn } from 'ahooks';
import { apisPerps } from '@/core/apis';
import { perpsStore } from '@/hooks/perps/usePerpsStore';
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
        setActiveAssetData(data);
      },
    );
    return unsubscribe;
  });

  const subscribeAll = useMemoizedFn(() => {
    unsubCtxRef.current?.();
    unsubDataRef.current?.();
    unsubCtxRef.current = subscribeCtx();
    unsubDataRef.current = subscribeData();
  });

  const unsubscribeAll = useMemoizedFn(() => {
    unsubCtxRef.current?.();
    unsubDataRef.current?.();
    unsubCtxRef.current = () => {};
    unsubDataRef.current = () => {};
  });

  // Subscribe when coin changes
  useEffect(() => {
    subscribeAll();
    return () => {
      unsubscribeAll();
    };
  }, [coin, subscribeAll, unsubscribeAll]);

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
