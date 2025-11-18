import { useCallback, useMemo, useRef, useState } from 'react';
import { atom, SetStateAction, useAtom } from 'jotai';
import * as Sentry from '@sentry/react-native';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';

import { TokenItemEntity } from '@/databases/entities/tokenitem';
import { useSceneAccountInfo } from '@/hooks/accountsSwitcher';
import { rjStore } from '@/hooks/globalstore/_setup';
import { addressUtils } from '@rabby-wallet/base-utils';
import { useAccountInfo } from '@/screens/Address/components/MultiAssets/hooks';
import { useMyAccounts } from '@/hooks/account';
import { preferenceService } from '@/core/services';
import { wrapAbortableFn } from '@/databases/sync/utils';
import { syncTokens } from '@/databases/hooks/assets';
import { stableSortByAddress } from '@/utils/account';
import { groupBy } from 'lodash';
import { TokenSelectType } from '../TokenSelectorSheetModal';

function makeReqLabel(labelOrList: string | string[]) {
  return Array.isArray(labelOrList) ? labelOrList.join('-') : labelOrList;
}

const isSameAddress = addressUtils.isSameAddress;

export type LocalDBTokenItem = TokenItem & {
  _db_id?: TokenItemEntity['_db_id'];
  owner_addr: TokenItemEntity['owner_addr'];
};

const IN_MEMORY_TOKENS_LIMIT = 200;
const addressIndexedTokensAtom = atom<{
  [address: string]: LocalDBTokenItem[];
}>({});
export function updateAddressIndexedTokens(
  arg: SetStateAction<{ [address: string]: LocalDBTokenItem[] }>,
) {
  rjStore.set(addressIndexedTokensAtom, prev => {
    const nextVal = arg instanceof Function ? arg(prev) : arg;

    // Object.entries(nextVal).forEach(([addr, tokens]) => {
    //   if (tokens.length >= IN_MEMORY_TOKENS_LIMIT) {
    //     nextVal[addr] = tokens.slice(0, IN_MEMORY_TOKENS_LIMIT);
    //   }
    // });
    return nextVal;
  });
}
export function getAddressIndexedTokens() {
  return rjStore.get(addressIndexedTokensAtom);
}
function addressHasTokens(address: string) {
  const tokensMap = getAddressIndexedTokens();
  const tokens = tokensMap[address.toLowerCase()] || [];
  return tokens.length > 0;
}

const userTokenSettingsAtom = atom<
  ReturnType<typeof preferenceService.getUserTokenSettingsSync>
>(preferenceService.getUserTokenSettingsSync());

const loadingAtom = atom<{ [label: string]: boolean }>({});
// function setLoadingByLabel(label: string, loading: boolean) {
//   rjStore.set(loadingAtom, pre => {
//     return {
//       ...pre,
//       [label]: loading,
//     };
//   });
// }
// function isLoadingByLabel(label: string) {
//   const loadingMap = rjStore.get(loadingAtom);
//   return !!loadingMap[label];
// }

function resolveTokensMap(currentAddress?: string) {
  const ret: {
    resTokens: LocalDBTokenItem[];
    existedTokens: boolean;
  } = {
    resTokens: [],
    existedTokens: false,
  };
  const tokensMap = getAddressIndexedTokens();
  if (currentAddress) {
    ret.resTokens = tokensMap[currentAddress?.toLowerCase()] || [];
  } else {
    ret.resTokens = Object.values(tokensMap).flat();
  }

  ret.existedTokens = ret.resTokens.length > 0;

  return ret;
}

export function useCurrentAccountTokens() {
  const { sceneCurrentAccount } = useSceneAccountInfo({
    forScene: 'MakeTransactionAbout',
  });
  const addressIndexedTokens = getAddressIndexedTokens();

  const tokens = useMemo(() => {
    if (!sceneCurrentAccount?.address) return [];
    const address = sceneCurrentAccount.address.toLowerCase();
    return addressIndexedTokens[address] || [];
  }, [addressIndexedTokens, sceneCurrentAccount?.address]);

  return { tokens, accountToSelectToken: sceneCurrentAccount };
}

export const useSelectTokensThreadSafe = () => {
  const { top10Addresses, fetchAccounts } = useAccountInfo();

  const updateTokens = useCallback(
    ({
      address,
      newTokens,
    }: {
      address: string;
      newTokens: LocalDBTokenItem[];
    }) => {
      const lowerAddress = address.toLowerCase();
      updateAddressIndexedTokens(pre => {
        return {
          ...pre,
          [lowerAddress]: newTokens,
        };
      });
      // addressHasTokensRef.current[lowerAddress] = !!newTokens.length;
    },
    [],
  );

  const [userTokenSettings, setUserTokenSettings] = useAtom(
    userTokenSettingsAtom,
  );
  const loadUserTokenSettings = useCallback(() => {
    setUserTokenSettings(prev => {
      if (Object.keys(prev).length > 0) return prev;

      return preferenceService.getUserTokenSettingsSync();
    });
  }, [setUserTokenSettings]);

  const [loadingsByLabel, setLoadingByLabel] = useAtom(loadingAtom);

  // const [isLoadingToken, setIsLoadingToken] = useState(false);
  const isLoadingToken = !!loadingsByLabel['@loadToken'];
  const setIsLoadingToken = useCallback(
    (loading: boolean) => {
      setLoadingByLabel(prev => ({
        ...prev,
        ['@loadToken']: loading,
      }));
    },
    [setLoadingByLabel],
  );
  const loadToken = useCallback(
    async (_address: string, force?: boolean) => {
      const address = _address.toLowerCase();
      if (!address) return;

      try {
        const tokensExisted = addressHasTokens(address);
        if (!tokensExisted) setIsLoadingToken(true);
        await wrapAbortableFn({
          label: [
            `loadToken`,
            `${address}`,
            `${force ? 'force' : 'normal'}`,
            tokensExisted ? 'onlysync' : 'syncandupdate',
          ],
          fn: async signal => {
            // if token exist and not expired, don't sync to store
            const tokenRes = await syncTokens(address, force, tokensExisted);
            if (!tokenRes.length) return;

            updateTokens({
              address,
              newTokens: tokenRes || [],
            });
          },
        }).run();
      } catch (error) {
        console.error('loadToken error', error);
        Sentry.captureException(error);
      } finally {
        setIsLoadingToken(false);
      }
    },
    [updateTokens, setIsLoadingToken],
  );

  // const [isLoadingCacheToken, setIsLoadingCacheToken] = useState(false);
  const isLoadingCacheToken = !!loadingsByLabel['@batchLoadCacheTokens'];
  const setIsLoadingCacheToken = useCallback(
    (loading: boolean) => {
      setLoadingByLabel(prev => ({
        ...prev,
        ['@batchLoadCacheTokens']: loading,
      }));
    },
    [setLoadingByLabel],
  );
  const loadCacheTokenCRef = useRef<AbortController | null>(null);
  const batchLoadCacheTokens = useCallback(
    async (_addresses: string[]) => {
      if (!_addresses.length) return;

      const addresses = _addresses.map(i => i.toLowerCase());
      setIsLoadingCacheToken(true);
      try {
        loadCacheTokenCRef.current?.abort();
        loadCacheTokenCRef.current = new AbortController();
        await wrapAbortableFn({
          label: ['batchLoadCacheTokens', ...stableSortByAddress(addresses)],
          externalControllerRef: loadCacheTokenCRef,
          fn: async signal => {
            const cachedTokens = await TokenItemEntity.batchMultiAddressTokens(
              addresses,
            );
            if (signal.aborted) return;

            const assestGroup = groupBy(cachedTokens, 'owner_addr');
            if (signal.aborted) return;
            updateAddressIndexedTokens(_pre => {
              const curr = { ...(_pre || {}) };
              Object.keys(assestGroup).forEach(address => {
                curr[address] = assestGroup[address];
              });
              return curr;
            });
          },
          onFinally: () => (loadCacheTokenCRef.current = null),
        }).run();
      } catch (error) {
        console.error('batchLoadCacheTokens:: error', error);
      } finally {
        setIsLoadingCacheToken(false);
      }
    },
    [setIsLoadingCacheToken],
  );

  // const [isCheckingExpire, setIsCheckingExpire] = useState(false);
  const isCheckingExpire = !!loadingsByLabel['@checkIsExpireAndUpdate'];
  const setIsCheckingExpire = useCallback(
    (loading: boolean) => {
      setLoadingByLabel(prev => ({
        ...prev,
        ['@checkIsExpireAndUpdate']: loading,
      }));
    },
    [setLoadingByLabel],
  );
  const checkingExpireCRef = useRef<AbortController | null>(null);
  const checkIsExpireAndUpdate = useCallback(
    async (force?: boolean) => {
      try {
        setIsCheckingExpire(true);
        checkingExpireCRef.current?.abort();
        checkingExpireCRef.current = new AbortController();

        await wrapAbortableFn({
          label: ['checkIsExpireAndUpdate', force ? 'force' : 'normal'],
          externalControllerRef: checkingExpireCRef,
          fn: async signal => {
            for (const address of top10Addresses) {
              if (signal.aborted) return;
              try {
                await loadToken(address, force);
              } catch (error) {
                console.error(
                  `Error fetching data for ${address.slice(-4)}:`,
                  error,
                );
              }
            }
            await new Promise(resolve => setTimeout(resolve, 0));
          },
          onFinally: () => (checkingExpireCRef.current = null),
        }).run();
      } catch (error) {
        console.error('checkIsExpireAndUpdate error', error);
      } finally {
        setIsCheckingExpire(false);
        // setIsFirstFetch(false);
      }
    },
    [loadToken, top10Addresses, setIsCheckingExpire],
  );

  const getCacheTokens = useCallback(
    async (addresses: string[], options?: { isTop10?: boolean }) => {
      if (options?.isTop10) {
        const emptyTokenAddresses = top10Addresses.filter(
          addr => !addressHasTokens(addr),
        );
        await batchLoadCacheTokens(emptyTokenAddresses);
      }
      await batchLoadCacheTokens(addresses);
    },
    [top10Addresses, batchLoadCacheTokens],
  );

  const isLoading = isLoadingToken || isCheckingExpire || isLoadingCacheToken;

  const fetchTokens = useCallback(
    async (options?: {
      currentAddress?: string;
      sceneType?: TokenSelectType;
    }) => {
      const { currentAddress, sceneType } = options || {};
      const { existedTokens } = resolveTokensMap(currentAddress);

      if (!existedTokens) {
        if (sceneType === 'send' && currentAddress) {
          currentAddress && (await getCacheTokens([currentAddress]));
        } else {
          await getCacheTokens([], { isTop10: true });
        }
      }

      if (currentAddress) {
        loadToken(currentAddress, true);
      } else {
        checkIsExpireAndUpdate();
      }
    },
    [getCacheTokens, loadToken, checkIsExpireAndUpdate],
  );

  const fetchAccountsAndTokenSettings = useCallback(async () => {
    fetchAccounts();
    loadUserTokenSettings();
  }, [fetchAccounts, loadUserTokenSettings]);

  return {
    userTokenSettings,
    isLoadingToken: isLoading || isCheckingExpire || isLoadingCacheToken,

    fetchTokens,
    getCacheTokens,
    checkIsExpireAndUpdate,
    loadToken,
    fetchAccountsAndTokenSettings,
  };
};
