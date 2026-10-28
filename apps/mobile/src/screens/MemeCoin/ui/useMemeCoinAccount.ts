import { useEffect } from 'react';
import { useMemoizedFn } from 'ahooks';
import { useTranslation } from 'react-i18next';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { toast } from '@/components2024/Toast';
import { useSceneAccountInfo } from '@/hooks/accountsSwitcher';

/** The scene account, but only while it is still the account the flow was started with (spec §2.3). */
export const useMemeCoinAccount = (
  accountAddress: string,
  onMismatch: () => void,
) => {
  const { t } = useTranslation();
  const { finalSceneCurrentAccount: account } = useSceneAccountInfo({
    forScene: 'MakeTransactionAbout',
  });
  const mismatch = !!account && !isSameAddress(account.address, accountAddress);
  const handleMismatch = useMemoizedFn(onMismatch);

  useEffect(() => {
    if (mismatch) {
      toast.error(t('page.memeCoin.accountChanged'));
      handleMismatch();
    }
  }, [mismatch, t, handleMismatch]);

  return account && !mismatch ? account : null;
};
