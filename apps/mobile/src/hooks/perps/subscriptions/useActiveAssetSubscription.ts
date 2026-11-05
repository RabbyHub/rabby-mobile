import { apisPerps } from '@/core/apis/perps';
import { perpsStore } from '@/hooks/perps/usePerpsStore';
import {
  readActiveAssetDataFromCache,
  writeActiveAssetDataToCache,
} from '@/hooks/perps/useActiveAssetDataCache';
import type {
  WsActiveAssetCtx,
  WsActiveAssetData,
} from '@rabby-wallet/hyperliquid-sdk';
import { useMemoizedFn } from 'ahooks';
import { useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

/**
 * Shared owner for the account-scoped active-asset feeds used by both the
 * existing Simple detail screen and Perps Pro. The default remains enabled so
 * the Simple call site keeps its previous lifecycle and behavior.
 */
export const useActiveAssetSubscription = (
  coin: string,
  options: { enabled?: boolean; trackContextFreshness?: boolean } = {},
) => {
  const enabled = options.enabled ?? true;
  const trackContextFreshness = options.trackContextFreshness ?? false;
  const currentAddress = perpsStore(
    state => state.currentPerpsAccount?.address,
  );
  const [activeAssetCtx, setActiveAssetCtx] = useState<
    WsActiveAssetCtx['ctx'] | null
  >(null);
  // Optional display-only context. Raw ctx/data retain their trading contract.
  const [displayContext, setDisplayContext] = useState<{
    coin: string;
    ctx: WsActiveAssetCtx['ctx'];
  } | null>(null);
  const contextSubscription = useRef(0);
  const [activeAssetData, setActiveAssetData] =
    useState<WsActiveAssetData | null>(() => {
      const address = perpsStore.getState().currentPerpsAccount?.address;
      return address ? readActiveAssetDataFromCache(coin, address) : null;
    });
  const coinRef = useRef(coin);
  const unsubCtxRef = useRef<() => void>(() => undefined);
  const unsubDataRef = useRef<() => void>(() => undefined);
  const unsubFreshnessRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    coinRef.current = coin;
  }, [coin]);

  const unsubscribeAll = useMemoizedFn(() => {
    unsubCtxRef.current?.();
    unsubDataRef.current?.();
    unsubFreshnessRef.current();
    unsubCtxRef.current = () => undefined;
    unsubDataRef.current = () => undefined;
    unsubFreshnessRef.current = () => undefined;
  });

  const seedCurrentContext = useMemoizedFn(() => {
    setActiveAssetCtx(null);
    if (trackContextFreshness) setDisplayContext(null);
    const address = perpsStore.getState().currentPerpsAccount?.address;
    setActiveAssetData(
      address ? readActiveAssetDataFromCache(coinRef.current, address) : null,
    );
  });

  const subscribeAll = useMemoizedFn(() => {
    const subscription = ++contextSubscription.current;
    unsubscribeAll();
    seedCurrentContext();
    if (!enabled || !coinRef.current) {
      return;
    }

    const sdk = apisPerps.getPerpsSDK();
    if (trackContextFreshness) {
      const invalidate = () => {
        if (subscription === contextSubscription.current)
          setDisplayContext(null);
      };
      sdk.ws.on('close', invalidate);
      sdk.ws.on('reconnecting', invalidate);
      unsubFreshnessRef.current = () => {
        sdk.ws.off('close', invalidate);
        sdk.ws.off('reconnecting', invalidate);
      };
    }
    unsubCtxRef.current = sdk.ws.subscribeToActiveAssetCtx(
      coinRef.current,
      data => {
        if (coinRef.current === data.coin) {
          setActiveAssetCtx(data.ctx);
          if (
            trackContextFreshness &&
            subscription === contextSubscription.current
          ) {
            setDisplayContext({ coin: data.coin, ctx: data.ctx });
          }
        }
      },
    ).unsubscribe;

    const address = perpsStore.getState().currentPerpsAccount?.address;
    if (!address) {
      return;
    }
    unsubDataRef.current = sdk.ws.subscribeToActiveAssetData(
      coinRef.current,
      address,
      data => {
        if (coinRef.current !== data.coin) {
          return;
        }
        const liveAddress = perpsStore.getState().currentPerpsAccount?.address;
        if (liveAddress !== address) {
          return;
        }
        setActiveAssetData(
          writeActiveAssetDataToCache(data.coin, address, data),
        );
      },
    ).unsubscribe;
  });

  useEffect(() => {
    subscribeAll();
    return () => {
      contextSubscription.current += 1;
      unsubscribeAll();
    };
  }, [
    coin,
    currentAddress,
    enabled,
    trackContextFreshness,
    subscribeAll,
    unsubscribeAll,
  ]);

  useEffect(() => {
    let appStateRef = AppState.currentState;
    const subscription = AppState.addEventListener(
      'change',
      (nextAppState: AppStateStatus) => {
        if (trackContextFreshness && nextAppState !== 'active')
          setDisplayContext(null);
        if (
          enabled &&
          appStateRef.match(/inactive|background/) &&
          nextAppState === 'active'
        ) {
          subscribeAll();
        }
        appStateRef = nextAppState;
      },
    );
    return () => subscription.remove();
  }, [enabled, trackContextFreshness, subscribeAll]);

  const refreshActiveAssetData = useMemoizedFn(async () => {
    const expectedCoin = coinRef.current;
    const expectedAddress = perpsStore.getState().currentPerpsAccount?.address;
    if (!expectedCoin || !expectedAddress) {
      return null;
    }
    const data = await apisPerps
      .getPerpsSDK()
      .info.getActiveAssetData(expectedCoin, expectedAddress);
    if (
      coinRef.current !== expectedCoin ||
      perpsStore.getState().currentPerpsAccount?.address !== expectedAddress
    ) {
      return null;
    }
    const effectiveData = writeActiveAssetDataToCache(
      expectedCoin,
      expectedAddress,
      data,
    );
    setActiveAssetData(effectiveData);
    return effectiveData;
  });

  return {
    activeAssetCtx,
    displayAssetCtx: trackContextFreshness
      ? enabled && displayContext?.coin === coin
        ? displayContext.ctx
        : null
      : activeAssetCtx,
    activeAssetData,
    refreshActiveAssetData,
  };
};
