import type { Account } from '@/core/startupServices/preference';
import { isSamePerpsActionAccount } from '@/hooks/perps/actions/accountGuard';
import { isPerpsActionUserCancelled } from '@/hooks/perps/actions/actionError';
import {
  buildPerpsCloseAllPositionsCommand,
  executePerpsCloseAllPositions,
  type PerpsCloseAllPositionsCommand,
} from '@/hooks/perps/actions/closeAllPositions';
import { ensurePerpsActionApproval } from '@/hooks/perps/actions/perpsActionApproval';
import {
  judgeIsBuilderFeeNeedApprove,
  judgeIsUserAgentIsExpired,
} from '@/hooks/perps/perpsActionError';
import { showToast } from '@/hooks/perps/showToast';
import { perpsStore } from '@/hooks/perps/usePerpsStore';
import { ensureWalletUnlockedForAction } from '@/utils/walletUnlock';
import * as Sentry from '@sentry/react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { reportPerpsProCloseAllHistory } from '../analytics/manualTradeHistory';

export interface PerpsProCloseAllConfirmation {
  account: Account;
  command: PerpsCloseAllPositionsCommand;
}

export const usePerpsProCloseAll = (accountIdentity: string) => {
  const { t } = useTranslation();
  const pendingRef = useRef(false);
  const [pending, setPending] = useState(false);
  const [confirmation, setConfirmation] =
    useState<PerpsProCloseAllConfirmation | null>(null);

  useEffect(() => {
    setConfirmation(null);
  }, [accountIdentity]);

  const requestCloseAll = useCallback(async () => {
    if (pendingRef.current) {
      return;
    }
    const state = perpsStore.getState();
    if (
      !state.currentPerpsAccount ||
      !state.currentClearinghouseState?.assetPositions.some(
        item => Number(item.position.szi) !== 0,
      )
    ) {
      return;
    }
    const requestedAccount = { ...state.currentPerpsAccount };
    pendingRef.current = true;
    setPending(true);
    try {
      if (!(await ensureWalletUnlockedForAction())) {
        return;
      }
      await ensurePerpsActionApproval(requestedAccount);
      const latestState = perpsStore.getState();
      if (
        !isSamePerpsActionAccount(
          latestState.currentPerpsAccount,
          requestedAccount,
        ) ||
        !latestState.currentClearinghouseState?.assetPositions.some(
          item => Number(item.position.szi) !== 0,
        )
      ) {
        showToast(
          t('page.perps.pro.positions.closeAllContextChanged'),
          'error',
        );
        return;
      }
      setConfirmation({
        account: requestedAccount,
        command: buildPerpsCloseAllPositionsCommand(
          requestedAccount,
          latestState.currentClearinghouseState,
        ),
      });
    } catch (error) {
      if (isPerpsActionUserCancelled(error)) {
        return;
      }
      showToast(t('page.perps.pro.positions.closeAllFailed'), 'error');
      Sentry.captureException(
        error instanceof Error ? error : new Error(String(error)),
        { extra: { scene: 'Perps Pro prepare close all positions' } },
      );
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }, [t]);

  const dismissConfirmation = useCallback(() => {
    if (!pendingRef.current) {
      setConfirmation(null);
    }
  }, []);

  const execute = useCallback(
    async ({ command }: PerpsProCloseAllConfirmation) => {
      if (pendingRef.current) {
        return;
      }
      pendingRef.current = true;
      setPending(true);
      try {
        const result = await executePerpsCloseAllPositions(command);
        reportPerpsProCloseAllHistory(command, result.confirmedFills);
        if (result.failureReason === 'userCancelled') {
          return;
        }
        if (result.kind === 'staleContext') {
          showToast(
            t('page.perps.pro.positions.closeAllContextChanged'),
            'error',
          );
          return;
        }
        if (result.kind === 'unknownOutcome') {
          if (result.refreshError) {
            Sentry.captureException(
              new Error(
                `Perps Pro close all reconciliation failed: ${result.refreshError}`,
              ),
            );
          }
          showToast(t('page.perps.pro.trade.unknownOutcome'), 'error');
          return;
        }
        if (result.kind === 'failed') {
          if (
            (result.error && (await judgeIsUserAgentIsExpired(result.error))) ||
            judgeIsBuilderFeeNeedApprove(result.error || '')
          ) {
            return;
          }
          showToast(
            result.error || t('page.perps.pro.positions.closeAllFailed'),
            'error',
          );
          Sentry.captureException(
            new Error(`Perps Pro close all failed: ${result.error}`),
          );
          return;
        }
        if (result.refreshError) {
          Sentry.captureException(
            new Error(
              `Perps Pro close all refresh failed: ${result.refreshError}`,
            ),
          );
        }
        showToast(t('page.perps.pro.positions.closeAllSuccess'), 'success');
      } catch (error) {
        if (isPerpsActionUserCancelled(error)) {
          return;
        }
        const message = error instanceof Error ? error.message : String(error);
        if (
          (await judgeIsUserAgentIsExpired(message)) ||
          judgeIsBuilderFeeNeedApprove(message)
        ) {
          return;
        }
        showToast(
          message || t('page.perps.pro.positions.closeAllFailed'),
          'error',
        );
        Sentry.captureException(
          error instanceof Error ? error : new Error(message),
          { extra: { scene: 'Perps Pro close all positions' } },
        );
      } finally {
        pendingRef.current = false;
        setPending(false);
      }
    },
    [t],
  );

  const confirmCloseAll = useCallback(() => {
    if (!confirmation || pendingRef.current) {
      return;
    }
    const snapshot = confirmation;
    execute(snapshot)
      .catch(error => {
        Sentry.captureException(error, {
          extra: { scene: 'Perps Pro launch close all positions' },
        });
      })
      .finally(() => {
        setConfirmation(current => (current === snapshot ? null : current));
      });
  }, [confirmation, execute]);

  return {
    confirmation,
    confirmCloseAll,
    dismissConfirmation,
    pending,
    requestCloseAll,
  };
};
