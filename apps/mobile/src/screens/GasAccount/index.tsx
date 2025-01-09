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
import { GasAccountDepositPopup } from './components/DepositPopup';
import { WithDrawPopup } from './components/WithDrawPopup';
import RcIconGasAccountBalance from '@/assets/icons/gas-account/balance-acount.svg';
import { GasAccountHistory } from './components/History';
import { GasAccountLoginPopup } from './components/LoginPopup';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { GasAccountHeader } from './components/HeaderRight';
import GasAccountLogoutPopup from './components/LogoutPopup';
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

const DEPOSIT_LIMIT = 1000;

export const GasAccountScreen = () => {
  useLastUsedAccountInScreen();

  const { t } = useTranslation();
  const [showDesposit, setShowDesposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [loginVisible, setLoginVisible] = useGasAccountLoginVisible();

  const [switchAddrVisible, setSwitchAddrVisible] = useState(false);

  const { styles } = useTheme2024({ getStyle: getStyles });
  const { value, loading } = useGasAccountInfo();

  const usd = useMemo(() => {
    if (value && 'account' in value) {
      return formatUsdValue(value.account.balance);
    }
    return formatUsdValue(0);
  }, [value]);

  const gotoDashboard = useGasAccountGoBack();

  const gotoDesposit = useCallback(() => {
    setShowDesposit(true);
  }, []);

  const { isLogin } = useGasAccountLogin({ value, loading });

  const isRisk = useAml();

  const balance = value?.account?.balance || 0;

  const canDesposit = useMemo(
    () => !isRisk && balance < DEPOSIT_LIMIT,
    [balance, isRisk],
  );

  const [logoutPopupVisible, setLogoutPopupVisible] =
    useGasAccountLogoutVisible();

  const { setNavigationOptions } = useSafeSetNavigationOptions();

  const headerRight = useCallback(() => <GasAccountHeader />, []);

  const handleDepositTips = useCallback(() => {
    if (!canDesposit) {
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
  }, [canDesposit, isRisk, t, styles.closeModalBtnText, styles.tipTitle]);

  useEffect(() => {
    setNavigationOptions({ headerRight: headerRight });
  }, [setNavigationOptions, headerRight]);

  useEffect(() => {
    if (!loading && !isLogin) {
      setLoginVisible(true);
    }
  }, [loading, isLogin, setLoginVisible]);

  return (
    <NormalScreenContainer>
      <GasAccountWrapperBg style={styles.accountContainer}>
        <View style={styles.content}>
          <RcIconGasAccountBalance style={styles.acountIcon} />
          <Text style={styles.balanceText}>{usd}</Text>
        </View>
        <View style={styles.accountFooter}>
          <Pressable
            style={{
              flex: 1,
            }}
            onPress={() => {
              if (!balance) {
                toast.show(t('page.gasAccount.noBalance'), {
                  position: toast.positions.CENTER,
                });
                return;
              }
            }}>
            <Button
              type="ghost"
              onPress={() => {
                setShowWithdraw(true);
                trigger('impactLight', {
                  enableVibrateFallback: true,
                  ignoreAndroidSystemSettings: false,
                });
              }}
              titleStyle={styles.btnTitle}
              title={t('page.gasAccount.withdraw')}
              disabled={!balance}
            />
          </Pressable>
          <Pressable
            style={{
              flex: 1,
            }}
            onPress={handleDepositTips}>
            <Button
              type="primary"
              onPress={() => {
                if (canDesposit) {
                  gotoDesposit();
                  trigger('impactLight', {
                    enableVibrateFallback: true,
                    ignoreAndroidSystemSettings: false,
                  });
                }
              }}
              titleStyle={styles.btnTitle}
              disabled={!canDesposit}
              title={t('component.gasAccount.deposit')}
            />
          </Pressable>
        </View>
      </GasAccountWrapperBg>

      <GasAccountHistory />

      <GasAccountDepositPopup
        visible={showDesposit}
        onCancel={() => setShowDesposit(false)}
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
          if (!isLogin) {
            gotoDashboard();
          }
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
}));
