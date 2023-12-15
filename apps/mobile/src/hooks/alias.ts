import { contactService } from '@/core/services';
import { useCallback, useEffect, useState } from 'react';
import { useAccounts } from './account';

export const useAlias = (address: string) => {
  const [name, setName] = useState<string>();

  const { fetchAccounts } = useAccounts({ disableAutoFetch: true });
  useEffect(() => {
    if (address) {
      setName(contactService.getAliasByAddress(address)?.alias || '');
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
