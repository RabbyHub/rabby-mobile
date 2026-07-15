import { useCallback, useEffect } from 'react';
import type { ClaimedGiftAddress } from '@/core/services/gasAccount';
import { gasAccountServiceApi } from '@/core/serviceApi/gasAccount';
import { useAccounts } from '@/hooks/account';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { zCreate } from '@/core/utils/reexports';
import type { UpdaterOrPartials } from '@/core/utils/store';
import {
  makeAvoidParallelAsyncFunc,
  resolveValFromUpdater,
  runDevIIFEFunc,
} from '@/core/utils/store';
import * as apisAccount from '@/core/apis/account';
import { storeApiGasAccount } from '@/screens/GasAccount/hooks/atom';

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
  eligibilityData: [] as ClaimedGiftAddress[],
}));

async function reFetchStatus() {
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

export const checkGasAccountAddressesEligibility = makeAvoidParallelAsyncFunc(
  async (force = false) => {
    try {
      const doReturn = (gifts: ClaimedGiftAddress[]) => {
        setEligibilityData(gifts);
        return gifts;
      };
      if (await gasAccountServiceApi.getHasClaimedGift()) {
        return doReturn([]);
      }

      const gasAccountSig = await gasAccountServiceApi.getGasAccountSig();
      if (gasAccountSig?.sig) {
        return doReturn([]);
      }

      const addresses = await apisAccount
        .getTop50PrivateKeyAccounts()
        .then(res => res.map(acc => acc.address));
      if (addresses.length === 0) {
        return doReturn([]);
      }
      const result = await gasAccountServiceApi.checkAddressEligibilityBatch(
        addresses,
        force,
      );
      return doReturn(result);
    } catch (err) {
      throw err;
    } finally {
      void reFetchStatus().catch(console.error);
    }
  },
);

export const useGasAccountGiftEligibility = () => {
  return gasAccountState(
    s =>
      s.currentEligibleAddress !== undefined &&
      !s.gasAccountSig?.sig &&
      !s.hasClaimedGift,
  );
};

export const useGasAccountEligibility = () => {
  useEffect(() => {
    void reFetchStatus().catch(console.error);
  }, []);

  const { accounts } = useAccounts({ disableAutoFetch: true });
  const currentEligibleAddress = gasAccountState(s => s.currentEligibleAddress);

  const isEligible = useGasAccountGiftEligibility();

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
        void reFetchStatus().catch(console.error);
      }
    },
    [accounts],
  );

  return {
    isEligible,
    currentEligibleAddress,
    checkAddressesEligibility: checkGasAccountAddressesEligibility,
    claimGift,
  };
};
