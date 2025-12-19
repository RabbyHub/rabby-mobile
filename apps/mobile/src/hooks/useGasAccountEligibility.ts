import { useCallback, useState, useRef, useMemo } from 'react';
import { gasAccountService } from '@/core/services/shared';
import { ClaimedGiftAddress } from '@/core/services/gasAccount';
import { useGasAccountMethods } from '@/screens/GasAccount/hooks';
import { useAccounts } from '@/hooks/account';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { zCreate } from '@/core/utils/reexports';
import {
  makeAvoidParallelAsyncFunc,
  resolveValFromUpdater,
  runDevIIFEFunc,
  UpdaterOrPartials,
} from '@/core/utils/store';
import { apisAccount } from '@/core/apis';
import { storeApiGasAccount } from '@/screens/GasAccount/hooks/atom';

runDevIIFEFunc(() => {
  // mock haven't claimed gift
  gasAccountService.setHasClaimedGift(false);
});

const gasAccountState = zCreate(() => ({
  gasAccountSig: gasAccountService.getGasAccountSig(),
  hasClaimedGift: gasAccountService.getHasClaimedGift(),
  currentEligibleAddress: gasAccountService.getCurrentEligibleAddress(),
  eligibilityData: [] as ClaimedGiftAddress[],
}));

function reFetchStatus() {
  gasAccountState.setState(prev => {
    // const { newVal } = resolveValFromUpdater(valOrFunc, prev);

    return {
      ...prev,
      gasAccountSig: gasAccountService.getGasAccountSig(),
      hasClaimedGift: gasAccountService.getHasClaimedGift(),
      currentEligibleAddress: gasAccountService.getCurrentEligibleAddress(),
      eligibilityData: [],
    };
  });
}

function setEligibilityData(
  valOrFunc: UpdaterOrPartials<ClaimedGiftAddress[]>,
) {
  gasAccountState.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev.eligibilityData, valOrFunc);

    return {
      ...prev,
      eligibilityData: newVal,
    };
  });
}

const checkAddressesEligibility = makeAvoidParallelAsyncFunc(
  async (force = false) => {
    try {
      const doReturn = (gifts: ClaimedGiftAddress[]) => {
        setEligibilityData(gifts);
        return gifts;
      };
      if (gasAccountService.getHasClaimedGift()) {
        return doReturn([]);
      }

      const gasAccountSig = gasAccountService.getGasAccountSig();
      if (gasAccountSig?.sig) {
        return doReturn([]);
      }

      const addresses = await apisAccount
        .getTop50PrivateKeyAccounts()
        .then(res => res.map(acc => acc.address));
      if (addresses.length === 0) {
        return doReturn([]);
      }
      const result = await gasAccountService.checkAddressEligibilityBatch(
        addresses,
        force,
      );
      return doReturn(result);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to check eligibility';
      throw err;
    } finally {
      reFetchStatus();
    }
  },
);

export const useGasAccountEligibility = () => {
  const { accounts } = useAccounts({ disableAutoFetch: true });

  const isEligible = gasAccountState(
    s =>
      s.currentEligibleAddress !== undefined &&
      !s.gasAccountSig?.sig &&
      !s.hasClaimedGift,
  );

  const claimGift = useCallback(
    async (address: string) => {
      try {
        const account = accounts.find(
          acc =>
            acc.address.toLowerCase() === address.toLowerCase() &&
            (acc.type === KEYRING_TYPE.SimpleKeyring ||
              acc.type === KEYRING_TYPE.HdKeyring),
        );
        if (!account) {
          throw new Error(`Account not found for address: ${address}`);
        }

        const sig = await storeApiGasAccount.loginGasAccount(account);
        if (!sig) {
          throw new Error('No sig found');
        }

        // 保存sig到全局状态
        gasAccountService.setGasAccountSig(sig, account);

        // 使用sig claim gift
        await gasAccountService.claimGift(address, sig);

        // 更新全局状态
        gasAccountService.setHasClaimedGift(true);

        // 更新当前有资格的地址状态
        const currentEligible = gasAccountService.getCurrentEligibleAddress();
        if (
          currentEligible &&
          currentEligible.address.toLowerCase() === address.toLowerCase()
        ) {
          // 如果当前有资格的地址就是claim的地址，清除它
          gasAccountService.store.currentEligibleAddress = undefined;
        }

        // 更新缓存，标记该地址已领取
        const addressKey = address.toLowerCase();
        if (gasAccountService.store.eligibilityCache[addressKey]) {
          gasAccountService.store.eligibilityCache[addressKey] = {
            ...gasAccountService.store.eligibilityCache[addressKey],
            isEligible: false,
            isClaimed: true,
            giftUsdValue: 0,
          };
        }
        gasAccountService.setHasClaimedGift(true);

        return true;
      } catch (err) {
        console.error('Failed to claim gift:', err);
        throw err;
      } finally {
        reFetchStatus();
      }
    },
    [accounts],
  );

  return {
    isEligible,
    checkAddressesEligibility,
    claimGift,
  };
};
