import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { Text } from '@/components/Typography';
import { toast } from '@/components2024/Toast';
import IconGift from '@/assets2024/icons/gas-account/gift-01.svg';
import GasHeaderBg from '@/assets2024/images/gasAccount/gas-header-bg.png';
import {
  filterDirectlySignableAccounts,
  getAccountList,
} from '@/core/apis/account';
import { markFeatureActivation } from '@/core/utils/featureActivationDiagnostics';
import { traceStartupDiagnostic } from '@/core/utils/startupDiagnostics';
import { useGasAccountEligibility } from '@/hooks/useGasAccountEligibility';
import { useFeatureActivationDiagnostics } from '@/hooks/useFeatureActivationDiagnostics';
import type { Account } from '@/core/startupServices/preference';
import { useTheme2024 } from '@/hooks/theme';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { useFocusEffect } from '@react-navigation/native';
import { formatUsdValue } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import { useMemoizedFn } from 'ahooks';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { InteractionManager, View } from 'react-native';
import { GasAccountDepositPopup } from './components/GasAccountDepositPopup';
import { GasAccountLoginPopup } from './components/GasAccountLoginPopup';
import { GasAccountHeader } from './components/HeaderRight';
import { WithDrawPopup } from './components/WithDrawPopup';
import { useGasAccountBalanceWithPendingHardware } from './hooks/useGasAccountBalanceWithPendingHardware';
import { storeApiGasAccount, useGasAccountLoginVisible } from './hooks/atom';
import NormalScreenContainer from '@/components2024/ScreenContainer/NormalScreenContainer';
import { refreshAccountsWithGasAccountBalance } from '@/utils/autoLoginGasAccount';
import { GasAccountEmptyState } from './components/GasAccountEmptyState';
import { getGasAccountEmptyStatePrimaryMode } from './components/GasAccountEmptyState.utils';
import { GasAccountUserState } from './components/GasAccountUserState';
import { useGasAccountHistory, useGasAccountMethods } from './hooks';
import { withGasAccountService } from './gasAccountServiceDependencies';

const traceGasAccount = (event: string, data: Record<string, unknown> = {}) => {
  traceStartupDiagnostic('gas-account', event, data);
};

const traceGasAccountTask = async <T,>(
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

const GasAccountScreenContent = () => {
  const renderStartedAt = Date.now();
  const renderSeqRef = useRef(0);
  useFeatureActivationDiagnostics('gas-account');

  const { t } = useTranslation();
  const [depositState, setDepositState] = useState<{
    isOpen?: boolean;
    type?: 'token' | 'pay';
  }>({
    isOpen: false,
  });
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [loginVisible, setLoginVisible] = useGasAccountLoginVisible();
  const [emptyStateLoading, setEmptyStateLoading] = useState(false);

  const { styles, isLight } = useTheme2024({
    getStyle: getStyles,
  });
  const { safeOffHeader } = useSafeSizes();
  const {
    isLogin,
    gasAccount,
    runFetchGasAccountInfo,
    pendingHardwareAccount,
    pendingHardwareAddress,
    refreshPendingHardwareGasAccountInfo,
    displayBalance: gasBalance,
    isDisplayBalanceLoading,
  } = useGasAccountBalanceWithPendingHardware();
  const historyState = useGasAccountHistory();
  const focusDiagnosticsRef = useRef({
    isLogin,
    hasPendingHardwareAccount: !!pendingHardwareAccount,
    hasPendingHardwareAddress: !!pendingHardwareAddress,
    isDisplayBalanceLoading,
  });
  focusDiagnosticsRef.current = {
    isLogin,
    hasPendingHardwareAccount: !!pendingHardwareAccount,
    hasPendingHardwareAddress: !!pendingHardwareAddress,
    isDisplayBalanceLoading,
  };

  const { login } = useGasAccountMethods();
  const { claimGift, currentEligibleAddress, checkAddressesEligibility } =
    useGasAccountEligibility();
  const refreshPendingHardwareBalance = useMemoizedFn(() =>
    refreshPendingHardwareGasAccountInfo(),
  );

  const handleDeposit = useMemoizedFn((type?: 'token' | 'pay') => {
    setDepositState({
      isOpen: true,
      type,
    });
  });

  const withdrawable_balance = gasAccount?.account?.withdrawable_balance || 0;
  const nonWithdrawable_balance =
    gasAccount?.account?.non_withdrawable_balance || 0;
  const { setNavigationOptions } = useSafeSetNavigationOptions();

  const headerRight = useCallback(
    () => <GasAccountHeader showWithdraw={() => setShowWithdraw(true)} />,
    [setShowWithdraw],
  );

  useEffect(() => {
    setNavigationOptions({ headerRight: headerRight });
  }, [setNavigationOptions, headerRight]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      let accountBalanceRefreshTask: ReturnType<
        typeof InteractionManager.runAfterInteractions
      > | null = null;
      let accountBalanceRefreshTimer: ReturnType<typeof setTimeout> | null =
        null;
      storeApiGasAccount.setHistoryRefreshEnabled(true);
      traceGasAccount('focus_enter', {
        hasPendingHardwareAddress:
          focusDiagnosticsRef.current.hasPendingHardwareAddress,
      });

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

              traceGasAccountTask('refresh_accounts_balance', () =>
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
        Promise.allSettled([refreshSnapshotTask, refreshHistoryTask]).then(
          () => {
            if (!isActive) {
              return;
            }

            const diagnosticState = focusDiagnosticsRef.current;
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

      traceGasAccountTask(
        'refresh_pending_hardware_balance',
        refreshPendingHardwareBalance,
      ).catch(error => {
        console.error('refreshPendingHardwareGasAccountInfo error', error);
      });
    }, [pendingHardwareAddress, refreshPendingHardwareBalance]),
  );

  useFocusEffect(
    useCallback(() => {
      if (isLogin || pendingHardwareAccount) {
        return;
      }

      traceGasAccountTask('check_addresses_eligibility', () =>
        checkAddressesEligibility(),
      ).catch(error => {
        console.error(
          'checkAddressesEligibility on GasAccountScreen error',
          error,
        );
      });
    }, [checkAddressesEligibility, isLogin, pendingHardwareAccount]),
  );

  const showEmptyState =
    (!isLogin && !pendingHardwareAccount) ||
    (isLogin &&
      !historyState.loading &&
      gasBalance === 0 &&
      !historyState.hasHistory);

  useEffect(() => {
    renderSeqRef.current += 1;
    traceGasAccount('screen_render_commit', {
      seq: renderSeqRef.current,
      renderCommitMs: Date.now() - renderStartedAt,
      isLogin,
      showEmptyState,
      historyLoading: historyState.loading,
      hasHistory: historyState.hasHistory,
      confirmedCount: historyState.txList.list.length,
      rechargeCount: historyState.txList.rechargeList.length,
      withdrawCount: historyState.txList.withdrawList.length,
      isDisplayBalanceLoading,
      hasGasBalance: gasBalance > 0,
    });
  });
  const emptyStatePrimaryMode = getGasAccountEmptyStatePrimaryMode({
    isLogin,
    hasPendingHardwareAccount: !!pendingHardwareAccount,
    hasEligibleGiftAddress: !!currentEligibleAddress?.isEligible,
  });

  const handleEmptyStatePrimaryPress = useMemoizedFn(async () => {
    if (emptyStateLoading) {
      return;
    }

    if (
      emptyStatePrimaryMode === 'claimGift' &&
      currentEligibleAddress?.isEligible
    ) {
      setEmptyStateLoading(true);
      try {
        await claimGift(currentEligibleAddress.address);
        await runFetchGasAccountInfo();
        await storeApiGasAccount.refreshHistory();
      } catch (error) {
        console.error('handleEmptyStatePrimaryPress claimGift error', error);
        toast.error(t('page.gasAccount.loginFailed'));
      } finally {
        setEmptyStateLoading(false);
      }
      return;
    }

    handleDeposit();
  });

  const ensurePayGasAccountAddress = useMemoizedFn(async () => {
    if (gasAccount?.account?.id) {
      return gasAccount.account.id;
    }

    const { sortedAccounts } = await getAccountList({ filter: 'onlyMine' });
    const directlySignableAccounts =
      filterDirectlySignableAccounts(sortedAccounts);
    const targetAccount =
      directlySignableAccounts[0] || (sortedAccounts[0] as Account | undefined);

    if (!targetAccount) {
      throw new Error('No directly signable account available');
    }

    await login(targetAccount);
    const latest = await runFetchGasAccountInfo();
    await storeApiGasAccount.refreshHistory();
    return latest?.account?.id || targetAccount.address;
  });

  const handleOldUserStatePrimaryPress = useMemoizedFn(async () => {
    if (emptyStateLoading) {
      return;
    }

    if (!isLogin && pendingHardwareAccount) {
      setEmptyStateLoading(true);
      try {
        await login(pendingHardwareAccount as Account);
        await runFetchGasAccountInfo();
        await storeApiGasAccount.refreshHistory();
        toast.success(t('page.gasAccount.loginSuccess'));
      } catch (error) {
        console.error('handleOldUserStatePrimaryPress error', error);
        toast.error(t('page.gasAccount.loginFailed'));
      } finally {
        setEmptyStateLoading(false);
      }
      return;
    }

    handleDeposit();
  });

  const emptyStatePrimaryContent = useMemo(() => {
    if (
      emptyStatePrimaryMode !== 'claimGift' ||
      !currentEligibleAddress?.isEligible
    ) {
      return undefined;
    }

    return (
      <View style={styles.giftPrimaryButtonContent}>
        <IconGift width={18} height={18} />
        <Text style={styles.giftPrimaryButtonText}>
          {`Claim ${formatUsdValue(
            currentEligibleAddress.giftUsdValue,
          )} Free Gas`}
        </Text>
      </View>
    );
  }, [
    currentEligibleAddress?.giftUsdValue,
    currentEligibleAddress?.isEligible,
    emptyStatePrimaryMode,
    styles.giftPrimaryButtonContent,
    styles.giftPrimaryButtonText,
  ]);

  return (
    <NormalScreenContainer
      type={isLight ? 'bg0' : 'bg1'}
      bgImageSource={GasHeaderBg}
      bgImageResizeMode="cover"
      bgImageHeight={safeOffHeader + 64}>
      {showEmptyState ? (
        <GasAccountEmptyState
          primaryLoading={emptyStateLoading}
          onPrimaryPress={handleEmptyStatePrimaryPress}
          primaryType={
            emptyStatePrimaryMode === 'claimGift' ? 'success' : 'primary'
          }
          primaryContent={emptyStatePrimaryContent}
          primaryContainerStyle={
            emptyStatePrimaryMode === 'claimGift'
              ? styles.giftPrimaryButtonContainer
              : undefined
          }
        />
      ) : (
        <GasAccountUserState
          balance={gasBalance}
          historyState={historyState}
          onDepositPress={handleOldUserStatePrimaryPress}
          isLoading={emptyStateLoading}
        />
      )}

      {depositState.isOpen ? (
        <GasAccountDepositPopup
          visible={depositState.isOpen}
          type={depositState.type}
          gasAccountAddress={gasAccount?.account?.id}
          onEnsurePayGasAccountAddress={ensurePayGasAccountAddress}
          onDeposit={async () => {
            setDepositState({
              isOpen: false,
            });
            await storeApiGasAccount.refreshHistory();
            await runFetchGasAccountInfo();
            toast.success(t('page.gasAccount.depositSubmitted'), {
              position: toast.positions.CENTER,
            });
          }}
          onClose={() => {
            setDepositState({
              isOpen: false,
            });
          }}
        />
      ) : null}

      <WithDrawPopup
        visible={showWithdraw}
        balance={withdrawable_balance}
        nonWithdrawableBalance={nonWithdrawable_balance}
        onCancel={() => setShowWithdraw(false)}
      />

      <GasAccountLoginPopup
        visible={loginVisible}
        onClose={() => {
          setLoginVisible(false);
        }}
        onLogin={async () => {
          await storeApiGasAccount.refreshHistory();
          await runFetchGasAccountInfo();
          setLoginVisible(false);
        }}
      />
    </NormalScreenContainer>
  );
};

export const GasAccountScreen = withGasAccountService(GasAccountScreenContent, {
  fallback: <View />,
});

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  giftPrimaryButtonContainer: {
    shadowColor: colors2024['brand-default'],
    shadowOpacity: 0.1,
    shadowRadius: 24,
    shadowOffset: {
      width: 0,
      height: 8,
    },
  },
  giftPrimaryButtonText: {
    color: colors2024['neutral-InvertHighlight'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 22,
  },
  giftPrimaryButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
}));
