import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import { useAccounts } from './account';
import { useWhitelist } from './whitelist';
import { useEffect, useMemo } from 'react';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { atom, useAtom } from 'jotai';
import { openapi } from '@/core/request';
import PQueue from 'p-queue';
import { AddrDescResponse } from '@rabby-wallet/rabby-api/dist/types';

const queue = new PQueue({ intervalCap: 10, concurrency: 7, interval: 1000 });

export const addrDescInfoAtoms = atom<{
  [address: string]: AddrDescResponse['desc'] | undefined;
}>({});

export const useAddrDescAccounts = () => {
  const { accounts } = useAccounts();
  const { whitelist } = useWhitelist();
  const [addrDescInfo, setAddrDescInfo] = useAtom(addrDescInfoAtoms);

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
    if (queue.size > 0) {
      return;
    }
    pendFechCexAddresses.forEach(address => {
      if (addrDescInfo[address]) {
        return;
      }
      queue.add(async () => {
        try {
          if (addrDescInfo[address]) {
            return;
          }
          const res = await openapi.addrDesc(address);
          if (res.desc.cex) {
            setAddrDescInfo(prev => ({ ...prev, [address]: res.desc }));
          }
        } catch (error) {
          console.error('cex desc fetch error', error);
        }
      });
    });
  }, [addrDescInfo, pendFechCexAddresses, setAddrDescInfo]);
};
