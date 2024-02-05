import { contactService } from '@/core/services';
import { useCallback, useEffect, useState } from 'react';
import { useAccounts } from './account';
import { apiContact } from '@/core/apis';

export const useAlias = (address: string) => {
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
      setName(alias);
      contactService.updateAlias({ address, name: alias });
      fetchAccounts();
    },
    [address, fetchAccounts],
  );

  return [name, updateAlias] as const;
};

export function useAlias2(address: string, options?: { autoFetch?: boolean }) {
  const { autoFetch = false } = options || {};
  const [name, setName] = useState<string>('');

  const fetchAlias = useCallback(() => {
    if (!address) return;

    const alias = apiContact.getAliasName(address) || '';
    setName(alias);

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
      fetchAlias();
    },
    [address, fetchAlias],
  );

  return {
    adderssAlias: name,
    updateAlias,
    fetchAlias,
  };
}
