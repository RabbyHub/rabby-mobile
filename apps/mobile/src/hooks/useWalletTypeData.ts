import { apiKeyring } from '@/core/apis';
import { keyringService } from '@/core/services';
import { useAccounts, usePinAddresses } from '@/hooks/account';
import {
  IDisplayedAccountWithBalance,
  useAccountsToDisplay,
} from '@/hooks/accountToDisplay';
import { sortAccountsByBalance } from '@/utils/account';
import i18n from '@/utils/i18n';
import { WALLET_INFO } from '@/utils/walletInfo';
import {
  KEYRING_CLASS,
  KEYRING_TYPE,
  WALLET_NAME,
} from '@rabby-wallet/keyring-utils';
import { groupBy, omit } from 'lodash';
import { useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import useAsync from 'react-use/lib/useAsync';
import { nanoid } from 'nanoid';
import React from 'react';

export type DisplayedAccount = IDisplayedAccountWithBalance & {
  hdPathBasePublicKey?: string;
  hdPathType?: string;
};

export type TypeKeyringGroup = {
  name: string;
  index?: number;
  list: DisplayedAccount[];
  type: string;
  brandName?: string;
  publicKey?: string;
  hdPathBasePublicKey?: string;
  hdPathType?: string;
};

export const WALLET_SORT_SCORE = [
  WALLET_NAME.MetaMask,
  WALLET_NAME.TRUSTWALLET,
  WALLET_NAME.TP,
  WALLET_NAME.imToken,
  WALLET_NAME.MathWallet,
  WALLET_NAME.Rainbow,
  WALLET_NAME.Bitget,
  WALLET_NAME.Zerion,
  WALLET_NAME.UnknownWallet,
  KEYRING_CLASS.HARDWARE.LEDGER,
  KEYRING_CLASS.HARDWARE.ONEKEY,
  KEYRING_CLASS.HARDWARE.KEYSTONE,
].reduce((pre, now, i) => {
  pre[now] = i + 1;
  return pre;
}, {} as { [k: string]: number });

const getSortNum = (s: string) => WALLET_SORT_SCORE[s] || 999999;

const brandWallet = Object.values(WALLET_INFO)
  .filter(Boolean)
  .sort((a, b) => getSortNum(a.brand) - getSortNum(b.brand));

const wallets = groupBy(brandWallet, 'category');

const sortMapping = {
  // [WALLET_BRAND_CATEGORY.HARDWARE]: 10 ** 2,
  // [WALLET_BRAND_CATEGORY.MOBILE]: 10 ** 4,
  // [WALLET_BRAND_CATEGORY.INSTITUTIONAL]: 10 ** 6,
};

const DEFAULT_SCORE = 10 ** 8;

const sortScore = [
  // ...wallets[WALLET_BRAND_CATEGORY.HARDWARE],
  // ...wallets[WALLET_BRAND_CATEGORY.INSTITUTIONAL],
  // ...wallets[WALLET_BRAND_CATEGORY.MOBILE],
].reduce(
  (pre, cur, index) => {
    // pre[cur.brand] = sortMapping[cur.category] + index;
    return pre;
  },
  {
    [KEYRING_CLASS.MNEMONIC]: 1,
    [KEYRING_CLASS.PRIVATE_KEY]: 2,
    [KEYRING_CLASS.HARDWARE.LEDGER]: 3,
    // [KEYRING_CLASS.HARDWARE.TREZOR]: 4,
    // [KEYRING_CLASS.HARDWARE.GRIDPLUS]: 5,
    [KEYRING_CLASS.HARDWARE.ONEKEY]: 6,
    [KEYRING_CLASS.HARDWARE.KEYSTONE]: 7,
    // [KEYRING_CLASS.HARDWARE.BITBOX02]: 8,
  },
);

export const getWalletTypeName = (s: string) => {
  if (s === KEYRING_TYPE.SimpleKeyring) {
    return i18n.t('page.manageAddress.private-key');
  }
  if (s === KEYRING_TYPE.HdKeyring) {
    return i18n.t('page.manageAddress.seed-phrase');
  }

  if (WALLET_INFO[s]) {
    return WALLET_INFO[s].name;
  }

  return s;
};

export const getWalletScore = (
  s: TypeKeyringGroup[] | IDisplayedAccountWithBalance[],
) => {
  return sortScore[s?.[0]?.brandName || s?.[0]?.type] || DEFAULT_SCORE;
};

export const useWalletTypeData = () => {
  const { t } = useTranslation();
  const { accountsList, fetchAllAccountsToDisplay } = useAccountsToDisplay();
  const { pinAddresses: highlightedAddresses } = usePinAddresses({
    disableAutoFetch: true,
  });
  const sortedRef = useRef(false);
  const sortIdList = useRef<string[]>([]);

  React.useEffect(() => {
    fetchAllAccountsToDisplay();
  }, [fetchAllAccountsToDisplay]);

  const [sortedAccountsList, watchSortedAccountsList] = useMemo(() => {
    const restAccounts = [...accountsList];
    let highlightedAccounts: typeof accountsList = [];
    let watchModeHighlightedAccounts: typeof accountsList = [];

    highlightedAddresses.forEach(highlighted => {
      const idx = restAccounts.findIndex(
        account =>
          account.address === highlighted.address &&
          account.brandName === highlighted.brandName,
      );
      if (idx > -1) {
        if (restAccounts[idx].type === KEYRING_CLASS.WATCH) {
          watchModeHighlightedAccounts.push(restAccounts[idx]);
        } else {
          highlightedAccounts.push(restAccounts[idx]);
        }
        restAccounts.splice(idx, 1);
      }
    });
    const data = groupBy(restAccounts, e =>
      e.type === KEYRING_CLASS.WATCH ? '1' : '0',
    );

    highlightedAccounts = sortAccountsByBalance(highlightedAccounts);
    watchModeHighlightedAccounts = sortAccountsByBalance(
      watchModeHighlightedAccounts,
    );

    return [
      highlightedAccounts.concat(data['0'] || []).filter(e => !!e),
      watchModeHighlightedAccounts.concat(data['1'] || []).filter(e => !!e),
    ];
  }, [accountsList, highlightedAddresses]);

  const { value, loading, error } = useAsync(async () => {
    const walletGroup = groupBy(sortedAccountsList, a => a.brandName);

    const hdKeyringGroup = groupBy(
      walletGroup[KEYRING_TYPE.HdKeyring],
      a => a.publicKey,
    );

    const notEmptyHdKeyringList = Object.values(hdKeyringGroup).map(item =>
      getTypeGroup(item),
    ) as TypeKeyringGroup[];

    const allClassAccounts = await keyringService.getAllTypedAccounts();

    const emptyHdKeyringList: TypeKeyringGroup[] = [];
    allClassAccounts
      ?.filter(
        item =>
          item.accounts.length === 0 && item.type === KEYRING_TYPE.HdKeyring,
      )
      .forEach(item => {
        emptyHdKeyringList.push({
          list: [] as DisplayedAccount[],
          name: getWalletTypeName(item.keyring.type),
          type: item.type,
          brandName: item.type,
          publicKey: item.publicKey,
        });
      });

    const hdKeyRingList = [
      ...notEmptyHdKeyringList,
      ...emptyHdKeyringList,
    ].sort((a, b) => b.list.length - a.list.length);

    const ledgerAccounts = await Promise.all(
      (walletGroup[KEYRING_CLASS.HARDWARE.LEDGER] || []).map(async e => {
        try {
          const res = await apiKeyring.requestKeyring(
            KEYRING_CLASS.HARDWARE.LEDGER,
            'getAccountInfo',
            null,
            e.address,
          );
          return {
            ...e,
            hdPathBasePublicKey: res.hdPathBasePublicKey,
            hdPathType: res.hdPathType,
          };
          // eslint-disable-next-line no-catch-shadow
        } catch (error) {
          return { ...e, hdPathBasePublicKey: nanoid() };
        }
      }),
    );

    const ledgersGroup = groupBy(ledgerAccounts, a => a.hdPathBasePublicKey);

    const ledgerList = Object.values(ledgersGroup)
      .sort((a, b) => b.length - a.length)
      .map(item => getTypeGroup(item)) as TypeKeyringGroup[];

    const v = (
      Object.values({
        ...omit(walletGroup, [
          KEYRING_TYPE.WatchAddressKeyring,
          KEYRING_TYPE.HdKeyring,
          KEYRING_CLASS.HARDWARE.LEDGER,
        ]),
      }) as DisplayedAccount[][]
    ).map(item => [getTypeGroup(item)]);

    v.push(hdKeyRingList, ledgerList);

    v.sort((a, b) => getWalletScore(a) - getWalletScore(b));

    if (watchSortedAccountsList.length) {
      v.push([
        {
          name: t('page.manageAddress.watch-address'),
          list: watchSortedAccountsList,
          type: KEYRING_TYPE.WatchAddressKeyring,
        },
      ]);
    }

    const list = v.flat();

    if (list.length && sortedRef.current === false) {
      sortedRef.current = true;
      sortIdList.current = list.map(
        e => e.type + e.brandName + e.hdPathBasePublicKey + e.publicKey,
      );
    }

    const result = list.reduce((pre, cur) => {
      pre[cur.type + cur.brandName + cur.hdPathBasePublicKey + cur.publicKey] =
        cur;
      return pre;
    }, {} as Record<string, (typeof list)[number]>);

    sortIdList.current = sortIdList.current.filter(e => !!result[e]);
    return [result, sortIdList.current] as const;
  }, [sortedAccountsList, watchSortedAccountsList]);

  if (error) {
    console.error('manage address', error);
  }

  return {
    accountGroup: value,
    loading: loading,
    highlightedAddresses,
  };
};

export const getTypeGroup = (arr: DisplayedAccount[]) => {
  return {
    name: getWalletTypeName(arr?.[0]?.brandName || arr?.[0].type),
    list: arr,
    type: arr?.[0].type,
    brandName: arr?.[0]?.brandName,
    publicKey: arr?.[0]?.publicKey,
    hdPathBasePublicKey: arr?.[0]?.hdPathBasePublicKey,
    hdPathType: arr?.[0]?.hdPathType,
  } as TypeKeyringGroup;
};
