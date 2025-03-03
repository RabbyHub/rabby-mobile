import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import { toast } from '@/components2024/Toast';
import { useTheme2024 } from '@/hooks/theme';
import { useLastUsedAccountInScreen } from '@/hooks/useLastUsedAccountInScreen';
import { createGetStyles2024 } from '@/utils/styles';
import { useMemoizedFn } from 'ahooks';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { trigger } from 'react-native-haptic-feedback';
import { GasAccountCard } from './components/GasAccountCard';
import { GasAccountDepositPopup } from './components/GasAccountDepositPopup';
import { GasAccountLoginPopup } from './components/GasAccountLoginPopup';
import { GasAccountLogoutPopup } from './components/GasAccountLogoutPopup';
import { GasAccountHeader } from './components/HeaderRight';
import { GasAccountHistory } from './components/History';
import { SwitchLoginAddrBeforeDepositModal } from './components/SwitchLoginAddrModal';
import { WithDrawPopup } from './components/WithDrawPopup';
import { useGasAccountInfo, useGasAccountLogin } from './hooks';
import {
  useGasAccountLoginVisible,
  useGasAccountLogoutVisible,
} from './hooks/atom';

export const GasAccountScreen = () => {
  useLastUsedAccountInScreen();

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

  const { styles } = useTheme2024({ getStyle: getStyles });
  const {
    value: gasAccount,
    loading,
    runFetchGasAccountInfo,
  } = useGasAccountInfo();

  const handleDeposit = useMemoizedFn((type?: 'token' | 'pay') => {
    setDepositState({
      isOpen: true,
      type,
    });
    trigger('impactLight', {
      enableVibrateFallback: true,
      ignoreAndroidSystemSettings: false,
    });
  });

  const handleWithdraw = useMemoizedFn(() => {
    setShowWithdraw(true);
    trigger('impactLight', {
      enableVibrateFallback: true,
      ignoreAndroidSystemSettings: false,
    });
  });

  const { isLogin } = useGasAccountLogin({ value: gasAccount, loading });

  const balance = gasAccount?.account?.balance || 0;

  const [logoutPopupVisible, setLogoutPopupVisible] =
    useGasAccountLogoutVisible();

  const { setNavigationOptions } = useSafeSetNavigationOptions();

  const headerRight = useCallback(
    () => (isLogin ? <GasAccountHeader /> : null),
    [isLogin],
  );

  useEffect(() => {
    setNavigationOptions({ headerRight: headerRight });
  }, [setNavigationOptions, headerRight]);

  return (
    <NormalScreenContainer>
      <GasAccountCard
        // isLoading={loading}
        isLogin={isLogin}
        gasAccountInfo={gasAccount?.account}
        onLoginPress={() => {
          setLoginVisible(true);
        }}
        onDepositPress={handleDeposit}
        onWithdrawPress={handleWithdraw}
      />

      <GasAccountHistory />

      {gasAccount?.account.id ? (
        <GasAccountDepositPopup
          visible={depositState.isOpen}
          type={depositState.type}
          gasAccountAddress={gasAccount.account.id}
          onDeposit={async () => {
            await runFetchGasAccountInfo();
            setDepositState({
              isOpen: false,
            });
            toast.success(t('page.gasAccount.depositSuccess'), {
              position: toast.positions.CENTER,
            });
          }}
          onCancel={() => {
            setDepositState({
              isOpen: false,
            });
          }}
        />
      ) : null}

      <WithDrawPopup
        visible={showWithdraw}
        balance={balance}
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

      <GasAccountLogoutPopup
        visible={logoutPopupVisible}
        onClose={() => {
          setLogoutPopupVisible(false);
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
}));
