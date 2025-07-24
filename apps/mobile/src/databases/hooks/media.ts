import { useCallback, useEffect, useMemo } from 'react';
import { atom, useAtom } from 'jotai';
import blockies from 'ethereum-blockies-base64';

import { MediaEntity } from '../entities/media';

import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import WatchPNG from '@/assets2024/icons/wallet/watch.png';
import WatchDarkDark from '@/assets2024/icons/wallet/watch_dark.png';
import SafePNG from '@/assets2024/icons/wallet/safe.png';
import { Account } from '@/core/services/preference';

// type Acct = Pick<Account, 'address' | 'brandName' | 'type'>;
type Acct = {
  address: Account['address'];
  brandName?: Account['brandName'];
  type?: Account['type'] | string;
};
const avatarsInDbAtom = atom<Record<string, string | null>>({});
export function useAddressAvatarsInDatabase(options?: {
  // isLight?: boolean;
  autoFetch?: boolean;
  pruneAccounts?: boolean;
}) {
  const {
    // isLight = true,
    autoFetch = false,
    pruneAccounts = false,
  } = options || {};

  const [, setBlockiesAvatarsInDb] = useAtom(avatarsInDbAtom);

  const queryOrMakeAddressesAvatars = useCallback(
    async (accounts: Acct[]) => {
      const accountsNeedBlockies = accounts.filter(account => {
        return (
          account.brandName !== KEYRING_CLASS.GNOSIS &&
          account.brandName !== KEYRING_CLASS.WATCH
        );
      });
      console.log('[feat] accountsNeedBlockies', accountsNeedBlockies);
      const itemsByAddr = await MediaEntity.getAvatarsByAddresses(
        accountsNeedBlockies.map(account => account.address),
      ).then(items => {
        console.log('[feat] items.length', items.length);

        return items.reduce((accu, item) => {
          accu[item.key] = item;
          return accu;
        }, {} as Record<string, MediaEntity>);
      });
      console.log('[feat] itemsByAddr', itemsByAddr);

      const result = accountsNeedBlockies.reduce((accu, account) => {
        const addr = account.address;
        const itm = itemsByAddr[addr];
        if (itm?.data) {
          console.log('[feat] addr, itm.data', addr, itm.data.slice(0, 20));
          accu[addr] = itm.data;
        } else {
          accu[addr] = blockies(addr);
          MediaEntity.addAddressAvatar(addr, accu[addr]);
        }
        return accu;
      }, {} as Record<string, string | null>);
      console.log('[feat] Object.keys(result)', Object.keys(result));

      setBlockiesAvatarsInDb(prev => ({ ...prev, ...result }));

      return result;
    },
    [setBlockiesAvatarsInDb],
  );

  return {
    queryOrMakeAddressesAvatars,
  };
}

export function useGetAvatarByAccount() {
  const [blockiesAvatarsInDb] = useAtom(avatarsInDbAtom);

  const getAvatarsByAccount = useCallback(
    (account: Partial<Acct>, isLight: boolean) => {
      if (account.brandName === KEYRING_CLASS.GNOSIS) {
        return SafePNG;
      }
      if (account.brandName === KEYRING_CLASS.WATCH) {
        return isLight ? WatchPNG : WatchDarkDark;
      }

      if (!account.address) return undefined;

      return {
        uri: blockiesAvatarsInDb[account.address] || blockies(account.address),
      };
    },
    [blockiesAvatarsInDb],
  );

  return { getAvatarsByAccount };
}
