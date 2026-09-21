import { useCallback } from 'react';
import type { ClaimedGiftAddress } from '@/core/services/gasAccount';
import { gasAccountServiceApi } from '@/core/serviceApi/gasAccount';
import { storeApiAccounts } from '@/hooks/account';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { zCreate } from '@/core/utils/reexports';
import { makeAvoidParallelAsyncFunc, runDevIIFEFunc } from '@/core/utils/store';
import * as apisAccount from '@/core/apis/account';
import { storeApiGasAccount } from '@/screens/GasAccount/hooks/atom';
import { useShallow } from 'zustand/react/shallow';
import { useActivityStore } from '@/hooks/storeActivity/useActivityStore';

runDevIIFEFunc(() => {
  // mock haven't claimed gift
  void gasAccountServiceApi.setHasClaimedGift(false).catch(error => {
    console.error('[gasAccount] reset claimed gift dev state failed', error);
  });
});

const gasAccountState = zCreate(() => ({
  gasAccountSig: {
    sig: undefined as string | undefined,
    accountId: undefined as string | undefined,
  },
  hasClaimedGift: false,
  currentEligibleAddress: undefined as ClaimedGiftAddress | undefined,
}));

export async function refreshGasAccountEligibilityStatus() {
  const [gasAccountSig, hasClaimedGift, currentEligibleAddress] =
    await Promise.all([
      gasAccountServiceApi.getGasAccountSig(),
      gasAccountServiceApi.getHasClaimedGift(),
      gasAccountServiceApi.getCurrentEligibleAddress(),
    ]);

  gasAccountState.setState(prev => {
    return {
      ...prev,
      gasAccountSig,
      hasClaimedGift,
      currentEligibleAddress,
    };
  });
}

export const checkGasAccountAddressesEligibility = makeAvoidParallelAsyncFunc(
  async (force = false) => {
    try {
      if (await gasAccountServiceApi.getHasClaimedGift()) {
        return [];
      }

      const gasAccountSig = await gasAccountServiceApi.getGasAccountSig();
      if (gasAccountSig?.sig) {
        return [];
      }

      const addresses = await apisAccount
        .getTop50PrivateKeyAccounts()
        .then(res => res.map(acc => acc.address));
      if (addresses.length === 0) {
        return [];
      }
      return gasAccountServiceApi.checkAddressEligibilityBatch(
        addresses,
        force,
      );
    } catch (err) {
      throw err;
    } finally {
      void refreshGasAccountEligibilityStatus().catch(console.error);
    }
  },
);

export const useGasAccountGiftEligibility = () => {
  return useActivityStore(
    gasAccountState,
    state =>
      state.currentEligibleAddress !== undefined &&
      !state.gasAccountSig?.sig &&
      !state.hasClaimedGift,
    Object.is,
    { storeLabel: 'home-gas-account-badge' },
  );
};

export const useGasAccountEligibility = () => {
  const { currentEligibleAddress, isEligible } = gasAccountState(
    useShallow(state => ({
      currentEligibleAddress: state.currentEligibleAddress,
      isEligible:
        state.currentEligibleAddress !== undefined &&
        !state.gasAccountSig?.sig &&
        !state.hasClaimedGift,
    })),
  );

  const claimGift = useCallback(async (address: string) => {
    try {
      const accounts = storeApiAccounts.getAccounts();
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
      await gasAccountServiceApi.setGasAccountSig(sig, account);

      // 使用sig claim gift
      await gasAccountServiceApi.claimGift(address, sig);

      // 更新全局状态、当前有资格地址和资格缓存
      await gasAccountServiceApi.markGiftClaimed(address);

      return true;
    } catch (err) {
      console.error('Failed to claim gift:', err);
      throw err;
    } finally {
      void refreshGasAccountEligibilityStatus().catch(console.error);
    }
  }, []);

  return {
    isEligible,
    currentEligibleAddress,
    checkAddressesEligibility: checkGasAccountAddressesEligibility,
    claimGift,
  };
};
