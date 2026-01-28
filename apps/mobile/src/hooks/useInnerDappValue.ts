import useProtocolListStore from '@/store/protocols';
import { useAccounts } from './account';
import { useInnerDappSelection } from './useInnerDappSelection';
import { useShallow } from 'zustand/shallow';
import { getDappAccount, useDapps } from './useDapps';
import { INNER_DAPP_LIST } from '@/components2024/DappFrameAccountHeader';
import { useMemo } from 'react';
import { safeGetOrigin } from '@rabby-wallet/base-utils/dist/isomorphic/url';

export const useCurrentInnerDappTypeValue = (
  type: keyof typeof INNER_DAPP_LIST,
) => {
  const { lending, perps } = useInnerDappSelection();

  const dappId =
    type === 'PREDICTION' ? 'polymarket' : type === 'LENDING' ? lending : perps;

  const { accounts } = useAccounts({
    disableAutoFetch: true,
  });

  const protocolMap = useProtocolListStore(
    useShallow(state => state.protocolMap),
  );

  const { dapps } = useDapps();

  const targetItem = useMemo(
    () => INNER_DAPP_LIST[type].find(e => e.id === dappId),
    [dappId, type],
  );

  const dappOrigin = useMemo(() => {
    if (!targetItem?.url) {
      return undefined;
    }
    return safeGetOrigin(targetItem.url) || targetItem.url;
  }, [targetItem?.url]);

  const dappInfo = useMemo(() => {
    return dappOrigin ? dapps[dappOrigin] : undefined;
  }, [dapps, dappOrigin]);

  const account = useMemo(() => {
    return getDappAccount({ dappInfo, accounts });
  }, [accounts, dappInfo]);

  const value = useMemo(() => {
    let v: undefined | number;
    const address = account?.address?.toLowerCase();

    if (!targetItem || !dappInfo || !account || !address) {
      return v;
    }
    const protocols = protocolMap[address] || [];

    protocols.forEach(protocol => {
      const origin = safeGetOrigin(protocol.site_url || '');
      const targetOrigin = safeGetOrigin(targetItem.url || '');
      if (origin !== targetOrigin) {
        return;
      }
      if (typeof v !== 'number') {
        v = 0;
      }
      const netWorth = Number(protocol.netWorth || 0);
      v += netWorth;
    });
    return v;
  }, [account, targetItem, dappInfo, protocolMap]);

  return { value };
};
