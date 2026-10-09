import { useCallback, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type {
  OpenOrder,
  SpotAssetCtx,
  SpotClearinghouseState,
  SpotMeta,
} from '@rabby-wallet/hyperliquid-sdk';
import { useShallow } from 'zustand/react/shallow';

import { apisPerps } from '@/core/apis/perps';
import { fetchSpotMeta, perpsStore } from '@/hooks/perps/usePerpsStore';

import { buildSpotMarkets, isSpotOpenOrder } from './spotMarkets';

const POLL_INTERVAL_MS = 4000;

type SpotAccountSnapshot = {
  address: string;
  balances: SpotClearinghouseState['balances'];
  openOrders: OpenOrder[];
};

type SpotMarketSnapshot = {
  meta: SpotMeta;
  ctxs: SpotAssetCtx[];
};

/**
 * Spot pair contexts (mid, 24h change, volume) and optionally the account's
 * spot balances / open spot orders, polled over REST while the screen is
 * focused and the app is active. Spot screens are rarely open, so this stays
 * off the shared Perps WS store.
 */
export const usePerpsSpotData = ({ withAccount }: { withAccount: boolean }) => {
  const { spotMeta, spotMetaStatus, currentPerpsAccount } = perpsStore(
    useShallow(s => ({
      spotMeta: s.spotMeta,
      spotMetaStatus: s.spotMetaStatus,
      currentPerpsAccount: s.currentPerpsAccount,
    })),
  );
  const address = currentPerpsAccount?.address;
  const [snapshot, setSnapshot] = useState<SpotMarketSnapshot | null>(null);
  // When the pair contexts were last fetched; a failed poll keeps the old
  // prices, so order code must check freshness before pricing a market order.
  const [midsUpdatedAt, setMidsUpdatedAt] = useState(0);
  const [account, setAccount] = useState<SpotAccountSnapshot | null>(null);
  const inFlightRef = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlightRef.current) {
      return;
    }
    inFlightRef.current = true;
    try {
      const sdk = apisPerps.getPerpsSDK();
      const [metaAndCtxs, spotState, openOrders] = await Promise.all([
        sdk.info.getSpotMetaAndAssetCtxs().catch(() => null),
        withAccount && address
          ? sdk.info.getSpotClearingHouseState(address).catch(() => null)
          : null,
        withAccount && address
          ? sdk.info.getFrontendOpenOrders(address).catch(() => null)
          : null,
      ]);
      if (
        metaAndCtxs &&
        Array.isArray(metaAndCtxs[0]?.universe) &&
        Array.isArray(metaAndCtxs[1])
      ) {
        setSnapshot({ meta: metaAndCtxs[0], ctxs: metaAndCtxs[1] });
        setMidsUpdatedAt(Date.now());
      }
      if (withAccount && address && (spotState || openOrders)) {
        setAccount(current => {
          const prev = current?.address === address ? current : null;
          return {
            address,
            balances: spotState?.balances ?? prev?.balances ?? [],
            openOrders:
              openOrders?.filter(isSpotOpenOrder) ?? prev?.openOrders ?? [],
          };
        });
      }
    } finally {
      inFlightRef.current = false;
    }
  }, [address, withAccount]);

  useFocusEffect(
    useCallback(() => {
      // Cached meta lets the list render while the first poll is in flight.
      fetchSpotMeta();
      refresh();
      const timer = setInterval(() => {
        if (AppState.currentState === 'active') {
          refresh();
        }
      }, POLL_INTERVAL_MS);
      return () => clearInterval(timer);
    }, [refresh]),
  );

  const meta = snapshot?.meta ?? spotMeta;
  const ctxs = snapshot?.ctxs ?? null;
  const markets = useMemo(
    () => buildSpotMarkets(meta, null, ctxs),
    [meta, ctxs],
  );

  return {
    markets,
    midsUpdatedAt,
    isLoading: !meta || !ctxs,
    isError: spotMetaStatus === 'error' && !meta,
    // Never surface a previous account's balances after an account switch.
    account: account && account.address === address ? account : null,
    currentPerpsAccount,
    refresh,
  };
};
