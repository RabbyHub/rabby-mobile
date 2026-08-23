import type { Account } from '@/core/startupServices/preference';
import { isPerpsActionUserCancelled } from '@/hooks/perps/actions/actionError';
import {
  buildPerpsUpdateLeverageCommand,
  executePerpsUpdateLeverage,
} from '@/hooks/perps/actions/updateLeverage';
import { judgeIsUserAgentIsExpired } from '@/hooks/perps/perpsActionError';
import { showToast } from '@/hooks/perps/showToast';
import { updateActiveAssetLeverageCache } from '@/hooks/perps/useActiveAssetDataCache';
import * as Sentry from '@sentry/react-native';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface PerpsProLeverageUpdateRequest {
  account: Account;
  coin: string;
  currentIsCross: boolean;
  currentLeverage: number;
  isCross: boolean;
  leverage: number;
  maxLeverage: number;
}

export const usePerpsProLeverageUpdate = ({
  refreshActiveAssetData,
}: {
  refreshActiveAssetData: () => Promise<unknown>;
}) => {
  const { t } = useTranslation();
  const pendingRef = useRef(false);
  const [pending, setPending] = useState(false);

  const update = useCallback(
    async (request: PerpsProLeverageUpdateRequest) => {
      if (pendingRef.current) return false;
      if (
        request.currentLeverage === request.leverage &&
        request.currentIsCross === request.isCross
      ) {
        return true;
      }
      pendingRef.current = true;
      setPending(true);
      try {
        const command = buildPerpsUpdateLeverageCommand({
          account: request.account,
          coin: request.coin,
          isCross: request.isCross,
          leverage: request.leverage,
          maxLeverage: request.maxLeverage,
        });
        const result = await executePerpsUpdateLeverage(command);
        if (result.failureReason === 'userCancelled') return false;
        if (result.kind === 'staleContext') {
          showToast(t('page.perps.pro.trade.contextChanged'), 'error');
          return false;
        }
        if (result.kind !== 'success') {
          const error = result.error || 'Leverage update failed';
          if (await judgeIsUserAgentIsExpired(error)) {
            return false;
          }
          showToast(
            t('page.perps.pro.positions.leverageUpdateFailed', {
              reason: error,
            }),
            'error',
          );
          Sentry.captureException(new Error(error), {
            extra: { scene: 'Perps Pro shared leverage update' },
          });
          return false;
        }
        if (result.refreshError) {
          Sentry.captureException(new Error(result.refreshError), {
            extra: { scene: 'Perps Pro leverage clearinghouse refresh' },
          });
        }
        updateActiveAssetLeverageCache(request.coin, request.account.address, {
          type: request.isCross ? 'cross' : 'isolated',
          value: request.leverage,
        });
        await refreshActiveAssetData().catch(error => {
          Sentry.captureException(error, {
            extra: { scene: 'Perps Pro active asset leverage refresh' },
          });
        });
        showToast(
          t('page.perps.pro.positions.leverageUpdated', {
            leverage: request.leverage,
          }),
          'success',
        );
        return true;
      } catch (error) {
        if (isPerpsActionUserCancelled(error)) return false;
        const message = error instanceof Error ? error.message : String(error);
        if (await judgeIsUserAgentIsExpired(message)) {
          return false;
        }
        showToast(
          t('page.perps.pro.positions.leverageUpdateFailed', {
            reason: message,
          }),
          'error',
        );
        Sentry.captureException(
          error instanceof Error ? error : new Error(message),
          { extra: { scene: 'Perps Pro shared leverage update' } },
        );
        return false;
      } finally {
        pendingRef.current = false;
        setPending(false);
      }
    },
    [refreshActiveAssetData, t],
  );

  return { pending, update };
};
