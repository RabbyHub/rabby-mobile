import { apisSafe } from '@/core/apis/safe';
import { Account } from '@/core/services/preference';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { useRequest } from 'ahooks';
import { useTranslation } from 'react-i18next';

export const useGetMessageHash = ({
  chainId,
  message,
  account,
}: {
  chainId?: number;
  message?: string | Record<string, any> | null;
  account: Account;
}) => {
  const { t } = useTranslation();
  return useRequest(
    async () => {
      if (!chainId || !message || account.type !== KEYRING_TYPE.GnosisKeyring) {
        return;
      }
      return apisSafe.getGnosisMessageHash({
        safeAddress: account.address,
        chainId,
        message,
      });
    },
    {
      refreshDeps: [chainId, message, account],
    },
  );
};
