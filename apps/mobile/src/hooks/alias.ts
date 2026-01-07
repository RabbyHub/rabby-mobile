import { contactService } from '@/core/services';
import { useCallback, useEffect, useState } from 'react';
import { useAccounts } from './account';
import { apiContact } from '@/core/apis';
import { zCreate, zMutative } from '@/core/utils/reexports';
import { perfEvents } from '@/core/utils/perf';
import { AddressAliasItem } from '@rabby-wallet/service-address';
import { useShallow } from 'zustand/react/shallow';
import { addressUtils } from '@rabby-wallet/base-utils';

export const useAlias = (address?: string) => {
  const [name, setName] = useState<string>('');

  const { fetchAccounts } = useAccounts({ disableAutoFetch: true });
  useEffect(() => {
    if (address) {
      setName(contactService.getAliasByAddress(address)?.alias || '');
    } else {
      setName('');
    }
  }, [address]);

  const updateAlias = useCallback(
    (alias: string) => {
      if (!address) {
        return;
      }
      setName(alias);
      contactService.updateAlias({ address, name: alias });
      fetchAccounts();
    },
    [address, fetchAccounts],
  );

  return [name, updateAlias] as const;
};

const addressAliasStore = zCreate(
  zMutative<{
    aliasesMap: Record<string, AddressAliasItem>;
  }>(
    () => ({
      aliasesMap: {},
    }),
    {
      strict: __DEV__,
    },
  ),
);
perfEvents.on('CONTACTS_ALIASES_UPDATE', ({ nextState }) => {
  addressAliasStore.setState(state => {
    Object.entries(nextState || {}).forEach(([address, addresItem]) => {
      const lcAddr = address.toLowerCase();
      state.aliasesMap[lcAddr] = {
        ...addresItem,
        isDefaultAlias:
          addresItem.alias.toLowerCase() ===
          addressUtils.ellipsis(address, 6).toLowerCase(),
      };
    });
  });
});

function setName(address: string, aliasItem: AddressAliasItem) {
  const addr = address.toLowerCase();

  addressAliasStore.setState(prev => {
    const prevAlias = prev.aliasesMap[addr];
    if (prevAlias === aliasItem) return;

    if (aliasItem) {
      prev.aliasesMap[addr] = aliasItem;
    }
  });
}

export function useAlias2(
  address: string,
  options?: {
    /** @default false */
    autoFetch?: boolean;
    /**
     * @default false
     *
     * @description In most case we dont need it, perfEvents will handle it with high performance
     */
    FETCH_AFTER_UPDATE?: boolean;
  },
) {
  const { autoFetch = false, FETCH_AFTER_UPDATE = false } = options || {};
  const { adderssAlias, isDefaultAlias } = addressAliasStore(
    useShallow(s => {
      const lcAddr = address.toLowerCase();
      const item = s.aliasesMap[lcAddr];
      return {
        adderssAlias: !lcAddr ? '' : item?.alias || '',
        isDefaultAlias: !lcAddr
          ? true
          : item?.isDefaultAlias ??
            item?.alias.toLowerCase() ===
              addressUtils.ellipsis(address, 6).toLowerCase(),
      };
    }),
  );

  const fetchAlias = useCallback(() => {
    if (!address) return;

    const aliasItem = contactService.getAliasByAddress(address, {
      keepEmptyIfNotFound: false,
    });
    if (aliasItem) setName(address, aliasItem);

    return aliasItem?.address;
  }, [address]);

  useEffect(() => {
    if (autoFetch) {
      fetchAlias();
    }
  }, [autoFetch, fetchAlias]);

  const updateAlias = useCallback(
    (alias: string) => {
      contactService.updateAlias({ address, name: alias });
      if (FETCH_AFTER_UPDATE) {
        fetchAlias();
      }
    },
    [address, fetchAlias, FETCH_AFTER_UPDATE],
  );

  return {
    adderssAlias,
    isDefaultAlias,
    updateAlias,
    fetchAlias,
  };
}
