import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import { createGetStyles2024 } from '@/utils/styles';
import { Pressable, Text, View } from 'react-native';
import {
  useAml,
  useGasAccountGoBack,
  useGasAccountInfo,
  useGasAccountLogin,
} from './hooks';
import { formatUsdValue } from '@/utils/number';
import { useTheme2024 } from '@/hooks/theme';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { WithDrawPopup } from './components/WithDrawPopup';
import RcIconGasAccountBalance from '@/assets/icons/gas-account/balance-acount.svg';
import { GasAccountHistory } from './components/History';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { GasAccountHeader } from './components/HeaderRight';
import {
  useGasAccountLoginVisible,
  useGasAccountLogoutVisible,
} from './hooks/atom';
import { GasAccountWrapperBg } from './components/WrapperBg';
import { SwitchLoginAddrBeforeDepositModal } from './components/SwitchLoginAddrModal';
import { useLastUsedAccountInScreen } from '@/hooks/useLastUsedAccountInScreen';
import { Button } from '@/components2024/Button';
import { trigger } from 'react-native-haptic-feedback';
import { toast } from '@/components2024/Toast';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { GasAccountCard } from './components/GasAccountCard';
import { GasAccountLoginPopup } from './components/GasAccountLoginPopup';
import { GasAccountLogoutPopup } from './components/GasAccountLogoutPopup';
import { useMemoizedFn } from 'ahooks';
import { GasAccountDepositPopup } from './components/GasAccountDepositPopup';

const DEPOSIT_LIMIT = 1000;

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
  const { value: gasAccount, loading } = useGasAccountInfo();

  const handleDeposit = useMemoizedFn((type?: 'token' | 'pay') => {
    if (canDeposit) {
      setDepositState({
        isOpen: true,
        type,
      });
      trigger('impactLight', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
    }
  });

  const handleWithdraw = useMemoizedFn(() => {
    setShowWithdraw(true);
    trigger('impactLight', {
      enableVibrateFallback: true,
      ignoreAndroidSystemSettings: false,
    });
  });

  const { isLogin } = useGasAccountLogin({ value: gasAccount, loading });

  const isRisk = useAml();

  const balance = gasAccount?.account?.balance || 0;

  const canDeposit = useMemo(
    () => !isRisk && balance < DEPOSIT_LIMIT,
    [balance, isRisk],
  );

  const [logoutPopupVisible, setLogoutPopupVisible] =
    useGasAccountLogoutVisible();

  const { setNavigationOptions } = useSafeSetNavigationOptions();

  const headerRight = useCallback(() => <GasAccountHeader />, []);

  const handleDepositTips = useCallback(() => {
    if (!canDeposit) {
      const modalId = createGlobalBottomSheetModal2024({
        name: MODAL_NAMES.DESCRIPTION,
        title: 'why cant i deposit?',
        sections: [
          {
            description: isRisk
              ? t('page.gasAccount.risk')
              : t('page.gasAccount.gasExceed'),
          },
        ],
        bottomSheetModalProps: {
          enableContentPanningGesture: true,
          enablePanDownToClose: true,
          enableDismissOnClose: true,
          snapPoints: [300],
        },
        nextButtonProps: {
          title: (
            <Text style={styles.closeModalBtnText}>
              {t('page.tokenDetail.excludeBalanceTipsButton')}
            </Text>
          ),
          titleStyle: styles.tipTitle,
          onPress: () => {
            removeGlobalBottomSheetModal2024(modalId);
          },
        },
      });
    }
  }, [canDeposit, isRisk, t, styles.closeModalBtnText, styles.tipTitle]);

  useEffect(() => {
    setNavigationOptions({ headerRight: headerRight });
  }, [setNavigationOptions, headerRight]);

  useEffect(() => {
    if (!loading && !isLogin) {
      // setLoginVisible(true);
    }
  }, [loading, isLogin, setLoginVisible]);

  return (
    <NormalScreenContainer>
      <GasAccountCard
        isLoading={loading}
        isLogin={isLogin}
        gasAccountInfo={gasAccount?.account}
        onLoginPress={() => {
          setLoginVisible(true);
        }}
        onDepositPress={handleDeposit}
        onWithdrawPress={handleWithdraw}
      />

      <GasAccountHistory />

      <GasAccountDepositPopup
        visible={depositState.isOpen}
        type={depositState.type}
        onCancel={() => {
          setDepositState({
            isOpen: false,
          });
        }}
      />

      <WithDrawPopup
        visible={showWithdraw}
        balance={balance}
        onCancel={() => setShowWithdraw(false)}
      />

      <GasAccountLoginPopup
        visible={loginVisible}
        onCancel={() => {
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
