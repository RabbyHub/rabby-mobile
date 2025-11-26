import { useCallback, useState, useRef } from 'react';
import { gasAccountService } from '@/core/services/shared';
import { ClaimedGiftAddress } from '@/core/services/gasAccount';
import { useGasAccountMethods } from '@/screens/GasAccount/hooks';
import { useAccounts } from '@/hooks/account';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';

export const useGasAccountEligibility = () => {
  const { login } = useGasAccountMethods();
  const { accounts } = useAccounts({ disableAutoFetch: true });
  const [_eligibilityData, setEligibilityData] = useState<ClaimedGiftAddress[]>(
    [],
  );
  const [_loading, setLoading] = useState(false);
  const [_error, setError] = useState<string | null>(null);
  const [_cacheStatus, setCacheStatus] = useState(
    gasAccountService.getCacheStatus(),
  );

  // 使用ref来跟踪缓存状态，避免不必要的状态更新
  const cacheStatusRef = useRef(gasAccountService.getCacheStatus());

  // 智能更新缓存状态 - 只在真正需要时更新
  const updateCacheStatusIfNeeded = useCallback(() => {
    const currentStatus = gasAccountService.getCacheStatus();

    // 只在缓存状态发生实质性变化时更新
    const shouldUpdate =
      currentStatus.isValid !== cacheStatusRef.current.isValid ||
      currentStatus.cachedAddresses.length !==
        cacheStatusRef.current.cachedAddresses.length;

    if (shouldUpdate) {
      cacheStatusRef.current = currentStatus;
      setCacheStatus(currentStatus);
    }
  }, []);

  // 批量检查地址资格
  const checkAddressesEligibility = useCallback(
    async (addresses: string[], force = false) => {
      try {
        setLoading(true);
        setError(null);
        // 如果已经领取过礼包，无需检查
        if (gasAccountService.getHasClaimedGift()) {
          return [];
        }

        // 如果gas account已经登录，无需检查资格
        const gasAccountSig = gasAccountService.getGasAccountSig();
        if (gasAccountSig?.sig) {
          return [];
        }

        const result = await gasAccountService.checkAddressEligibilityBatch(
          addresses,
          force,
        );
        setEligibilityData(result);

        // 每次调用接口后检查并更新缓存状态
        updateCacheStatusIfNeeded();
        return result;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to check eligibility';
        setError(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [updateCacheStatusIfNeeded],
  );

  // 领取礼包
  const claimGift = useCallback(
    async (address: string) => {
      try {
        // 从accounts列表中根据address匹配获取account信息
        const account = accounts.find(
          acc =>
            acc.address.toLowerCase() === address.toLowerCase() &&
            (acc.type === KEYRING_TYPE.SimpleKeyring ||
              acc.type === KEYRING_TYPE.HdKeyring),
        );
        if (!account) {
          throw new Error(`Account not found for address: ${address}`);
        }

        const sig = await login(account);
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
      }
    },
    [login, accounts],
  );

  return {
    checkAddressesEligibility,
    claimGift,
  };
};
