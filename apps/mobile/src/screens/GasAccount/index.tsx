import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { Text } from '@/components/Typography';
import { toast } from '@/components2024/Toast';
import IconGift from '@/assets2024/icons/gas-account/gift-01.svg';
import {
  filterDirectlySignableAccounts,
  getAccountList,
} from '@/core/apis/account';
import { useGasAccountEligibility } from '@/hooks/useGasAccountEligibility';
import { Account } from '@/core/services/preference';
import { useTheme2024 } from '@/hooks/theme';
import { useFocusEffect } from '@react-navigation/native';
import { useAccountInfo } from '@/screens/Address/components/MultiAssets/hooks';
import useTokenList from '@/store/tokens';
import { formatUsdValue } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import { useMemoizedFn } from 'ahooks';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { GasAccountDepositPopup } from './components/GasAccountDepositPopup';
import { GasAccountLoginPopup } from './components/GasAccountLoginPopup';
import { GasAccountHeader } from './components/HeaderRight';
import { SwitchLoginAddrBeforeDepositModal } from './components/SwitchLoginAddrModal';
import { WithDrawPopup } from './components/WithDrawPopup';
import { useGasAccountInfo, useGasAccountLogin } from './hooks';
import {
  storeApiGasAccountDeposit,
  storeApiGasAccount,
  useGasAccountLoginVisible,
  usePendingHardwareAccount,
} from './hooks/atom';
import NormalScreenContainer from '@/components2024/ScreenContainer/NormalScreenContainer';
import { refreshAccountsWithGasAccountBalance } from '@/utils/autoLoginGasAccount';
import { GasAccountEmptyState } from './components/GasAccountEmptyState';
import { getGasAccountEmptyStatePrimaryMode } from './components/GasAccountEmptyState.utils';
import { GasAccountOldUserState } from './components/GasAccountOldUserState';
import { useGasAccountHistory, useGasAccountMethods } from './hooks';

export const GasAccountScreen = () => {
  const { t } = useTranslation();
  const [depositState, setDepositState] = useState<{
    isOpen?: boolean;
    type?: 'token' | 'pay';
  }>({
    isOpen: false,
  });
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [loginVisible, setLoginVisible] = useGasAccountLoginVisible();

  const [switchAddrVisible, setSwitchAddrVisible] = useState(false);
  const [emptyStateLoading, setEmptyStateLoading] = useState(false);

  const { styles, colors2024, isLight } = useTheme2024({
    getStyle: getStyles,
  });
  const {
    value: gasAccount,
    loading,
    runFetchGasAccountInfo,
  } = useGasAccountInfo();
  const historyState = useGasAccountHistory();
  const { myTop10Addresses } = useAccountInfo();

  const { login } = useGasAccountMethods();
  const { claimGift, currentEligibleAddress, checkAddressesEligibility } =
    useGasAccountEligibility();

  const pendingHardwareAccount = usePendingHardwareAccount();

  const handleDeposit = useMemoizedFn((type?: 'token' | 'pay') => {
    setDepositState({
      isOpen: true,
      type,
    });
  });

  const { isLogin } = useGasAccountLogin();
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
      storeApiGasAccount.markSnapshotDirty('gasaccount_screen_focus');
      storeApiGasAccount
        .refreshSnapshot({
          reason: 'gasaccount_screen_focus',
          force: true,
        })
        .catch(error => {
          console.error(
            'refreshSnapshot on GasAccountScreen focus error',
            error,
          );
        });
      refreshAccountsWithGasAccountBalance().catch(error => {
        console.error('refreshAccountsWithGasAccountBalance error', error);
      });
    }, []),
  );

  useFocusEffect(
    useCallback(() => {
      Promise.allSettled([
        myTop10Addresses.length
          ? useTokenList.getState().batchGetTokenList(myTop10Addresses)
          : Promise.resolve(),
        storeApiGasAccountDeposit.fetchBridgeSupportTokenList(),
      ]).catch(error => {
        console.error('prefetchGasAccountDepositData error', error);
      });
    }, [myTop10Addresses]),
  );

  useFocusEffect(
    useCallback(() => {
      if (isLogin || pendingHardwareAccount) {
        return;
      }

      checkAddressesEligibility().catch(error => {
        console.error(
          'checkAddressesEligibility on GasAccountScreen error',
          error,
        );
      });
    }, [checkAddressesEligibility, isLogin, pendingHardwareAccount]),
  );

  const gasBalance = Number(gasAccount?.account?.balance || 0);
  const hasHistory = Boolean(
    historyState.txList?.rechargeList.length ||
      historyState.txList?.withdrawList.length ||
      historyState.txList?.list.length,
  );
  const showEmptyState =
    (!isLogin && !pendingHardwareAccount) ||
    (isLogin && !historyState.loading && gasBalance === 0 && !hasHistory);
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
        await storeApiGasAccount.refreshHistory('claim_gift');
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
    const targetAccount = directlySignableAccounts[0] as Account | undefined;

    if (!targetAccount) {
      throw new Error('No directly signable account available');
    }

    await login(targetAccount);
    const latest = await runFetchGasAccountInfo();
    await storeApiGasAccount.refreshHistory('login');
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
        await storeApiGasAccount.refreshHistory('login');
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

  const linearProp = useMemo(
    () => ({
      colors: [
        'rgba(68, 94, 255, 0.20)',
        'rgba(68, 94, 255, 0.00)',
        // colors2024['neutral-bg-0'],
        isLight ? colors2024['neutral-bg-0'] : colors2024['neutral-bg-1'],
      ],
      locations: [0, 0.1829, 1],
      start: { x: 0, y: 0 },
      end: { x: 0, y: 1 },
    }),
    [colors2024, isLight],
  );
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
      type="linear"
      // overwriteStyle={styles.container}
      linearProp={linearProp}>
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
        <GasAccountOldUserState
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
            await storeApiGasAccount.refreshHistory('deposit_submitted');
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
          await runFetchGasAccountInfo();
          setLoginVisible(false);
        }}
      />

      <SwitchLoginAddrBeforeDepositModal
        visible={switchAddrVisible}
        onCancel={() => setSwitchAddrVisible(false)}
      />
    </NormalScreenContainer>
  );
};

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  containerLight: {
    backgroundColor: colors2024['neutral-bg-0'],
  },
  containerDark: {
    backgroundColor: colors2024['neutral-bg-1'],
  },
  accountContainer: {
    height: 296,
    paddingVertical: 34,
    paddingHorizontal: 20,
    marginHorizontal: 20,
    borderRadius: 30,
    backgroundColor: colors2024['neutral-bg-1'],
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
  },
  accountFooter: {
    marginTop: 'auto',
    flexDirection: 'row',
    gap: 16,
    width: '100%',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: '100%',
  },
  balanceText: {
    color: colors2024['neutral-title-1'],
    textAlign: 'center',
    fontFamily: 'SF Pro',
    fontSize: 32,
    fontStyle: 'normal',
    fontWeight: '700',
  },

  acountIcon: {
    width: 60,
    height: 60,
    marginVertical: 14,
  },

  btnTitle: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    fontStyle: 'normal',
    fontWeight: '600',
  },

  tipTitle: {
    fontSize: 17,
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-body'],
  },
  closeModalBtnText: {
    fontSize: 20,
    color: colors2024['neutral-InvertHighlight'],
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
  },
  toastStyle: {
    color: colors2024['neutral-title-2'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 20,
  },
  giftPrimaryButtonContainer: {
    shadowColor: '#7084ff',
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
