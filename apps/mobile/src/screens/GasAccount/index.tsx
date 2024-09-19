import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import { createGetStyles } from '@/utils/styles';
import { Text, View } from 'react-native';
import {
  useGasAccountGoBack,
  useGasAccountInfo,
  useGasAccountLogin,
} from './hooks';
import { formatUsdValue } from '@/utils/number';
import { useThemeColors } from '@/hooks/theme';
import { Tip } from '@/components/Tip';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GasAccountDepositPopup } from './components/DepositPopup';
import { WithDrawPopup } from './components/WithDrawPopup';
import { Button } from '@/components/Button';
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

const DEPOSIT_LIMIT = 1000;

export const GasAccountScreen = () => {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const [showDesposit, setShowDesposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [loginVisible, setLoginVisible] = useGasAccountLoginVisible();

  const styles = useMemo(() => getStyles(colors), [colors]);
  const { value, loading } = useGasAccountInfo();

  const usd = useMemo(() => {
    if (value && 'account' in value) {
      return formatUsdValue(value.account.balance);
    }
    return formatUsdValue(0);
  }, [value]);

  const gotoDashboard = useGasAccountGoBack();

  const gotoDesposit = () => {
    setShowDesposit(true);
  };

  const { isLogin } = useGasAccountLogin({ value, loading });

  const balance = value?.account?.balance || 0;

  const canDesposit = useMemo(() => balance < DEPOSIT_LIMIT, [balance]);

  const [logoutPopupVisible, setLogoutPopupVisible] =
    useGasAccountLogoutVisible();

  const { setNavigationOptions } = useSafeSetNavigationOptions();

  const headerRight = useCallback(() => <GasAccountHeader />, []);

  useEffect(() => {
    setNavigationOptions({ headerRight: headerRight });
  }, [setNavigationOptions, headerRight]);

  useEffect(() => {
    if (!isLogin) {
      setLoginVisible(true);
    }
  }, [isLogin, setLoginVisible]);

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
          <View
            style={{
              flex: 1,
            }}>
            <Button
              type="white"
              ghost
              onPress={() => setShowWithdraw(true)}
              buttonStyle={[styles.whiteBtn, styles.buttonContainer]}
              title={t('component.gasAccount.withdraw')}
            />
          </View>
          <View
            style={{
              flex: 1,
            }}>
            <Tip
              placement="top"
              content={
                !canDesposit ? t('component.gasAccount.gasExceed') : undefined
              }>
              <Button
                type="primary"
                buttonStyle={styles.buttonContainer}
                onPress={() => canDesposit && gotoDesposit()}
                disabled={!canDesposit}
                title={t('component.gasAccount.deposit')}
              />
            </Tip>
          </View>
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
    </NormalScreenContainer>
  );
};

const getStyles = createGetStyles(colors => ({
  accountContainer: {
    height: 320,
    paddingVertical: 20,
    paddingHorizontal: 16,
    marginHorizontal: 20,
    borderRadius: 8,
    backgroundColor: colors['neutral-card-1'],
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: 20,
  },
  accountFooter: {
    marginTop: 'auto',
    flexDirection: 'row',
    gap: 16,
    width: '100%',
  },
  content: {
    height: 205,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  balanceText: {
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 38,
    color: colors['neutral-title1'],
  },
  historyContainer: {
    display: 'flex',
    gap: 8,
    flexDirection: 'column',
    alignItems: 'center',
    alignSelf: 'stretch',
    height: 531,
    padding: 12,
    marginHorizontal: 20,
    borderRadius: 8,
    backgroundColor: colors['neutral-card-1'],
  },
  acountIcon: {
    width: 60,
    height: 60,
    marginBottom: 24,
  },
  historyIcon: {
    marginTop: 120,
    width: 28,
    height: 28,
    marginBottom: 8,
  },
  historyText: {
    color: colors['neutral-foot'],
    fontWeight: '500',
    fontSize: 13,
  },
  buttonContainer: {
    height: 48,
  },

  whiteBtn: {
    borderWidth: 1,
    borderColor: colors['blue-default'],
  },
}));
