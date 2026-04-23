import { Account } from '@/core/services/preference';
import { formatNetworth } from '@/utils/math';
import { formatUsdValue } from '@/utils/number';
import { safeGetOrigin } from '@rabby-wallet/base-utils/dist/isomorphic/url';
import { useMemo } from 'react';
import { useShallow } from 'zustand/shallow';
import useProtocolListStore from '@/store/protocols';
import { appChainResourceStore } from '@/store/appchain';
import { DappSelectItem } from './constants';
import { getDappAccount, useDapps } from '@/hooks/useDapps';
import { useAccounts } from '@/hooks/account';
import { useSceneAccountInfo } from '@/hooks/accountsSwitcher';
import { usePerpsAccount } from '@/hooks/perps/usePerpsAccount';

const getOriginKey = (url?: string) => {
  if (!url) {
    return undefined;
  }
  const origin = safeGetOrigin(url) || safeGetOrigin(`https://${url}`) || url;
  return origin ? origin.toLowerCase() : undefined;
};

const buildOriginNetWorthMap = (
  items: Array<{
    site_url?: string;
    netWorth?: number | string | null;
  }>,
) => {
  const map = new Map<string, number>();

  items.forEach(item => {
    const originKey = getOriginKey(item.site_url);
    if (!originKey) {
      return;
    }

    const netWorth = Number(item.netWorth || 0);
    if (Number.isNaN(netWorth)) {
      return;
    }

    map.set(originKey, (map.get(originKey) || 0) + netWorth);
  });

  return map;
};

type Params = {
  dAppList: DappSelectItem[];
};

export const useDappListWithValue = ({ dAppList }: Params) => {
  const protocolMap = useProtocolListStore(
    useShallow(state => state.protocolMap),
  );

  const { dapps } = useDapps();
  const { accounts } = useAccounts({
    disableAutoFetch: true,
  });
  const { finalSceneCurrentAccount: aaveLendingAccount } = useSceneAccountInfo({
    forScene: 'Lending',
  });
  const trackedAddresses = useMemo(() => {
    const nextAddresses = new Set(
      accounts.map(account => account.address.toLowerCase()),
    );

    if (aaveLendingAccount?.address) {
      nextAddresses.add(aaveLendingAccount.address.toLowerCase());
    }

    return Array.from(nextAddresses);
  }, [accounts, aaveLendingAccount?.address]);
  const appChainsByAddress =
    appChainResourceStore.useAddressesAppChains(trackedAddresses);

  const defiValueByAddress = useMemo(() => {
    return trackedAddresses.reduce((acc, address) => {
      acc[address] = buildOriginNetWorthMap(protocolMap[address] || []);
      return acc;
    }, {} as Record<string, Map<string, number>>);
  }, [protocolMap, trackedAddresses]);
  const appChainValueByAddress = useMemo(() => {
    return trackedAddresses.reduce((acc, address) => {
      acc[address] = buildOriginNetWorthMap(appChainsByAddress[address] || []);
      return acc;
    }, {} as Record<string, Map<string, number>>);
  }, [appChainsByAddress, trackedAddresses]);

  const { accountValue: hyperliquidAccountValue } = usePerpsAccount();

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
      const addressKey = dappAccount.address.toLowerCase();
      const defiValue = originKey
        ? defiValueByAddress[addressKey]?.get(originKey)
        : undefined;
      const appChainValue = originKey
        ? appChainValueByAddress[addressKey]?.get(originKey)
        : undefined;
      const hasValue = originKey
        ? typeof defiValue === 'number' || typeof appChainValue === 'number'
        : false;

      if (!originKey || !hasValue) {
        return {
          ...item,
          value: undefined,
        };
      }
      const netWorth = defiValue || appChainValue || 0;

      return {
        ...item,
        value: formatNetworth(netWorth),
      };
    });
  }, [
    dAppList,
    dapps,
    accounts,
    defiValueByAddress,
    appChainValueByAddress,
    hyperliquidAccountValue,
    aaveLendingAccount,
  ]);

  return dappListWithValue;
};
