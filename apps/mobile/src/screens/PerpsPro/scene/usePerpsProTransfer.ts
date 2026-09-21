import { isPerpsActionUserCancelled } from '@/hooks/perps/actions/actionError';
import {
  buildPerpsSpotToPerpsTransferCommand,
  executePerpsSpotToPerpsTransfer,
} from '@/hooks/perps/funding/perpsTransfer';
import { isSamePerpsFundingAccount } from '@/hooks/perps/funding/accountGuard';
import { isPerpsStandardTransferAbstraction } from '@/hooks/perps/funding/transferEligibility';
import { showToast } from '@/hooks/perps/showToast';
import {
  getPerpsAccountRuntimeContext,
  isPerpsUserAbstractionReadyForAccount,
  perpsStore,
} from '@/hooks/perps/usePerpsStore';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { PerpsAccountAssetRow } from '../model/account';

interface PerpsProTransferEditor {
  account: NonNullable<
    ReturnType<typeof perpsStore.getState>['currentPerpsAccount']
  >;
  accountRuntimeGeneration: number;
  available: string;
}

export const usePerpsProTransfer = (accountIdentity: string) => {
  const { t } = useTranslation();
  const pendingRef = useRef(false);
  const [editor, setEditor] = useState<PerpsProTransferEditor | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setEditor(null);
  }, [accountIdentity]);

  const open = useCallback(
    (asset: PerpsAccountAssetRow) => {
      if (pendingRef.current || asset.action !== 'transfer') {
        return;
      }
      const state = perpsStore.getState();
      const accountRuntime = getPerpsAccountRuntimeContext();
      if (
        !state.currentPerpsAccount ||
        !isPerpsUserAbstractionReadyForAccount(state) ||
        !isSamePerpsFundingAccount(
          accountRuntime.account,
          state.currentPerpsAccount,
        ) ||
        !isPerpsStandardTransferAbstraction(state.userAbstraction) ||
        asset.key !== 'spot:USDC' ||
        asset.coin !== 'USDC' ||
        asset.ledger !== 'spot'
      ) {
        showToast(t('page.perps.pro.account.transferContextChanged'), 'error');
        return;
      }
      setEditor({
        account: { ...state.currentPerpsAccount },
        accountRuntimeGeneration: accountRuntime.generation,
        available: asset.available,
      });
    },
    [t],
  );

  const close = useCallback(() => {
    if (!pendingRef.current) setEditor(null);
  }, []);

  const confirm = useCallback(
    async (amount: string) => {
      if (!editor || pendingRef.current) {
        return;
      }
      pendingRef.current = true;
      setPending(true);
      try {
        const command = buildPerpsSpotToPerpsTransferCommand({
          account: editor.account,
          accountRuntimeGeneration: editor.accountRuntimeGeneration,
          amount,
          available: editor.available,
        });
        const result = await executePerpsSpotToPerpsTransfer(command);
        if (result.kind === 'success') {
          setEditor(null);
          return;
        }
        if (result.kind === 'staleContext') {
          setEditor(null);
          showToast(
            t('page.perps.pro.account.transferContextChanged'),
            'error',
          );
          return;
        }
        if (
          result.failureReason === 'userCancelled' ||
          isPerpsActionUserCancelled(result.error)
        ) {
          return;
        }
        showToast(t('page.perps.pro.account.transferFailed'), 'error');
      } catch (error) {
        if (!isPerpsActionUserCancelled(error)) {
          showToast(t('page.perps.pro.account.transferFailed'), 'error');
        }
      } finally {
        pendingRef.current = false;
        setPending(false);
      }
    },
    [editor, t],
  );

  return { close, confirm, editor, open, pending };
};
