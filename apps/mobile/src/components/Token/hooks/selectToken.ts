import { useCallback, useMemo, useRef, useState } from 'react';
import * as Sentry from '@sentry/react-native';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';

import { TokenItemEntity } from '@/databases/entities/tokenitem';
import { useSceneAccountInfo } from '@/hooks/accountsSwitcher';
import { addressUtils } from '@rabby-wallet/base-utils';
import { useAccountInfo } from '@/screens/Address/components/MultiAssets/hooks';
import { preferenceService } from '@/core/services';
import { wrapAbortableFn } from '@/databases/sync/utils';
import { syncTokens } from '@/databases/hooks/assets';
import { stableSortByAddress } from '@/utils/account';
import { groupBy } from 'lodash';
import { TokenSelectType } from '../TokenSelectorSheetModal';
import { zCreate } from '@/core/utils/reexports';
import { resolveValFromUpdater, UpdaterOrPartials } from '@/core/utils/store';
import { makeSWRKeyAsyncFunc } from '@/core/utils/concurrency';

function makeReqLabel(labelOrList: string | string[]) {
  return Array.isArray(labelOrList) ? labelOrList.join('-') : labelOrList;
}

const isSameAddress = addressUtils.isSameAddress;

export type LocalDBTokenItem = TokenItem & {
  _db_id?: TokenItemEntity['_db_id'];
  owner_addr: TokenItemEntity['owner_addr'];
};

const IN_MEMORY_TOKENS_LIMIT = 200;
const addressIndexedTokensState = zCreate<{
  [address: string]: LocalDBTokenItem[];
}>(() => ({}));
export function updateAddressIndexedTokens(
  valOrFunc: UpdaterOrPartials<{ [address: string]: LocalDBTokenItem[] }>,
) {
  addressIndexedTokensState.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev, valOrFunc, {
      strict: false,
    });

    return newVal;
  });
}
export function getAddressIndexedTokens() {
  return addressIndexedTokensState.getState();
}
export function useInMemoryTokens(targetAddress?: string) {
  const tokensMap = addressIndexedTokensState(s => s);
  const tokens = useMemo(() => {
    if (!targetAddress) {
      return Object.values(tokensMap).flat();
    }
    return tokensMap[targetAddress.toLowerCase()] || [];
  }, [tokensMap, targetAddress]);

  return tokens;
}
function addressHasTokens(address: string) {
  const tokensMap = getAddressIndexedTokens();
  const tokens = tokensMap[address.toLowerCase()] || [];
  return tokens.length > 0;
}

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

const loadingsByLabelState = zCreate(() => ({
  '@loadToken': false,
  '@batchLoadCacheTokens': false,
  '@checkIsExpireAndUpdate': false,
}));
type LoadingsByLabelState = ReturnType<typeof loadingsByLabelState.getState>;
export function setLoadingByLabel(
  label: keyof LoadingsByLabelState,
  loading: boolean,
) {
  loadingsByLabelState.setState(prev => ({
    ...prev,
    [label]: loading,
  }));
}

const batchLoadCacheTokens = makeSWRKeyAsyncFunc(
  async (addresses: string[]) => {
    setLoadingByLabel('@batchLoadCacheTokens', true);
    try {
      const cachedTokens = await TokenItemEntity.batchMultiAddressTokens(
        addresses,
      );

      const assestGroup = groupBy(cachedTokens, 'owner_addr');
      updateAddressIndexedTokens(_pre => {
        const curr = { ...(_pre || {}) };
        Object.keys(assestGroup).forEach(address => {
          curr[address] = assestGroup[address];
        });
        return curr;
      });
    } catch (error) {
      console.error('batchLoadCacheTokens:: error', error);
    } finally {
      setLoadingByLabel('@batchLoadCacheTokens', false);
    }
  },
  ctx =>
    makeReqLabel(['batchLoadCacheTokens', ...stableSortByAddress(ctx.args[0])]),
);

const updateTokens = ({
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
};

const loadToken = makeSWRKeyAsyncFunc(
  async (_address: string, force?: boolean) => {
    const address = _address.toLowerCase();
    if (!address) return;

    try {
      const tokensExisted = addressHasTokens(address);
      if (!tokensExisted) setLoadingByLabel('@loadToken', true);

      const tokenRes = await syncTokens(address, force, tokensExisted);
      if (!tokenRes.length) return;

      updateTokens({
        address,
        newTokens: tokenRes || [],
      });
    } catch (error) {
      console.error('loadToken error', error);
      Sentry.captureException(error);
    } finally {
      setLoadingByLabel('@loadToken', false);
    }
  },
  ctx =>
    makeReqLabel(['loadToken', ctx.args[0], ctx.args[1] ? 'force' : 'normal']),
);

const gCheckIsExpireAndUpdate = makeSWRKeyAsyncFunc(
  async (top10Addresses, force?: boolean) => {
    try {
      setLoadingByLabel('@checkIsExpireAndUpdate', true);

      for (const address of top10Addresses) {
        try {
          await loadToken(address, force);
        } catch (error) {
          console.error(`Error fetching data for ${address.slice(-4)}:`, error);
        }
      }
      await new Promise(resolve => setTimeout(resolve, 0));
    } catch (error) {
      console.error('checkIsExpireAndUpdate error', error);
    } finally {
      setLoadingByLabel('@checkIsExpireAndUpdate', false);
      // setIsFirstFetch(false);
    }
  },
  ctx =>
    makeReqLabel([
      'checkIsExpireAndUpdate',
      ...stableSortByAddress(ctx.args[0]),
      ctx.args[1] ? 'force' : 'normal',
    ]),
);

const userTokenSettingsState = zCreate<
  ReturnType<typeof preferenceService.getUserTokenSettingsSync>
>(() => {
  return preferenceService.getUserTokenSettingsSync();
});

function setUserTokenSettings(
  valOrFunc: UpdaterOrPartials<
    ReturnType<typeof preferenceService.getUserTokenSettingsSync>
  >,
) {
  userTokenSettingsState.setState(prev => {
    const { newVal, changed } = resolveValFromUpdater(prev, valOrFunc, {
      strict: true,
    });

    if (!changed) return prev;

    return newVal;
  });
}
const loadUserTokenSettings = () => {
  setUserTokenSettings(prev => {
    if (Object.keys(prev).length > 0) return prev;

    return preferenceService.getUserTokenSettingsSync();
  });
};

export const useSelectTokensThreadSafe = () => {
  const { top10Addresses, fetchAccounts } = useAccountInfo();

  const userTokenSettings = userTokenSettingsState(s => s);

  const isLoadingToken = loadingsByLabelState(s => s['@loadToken']);
  const isLoadingCacheToken = loadingsByLabelState(
    s => s['@batchLoadCacheTokens'],
  );
  const isCheckingExpire = loadingsByLabelState(
    s => s['@checkIsExpireAndUpdate'],
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
    [top10Addresses],
  );

  const checkIsExpireAndUpdate = useCallback(
    async (force?: boolean) => {
      return gCheckIsExpireAndUpdate(top10Addresses, force);
    },
    [top10Addresses],
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
    [getCacheTokens, checkIsExpireAndUpdate],
  );

  const preFetchTokens = useCallback(
    (address?: string) => {
      fetchTokens({
        currentAddress: address,
        sceneType: 'send',
      });
    },
    [fetchTokens],
  );

  const fetchAccountsAndTokenSettings = useCallback(async () => {
    fetchAccounts();
    loadUserTokenSettings();
  }, [fetchAccounts]);

  return {
    userTokenSettings,
    isLoadingToken: isLoading || isCheckingExpire || isLoadingCacheToken,

    preFetchTokens,
    fetchTokens,
    getCacheTokens,
    checkIsExpireAndUpdate,
    loadToken,
    fetchAccountsAndTokenSettings,
  };
};
