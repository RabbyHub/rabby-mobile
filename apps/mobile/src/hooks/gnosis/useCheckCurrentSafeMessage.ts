import { apisSafe } from '@/core/apis/safe';
import { Account } from '@/core/services/preference';
import type { SafeMessage } from '@rabby-wallet/gnosis-sdk';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { useRequest } from 'ahooks';
import type { Options } from 'ahooks/lib/useRequest/src/types';
import { useTranslation } from 'react-i18next';

export const useCheckCurrentSafeMessage = (
  {
    chainId,
    safeMessageHash,
    threshold,
    account,
  }: {
    chainId?: number;
    safeMessageHash?: string;
    threshold?: number;
    account: Account;
  },
  options?: Options<
    | { safeMessage: SafeMessage; threshold: number; isFinished: boolean }
    | undefined,
    any
  >,
) => {
  const { t } = useTranslation();
  return useRequest(
    async () => {
      if (
        !threshold ||
        !chainId ||
        !safeMessageHash ||
        account.type !== KEYRING_TYPE.GnosisKeyring
      ) {
        return;
      }
      const res = await apisSafe.getGnosisMessage({
        chainId: chainId,
        messageHash: safeMessageHash,
      });
      if (res.confirmations.length >= threshold) {
        return {
          safeMessage: res,
          threshold,
          isFinished: true,
        };
      }
      return {
        safeMessage: res,
        threshold,
        isFinished: false,
      };
    },
    {
      refreshDeps: [chainId, threshold, safeMessageHash],
      ...options,
    },
  );
};
