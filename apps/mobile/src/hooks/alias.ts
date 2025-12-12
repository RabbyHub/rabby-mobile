import { contactService } from '@/core/services';
import { useCallback, useEffect, useState } from 'react';
import { useAccounts } from './account';
import { apiContact } from '@/core/apis';
import { zCreate, zMutative } from '@/core/utils/reexports';
import { perfEvents } from '@/core/utils/perf';

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
    aliasesMap: Record<string, string>;
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
      state.aliasesMap[address.toLowerCase()] = addresItem.alias;
    });
  });
});

function setName(address: string, alias: string) {
  const addr = address.toLowerCase();

  addressAliasStore.setState(prev => {
    const prevAlias = prev.aliasesMap[addr];
    if (prevAlias === alias) return;

    if (alias) {
      prev.aliasesMap[addr] = alias;
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
  const adderssAlias = addressAliasStore(s =>
    !address ? '' : s.aliasesMap[address.toLowerCase()] || '',
  );

  const fetchAlias = useCallback(() => {
    if (!address) return;

    const alias = apiContact.getAliasName(address) || '';
    setName(address, alias);

    return alias;
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
    updateAlias,
    fetchAlias,
  };
}
