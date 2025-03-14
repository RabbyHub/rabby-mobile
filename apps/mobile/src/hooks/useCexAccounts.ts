import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import { useAccounts } from './account';
import { useWhitelist } from './whitelist';
import { useEffect, useMemo } from 'react';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { atom, useAtom } from 'jotai';
import { openapi } from '@/core/request';
import PQueue from 'p-queue';
import { Cex } from '@rabby-wallet/rabby-api/dist/types';

const queue = new PQueue({ intervalCap: 10, concurrency: 10, interval: 1000 });

export const cexInfoAtoms = atom<{
  [address: string]: Cex | undefined;
}>({});

export const useCexAccounts = () => {
  const { accounts } = useAccounts();
  const { whitelist } = useWhitelist();
  const [cexInfo, setCexInfo] = useAtom(cexInfoAtoms);

  const pendFechCexAddresses = useMemo(() => {
    const watchAccounts = accounts.filter(
      account => account.type === KEYRING_CLASS.WATCH,
    );
    const otherAccounts = accounts.filter(
      account => account.type !== KEYRING_CLASS.WATCH,
    );
    const pendingWhitelistAddresses = whitelist.filter(
      item => !otherAccounts.some(acc => isSameAddress(acc.address, item)),
    );
    const pendingWatchAddresses = watchAccounts
      .filter(
        item =>
          !pendingWhitelistAddresses.some(acc =>
            isSameAddress(acc, item.address),
          ),
      )
      .map(item => item.address);
    return [...pendingWatchAddresses, ...pendingWhitelistAddresses];
  }, [accounts, whitelist]);

  useEffect(() => {
    pendFechCexAddresses.forEach(address => {
      if (cexInfo[address]) {
        return;
      }
      queue.add(async () => {
        try {
          const res = await openapi.addrDesc(address);
          if (res.desc.cex) {
            setCexInfo(prev => ({ ...prev, [address]: res.desc.cex }));
          }
        } catch (error) {
          console.error('has_transfer fetch error', error);
        }
      });
    });
  }, [cexInfo, pendFechCexAddresses, setCexInfo]);
};
