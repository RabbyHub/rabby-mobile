import { Account } from '@/core/services/preference';
import React, { useCallback } from 'react';
import { safeGetOrigin } from '@rabby-wallet/base-utils/dist/isomorphic/url';
import useAppChainStore from '@/store/appchain';
import { useShallow } from 'zustand/shallow';
import { formatNetworth } from '@/utils/math';
import { INNER_DAPP_LIST } from '../constants';
import { useAccounts } from '@/hooks/account';
import useProtocolListStore from '@/store/protocols';

export const useLendingAccountExtraInfo = (dapp: string) => {
  const { accounts } = useAccounts({ disableAutoFetch: true });

  const protocolMap = useProtocolListStore(
    useShallow(state => state.protocolMap),
  );

  const activeItem = React.useMemo(() => {
    return (
      INNER_DAPP_LIST.LENDING.find(item => item.id === dapp) ||
      INNER_DAPP_LIST.LENDING[0]!
    );
  }, [dapp]);

  const dappOrigin = React.useMemo(() => {
    return safeGetOrigin(activeItem.url!) || activeItem.url!;
  }, [activeItem?.url]);

  const appChainMap = useAppChainStore(useShallow(s => s.appChainMap));
  const accountNetWorthByAddress = React.useMemo(() => {
    const originKey =
      safeGetOrigin(dappOrigin) ||
      safeGetOrigin(`https://${dappOrigin}`) ||
      dappOrigin;
    if (!originKey) {
      return undefined;
    }
    const normalizedOrigin = originKey.toLowerCase();
    const map: Record<string, number> = {};

    accounts.forEach(accountItem => {
      const address = accountItem.address?.toLowerCase();
      if (!address) {
        return;
      }
      const protocols = protocolMap[address] || [];
      const appChains = appChainMap[address] || [];
      let netWorth = 0;
      let hasMatch = false;

      protocols.forEach(protocol => {
        const origin =
          safeGetOrigin(protocol.site_url || '') ||
          safeGetOrigin(`https://${protocol.site_url}`) ||
          protocol.site_url ||
          '';
        if (!origin || origin.toLowerCase() !== normalizedOrigin) {
          return;
        }
        hasMatch = true;
        const value = Number(protocol.netWorth || 0);
        if (!Number.isNaN(value)) {
          netWorth += value;
        }
      });

      appChains.forEach(appChain => {
        const origin =
          safeGetOrigin(appChain.site_url || '') ||
          safeGetOrigin(`https://${appChain.site_url}`) ||
          appChain.site_url ||
          '';
        if (!origin || origin.toLowerCase() !== normalizedOrigin) {
          return;
        }
        hasMatch = true;
        const value = Number(appChain.netWorth || 0);
        if (!Number.isNaN(value)) {
          netWorth += value;
        }
      });

      if (hasMatch) {
        map[address] = netWorth;
      }
    });

    return map;
  }, [accounts, appChainMap, dappOrigin, protocolMap]);

  const renderNetWorthRight = React.useMemo(() => {
    if (!accountNetWorthByAddress) {
      return undefined;
    }
    return ({ account: accountItem }: { account: Account }) => {
      const address = accountItem.address?.toLowerCase();
      if (!address) {
        return null;
      }
      const netWorth = accountNetWorthByAddress[address];
      if (netWorth === undefined || netWorth === null) {
        return null;
      }
      return formatNetworth(netWorth);
    };
  }, [accountNetWorthByAddress]);

  const sortLendingDappAccounts = useCallback(
    (accounts: Account[]) => {
      if (!accountNetWorthByAddress) {
        return accounts;
      }
      const list = [...accounts];
      list.sort((a, b) => {
        const aKey = a.address?.toLowerCase() || '';
        const bKey = b.address?.toLowerCase() || '';
        const aData = accountNetWorthByAddress[aKey] || 0;
        const bData = accountNetWorthByAddress[bKey] || 0;
        return bData - aData;
      });

      return list;
    },
    [accountNetWorthByAddress],
  );

  return {
    renderRight: renderNetWorthRight,
    sortAccounts: sortLendingDappAccounts,
  };
};
