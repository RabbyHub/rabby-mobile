import { toast } from '@/components/Toast';
import { apisSafe } from '@/core/apis/safe';
import { Account } from '@/core/services/preference';
import { findChain } from '@/utils/chain';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { useRequest } from 'ahooks';
import { useTranslation } from 'react-i18next';

export const useGetCurrentSafeInfo = ({
  chainId,
  account,
  rejectApproval,
}: {
  chainId?: number;
  account: Account;
  rejectApproval?(msg?: string): void;
}) => {
  const { t } = useTranslation();
  return useRequest(
    async () => {
      if (!chainId || account.type !== KEYRING_TYPE.GnosisKeyring) {
        return;
      }
      const networkId = '' + chainId;
      const chain = findChain({ id: chainId });
      try {
        const safeInfo = await apisSafe.getBasicSafeInfo({
          address: account.address,
          networkId,
        });
        return safeInfo;
      } catch (e) {
        let networkIds: string[] = [];
        try {
          networkIds = await apisSafe.getGnosisNetworkIds(account.address);
        } catch (e) {
          console.error(e);
        }
        if (!networkIds.includes(networkId)) {
          throw new Error(
            // @ts-expect-error FIXME: fix this error type
            t('page.signTx.safeAddressNotSupportChain', [chain?.name]),
          );
        } else {
          throw e;
        }
      }
    },
    {
      refreshDeps: [chainId, account],
      onError(e) {
        toast.show(e.message || JSON.stringify(e), {
          position: toast.positions.CENTER,
        });
        setTimeout(() => {
          rejectApproval?.(e.message);
        }, 2000);
      },
    },
  );
};
