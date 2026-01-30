import { Account } from '@/core/services/preference';
import { dappService } from '@/core/services';
import { formatNetworth } from '@/utils/math';
import { formatUsdValue } from '@/utils/number';
import { safeGetOrigin } from '@rabby-wallet/base-utils/dist/isomorphic/url';
import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/shallow';
import useProtocolListStore from '@/store/protocols';
import useAppChainStore from '@/store/appchain';
import { DappSelectItem } from './constants';
import { getDappAccount, useDapps } from '@/hooks/useDapps';
import { useAccounts } from '@/hooks/account';
import { perpsStore as usePerpsStore } from '@/hooks/perps/usePerpsStore';
import { useSceneAccountInfo } from '@/hooks/accountsSwitcher';

const ORIGIN_PNG_IDS = new Set(['venus', 'hyperliquid']);

const getOriginKey = (url?: string) => {
  if (!url) {
    return undefined;
  }
  const origin = safeGetOrigin(url) || safeGetOrigin(`https://${url}`) || url;
  return origin ? origin.toLowerCase() : undefined;
};

type Params = {
  dAppList: DappSelectItem[];
};

export const useDappListWithValue = ({ dAppList }: Params) => {
  const protocolMap = useProtocolListStore(
    useShallow(state => state.protocolMap),
  );

  const defiValueByOrigin = useCallback(
    (address?: string) => {
      if (!address) {
        return new Map<string, number>();
      }
      const protocols = protocolMap[address] || [];

      if (!protocols.length) {
        return new Map<string, number>();
      }
      const map = new Map<string, number>();
      protocols.forEach(protocol => {
        const originKey = getOriginKey(protocol.site_url);
        if (!originKey) {
          return;
        }
        const netWorth = Number(protocol.netWorth || 0);
        if (Number.isNaN(netWorth)) {
          return;
        }
        map.set(originKey, (map.get(originKey) || 0) + netWorth);
      });
      return map;
    },
    [protocolMap],
  );

  const { dapps } = useDapps();
  const { accounts } = useAccounts({
    disableAutoFetch: true,
  });
  const { finalSceneCurrentAccount: aaveLendingAccount } = useSceneAccountInfo({
    forScene: 'Lending',
  });

  const appChainMap = useAppChainStore(useShallow(s => s.appChainMap));
  const currentAddressAppChainMap = useCallback(
    (address?: string) => {
      const map = new Map<string, number>();
      if (address) {
        const appChainList = appChainMap[address.toLowerCase()] || [];
        appChainList.forEach(appChain => {
          const originKey = getOriginKey(appChain.site_url);
          if (!originKey) {
            return;
          }
          const netWorth = Number(appChain.netWorth || 0);
          map.set(originKey, (map.get(originKey) || 0) + netWorth);
        });
      }
      return map;
    },
    [appChainMap],
  );

  const hyperliquidAccountValue = usePerpsStore(
    useShallow(s => s.accountSummary?.accountValue),
  );

  const dappListWithValue = useMemo(() => {
    if (!dAppList.length) {
      return dAppList;
    }
    return dAppList.map(item => {
      if (item.id === 'hyperliquid') {
        return {
          ...item,
          value: formatUsdValue(hyperliquidAccountValue || 0),
        };
      }
      if (!item.url) {
        return item;
      }

      const dappOrigin = safeGetOrigin(item.url);

      const dappInfo = dapps[dappOrigin];
      let dappAccount: Account | null;
      dappAccount = getDappAccount({ dappInfo, accounts });
      if (item.id === 'aave') {
        dappAccount = aaveLendingAccount;
      }

      if (!dappAccount) {
        return item;
      }

      const originKey = getOriginKey(item.url);
      const hasValue = originKey
        ? defiValueByOrigin(dappAccount.address).has(originKey) ||
          currentAddressAppChainMap(dappAccount.address).has(originKey)
        : false;

      if (!originKey || !hasValue) {
        return {
          ...item,
          value: undefined,
          // remoteUrl: ORIGIN_PNG_IDS.has(item.id)
          //   ? undefined
          //   : dappService.getDapp(originKey || item.url || '')?.info
          //       ?.logo_url || undefined,
        };
      }
      const netWorth =
        defiValueByOrigin(dappAccount.address).get(originKey) ||
        currentAddressAppChainMap(dappAccount.address).get(originKey) ||
        0;

      return {
        ...item,
        value: formatNetworth(netWorth),
        // remoteUrl: ORIGIN_PNG_IDS.has(item.id)
        //   ? undefined
        //   : dappService.getDapp(originKey || item.url || '')?.info?.logo_url ||
        //     undefined,
      };
    });
  }, [
    dAppList,
    dapps,
    accounts,
    defiValueByOrigin,
    currentAddressAppChainMap,
    hyperliquidAccountValue,
    aaveLendingAccount,
  ]);

  return dappListWithValue;
};
