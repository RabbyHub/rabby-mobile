import { useCallback, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type {
  OpenOrder,
  SpotClearinghouseState,
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

/**
 * Spot prices (and optionally the account's spot balances / open spot orders)
 * polled over REST while the screen is focused and the app is active. Spot
 * screens are rarely open, so this stays off the shared Perps WS store.
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
  const [mids, setMids] = useState<Record<string, string> | null>(null);
  const [account, setAccount] = useState<SpotAccountSnapshot | null>(null);
  const inFlightRef = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlightRef.current) {
      return;
    }
    inFlightRef.current = true;
    try {
      const sdk = apisPerps.getPerpsSDK();
      const [nextMids, spotState, openOrders] = await Promise.all([
        sdk.info.getAllMids().catch(() => null),
        withAccount && address
          ? sdk.info.getSpotClearingHouseState(address).catch(() => null)
          : null,
        withAccount && address
          ? sdk.info.getFrontendOpenOrders(address).catch(() => null)
          : null,
      ]);
      if (nextMids) {
        setMids(nextMids);
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

  const markets = useMemo(
    () => buildSpotMarkets(spotMeta, mids),
    [spotMeta, mids],
  );

  return {
    markets,
    isLoading: !spotMeta || !mids,
    isError: spotMetaStatus === 'error' && !spotMeta,
    // Never surface a previous account's balances after an account switch.
    account: account && account.address === address ? account : null,
    currentPerpsAccount,
    refresh,
  };
};
