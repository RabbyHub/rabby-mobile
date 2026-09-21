import { Tx } from '@rabby-wallet/rabby-api/dist/types';
import { useMemoizedFn } from 'ahooks';

import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { KeyringAccountWithAlias } from '@/hooks/account';
import { resetNavigationTo } from '@/hooks/navigation';
import { useMiniSigner } from '@/hooks/useSigner';
import { isAccountSupportMiniApproval } from '@/utils/account';

type RevokeApprovalOptions = {
  account: KeyringAccountWithAlias;
  buildMiniSignTx: () => Promise<{ params: unknown[] }>;
  revoke: () => Promise<unknown>;
};

export function useRevokeApproval({
  account,
  buildMiniSignTx,
  revoke,
}: RevokeApprovalOptions) {
  const { navigation } = useSafeSetNavigationOptions();
  const {
    openUI,
    resetGasStore,
    close: closeMiniSign,
  } = useMiniSigner({
    account,
  });

  const goBackAfterRevoke = useMemoizedFn(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      resetNavigationTo(navigation, 'Home');
    }
  });

  const handleRevokeDirectSign = useMemoizedFn(async () => {
    try {
      const data = await buildMiniSignTx();
      const tx = data.params[0] as Tx;
      closeMiniSign();
      resetGasStore();
      await openUI({
        txs: [tx],
      });
    } catch (error) {
      console.error(error);
      return;
    }

    goBackAfterRevoke();
  });

  return useMemoizedFn(async () => {
    try {
      if (isAccountSupportMiniApproval(account.type)) {
        await handleRevokeDirectSign();
        return;
      }

      await revoke();
    } catch (error) {
      console.error(error);
    }

    resetNavigationTo(navigation, 'Home');
  });
}
