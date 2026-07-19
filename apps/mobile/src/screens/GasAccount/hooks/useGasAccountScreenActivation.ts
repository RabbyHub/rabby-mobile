import { markFeatureActivation } from '@/core/utils/featureActivationDiagnostics';
import { traceStartupDiagnostic } from '@/core/utils/startupDiagnostics';
import {
  checkGasAccountAddressesEligibility,
  refreshGasAccountEligibilityStatus,
} from '@/hooks/useGasAccountEligibility';
import { refreshAccountsWithGasAccountBalance } from '@/utils/autoLoginGasAccount';
import { useFocusEffect } from '@react-navigation/native';
import { useMemoizedFn } from 'ahooks';
import { useCallback, useRef } from 'react';
import { InteractionManager } from 'react-native';
import { gasAccountStore, storeApiGasAccount } from './atom';

type GasAccountScreenActivationOptions = {
  isLogin: boolean;
  hasPendingHardwareAccount: boolean;
  pendingHardwareAddress?: string;
  isDisplayBalanceLoading: boolean;
  refreshPendingHardwareBalance: () => unknown | Promise<unknown>;
};

const traceGasAccount = (event: string, data: Record<string, unknown> = {}) => {
  traceStartupDiagnostic('gas-account', event, data);
};

const traceGasAccountTask = async <T>(
  label: string,
  task: () => Promise<T> | T,
) => {
  const startedAt = Date.now();
  traceGasAccount('task_start', { label });
  try {
    const result = await task();
    traceGasAccount('task_end', {
      label,
      durationMs: Date.now() - startedAt,
    });
    return result;
  } catch (error) {
    traceGasAccount('task_error', {
      label,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};

export const useGasAccountScreenActivation = ({
  isLogin,
  hasPendingHardwareAccount,
  pendingHardwareAddress,
  isDisplayBalanceLoading,
  refreshPendingHardwareBalance,
}: GasAccountScreenActivationOptions) => {
  const diagnosticsRef = useRef({
    isLogin,
    hasPendingHardwareAccount,
    hasPendingHardwareAddress: !!pendingHardwareAddress,
    isDisplayBalanceLoading,
  });
  diagnosticsRef.current = {
    isLogin,
    hasPendingHardwareAccount,
    hasPendingHardwareAddress: !!pendingHardwareAddress,
    isDisplayBalanceLoading,
  };
  const refreshPendingHardware = useMemoizedFn(refreshPendingHardwareBalance);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      let accountBalanceRefreshTask: ReturnType<
        typeof InteractionManager.runAfterInteractions
      > | null = null;
      let accountBalanceRefreshTimer: ReturnType<typeof setTimeout> | null =
        null;
      let pendingHistoryTimer: ReturnType<typeof setTimeout> | null = null;

      storeApiGasAccount.setHistoryRefreshEnabled(true);
      traceGasAccount('focus_enter', {
        hasPendingHardwareAddress:
          diagnosticsRef.current.hasPendingHardwareAddress,
      });

      const clearPendingHistoryTimer = () => {
        if (pendingHistoryTimer) {
          clearTimeout(pendingHistoryTimer);
          pendingHistoryTimer = null;
        }
      };

      const schedulePendingHistoryRefresh = () => {
        clearPendingHistoryTimer();
        const history = gasAccountStore.getState().history;
        const hasPendingHistory =
          history.rechargeList.length + history.withdrawList.length > 0;
        if (
          !isActive ||
          history.status === 'refreshing' ||
          history.loadingMore ||
          !hasPendingHistory
        ) {
          return;
        }

        pendingHistoryTimer = setTimeout(() => {
          pendingHistoryTimer = null;
          if (!isActive) {
            return;
          }
          void storeApiGasAccount
            .refreshHistory({ reason: 'screen_pending_poll' })
            .catch(error => {
              console.error('pending history refresh error', error);
            });
        }, 2000);
      };

      const unsubscribeHistory = gasAccountStore.subscribe(
        (state, previousState) => {
          const history = state.history;
          const previousHistory = previousState.history;
          if (
            history.status !== previousHistory.status ||
            history.loadingMore !== previousHistory.loadingMore ||
            history.rechargeList.length !==
              previousHistory.rechargeList.length ||
            history.withdrawList.length !== previousHistory.withdrawList.length
          ) {
            schedulePendingHistoryRefresh();
          }
        },
      );
      schedulePendingHistoryRefresh();

      const scheduleAccountsBalanceRefresh = () => {
        traceGasAccount('refresh_accounts_balance_scheduled');
        accountBalanceRefreshTask = InteractionManager.runAfterInteractions(
          () => {
            accountBalanceRefreshTask = null;
            accountBalanceRefreshTimer = setTimeout(() => {
              accountBalanceRefreshTimer = null;
              if (!isActive) {
                return;
              }

              void traceGasAccountTask('refresh_accounts_balance', () =>
                refreshAccountsWithGasAccountBalance(),
              ).catch(error => {
                console.error(
                  'refreshAccountsWithGasAccountBalance error',
                  error,
                );
              });
            }, 300);
          },
        );
      };

      const refreshGasAccountState = async () => {
        try {
          await traceGasAccountTask('hydrate_session', () =>
            storeApiGasAccount.hydrateSessionFromService(),
          );
        } catch (error) {
          console.error(
            'hydrateSessionFromService on GasAccountScreen error',
            error,
          );
        }

        if (!isActive) {
          return;
        }

        const refreshSnapshotTask = traceGasAccountTask(
          'refresh_snapshot',
          () => storeApiGasAccount.refreshSnapshot({ reason: 'screen_focus' }),
        ).catch(error => {
          console.error(
            'refreshSnapshot on GasAccountScreen focus error',
            error,
          );
        });
        const refreshHistoryTask = traceGasAccountTask('refresh_history', () =>
          storeApiGasAccount.refreshHistory({ reason: 'screen_focus' }),
        ).catch(error => {
          console.error(
            'refreshHistory on GasAccountScreen focus error',
            error,
          );
        });
        void Promise.allSettled([refreshSnapshotTask, refreshHistoryTask]).then(
          () => {
            if (!isActive) {
              return;
            }

            const diagnosticState = diagnosticsRef.current;
            markFeatureActivation('gas-account', 'data-ready', {
              reason: 'snapshot_and_history_settled',
              detail: JSON.stringify({
                isLogin: diagnosticState.isLogin,
                hasPendingHardwareAccount:
                  diagnosticState.hasPendingHardwareAccount,
                isDisplayBalanceLoading:
                  diagnosticState.isDisplayBalanceLoading,
              }),
            });
          },
        );
        scheduleAccountsBalanceRefresh();
      };

      void refreshGasAccountState();

      return () => {
        isActive = false;
        accountBalanceRefreshTask?.cancel();
        if (accountBalanceRefreshTimer) {
          clearTimeout(accountBalanceRefreshTimer);
        }
        clearPendingHistoryTimer();
        unsubscribeHistory();
        storeApiGasAccount.setHistoryRefreshEnabled(false);
        traceGasAccount('focus_exit');
      };
    }, []),
  );

  useFocusEffect(
    useCallback(() => {
      if (!pendingHardwareAddress) {
        return;
      }

      void traceGasAccountTask(
        'refresh_pending_hardware_balance',
        refreshPendingHardware,
      ).catch(error => {
        console.error('refreshPendingHardwareGasAccountInfo error', error);
      });
    }, [pendingHardwareAddress, refreshPendingHardware]),
  );

  useFocusEffect(
    useCallback(() => {
      if (isLogin || hasPendingHardwareAccount) {
        void refreshGasAccountEligibilityStatus().catch(error => {
          console.error('refreshGasAccountEligibilityStatus error', error);
        });
        return;
      }

      void traceGasAccountTask('check_addresses_eligibility', () =>
        checkGasAccountAddressesEligibility(),
      ).catch(error => {
        console.error(
          'checkAddressesEligibility on GasAccountScreen error',
          error,
        );
      });
    }, [hasPendingHardwareAccount, isLogin]),
  );
};
