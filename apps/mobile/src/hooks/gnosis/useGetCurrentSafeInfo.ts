import { toast } from '@/components2024/Toast';
import { apisSafe } from '@/core/apis/safe';
import { Account } from '@/core/services/preference';
import { findChain } from '@/utils/chain';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { useRequest } from 'ahooks';
import { useTranslation } from 'react-i18next';

export const useGetCurrentSafeInfo = ({
  chainId,
  account,
}: {
  chainId?: number;
  account: Account;
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
        toast.error(e.message || JSON.stringify(e), {
          position: toast.positions.CENTER,
        });
        // todo
        // Modal.error({
        //   className: 'modal-support-darkmode',
        //   title: 'Error',
        //   content: e.message || JSON.stringify(e),
        //   closable: false,
        //   // onOk() {
        //   //   rejectApproval();
        //   // },
        // });
      },
    },
  );
};
