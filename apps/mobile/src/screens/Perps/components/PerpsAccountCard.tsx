import { RcTradPerps } from '@/assets2024/icons/perps';
import RcIconPerps from '@/assets2024/icons/perps/IconPerps.svg';
import { Button } from '@/components2024/Button';
import {
  AccountSummary,
  PositionAndOpenOrder,
} from '@/hooks/perps/usePerpsStore';
import { useTheme2024 } from '@/hooks/theme';
import { GasAccountWrapperBg } from '@/screens/GasAccount/components/WrapperBg';
import { formatUsdValue, splitNumberByStep } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { usePerpsPopupState } from '../hooks/usePerpsPopupState';
import { Account } from '@/core/services/preference';

export const PerpsAccountCard: React.FC<{
  isLogin: boolean;
  accountSummary?: AccountSummary | null;
  positionAndOpenOrders?: PositionAndOpenOrder[] | null;
}> = ({ isLogin, accountSummary, positionAndOpenOrders }) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const [popupState, setPopupState] = usePerpsPopupState();

  const positionAllPnl = useMemo(() => {
    return (
      positionAndOpenOrders?.reduce((acc, asset) => {
        return acc + Number(asset.position.unrealizedPnl || 0);
      }, 0) || 0
    );
  }, [positionAndOpenOrders]);

  const withdrawDisabled = useMemo(
    () => !Number(accountSummary?.withdrawable || 0),
    [accountSummary?.withdrawable],
  );

  if (isLogin) {
    return (
      <LinearGradient
        colors={['#0F2F3A', '#041920']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.card, styles.balanceCard]}>
        <View style={styles.balanceCardInner}>
          <View style={styles.balanceCardContent}>
            <RcIconPerps style={styles.relativeIcon} />
            <View style={styles.balanceCardContentLeft}>
              <Text style={styles.balance}>
                {formatUsdValue(Number(accountSummary?.accountValue || 0))}
              </Text>
              {positionAndOpenOrders?.length ? (
                <Text
                  style={[
                    styles.pnl,
                    positionAllPnl >= 0 ? styles.pnlGreen : styles.pnlRed,
                  ]}>
                  {positionAllPnl >= 0 ? '+' : '-'}$
                  {splitNumberByStep(Math.abs(positionAllPnl).toFixed(2))}
                </Text>
              ) : null}
            </View>
            <Text style={styles.availableBalance}>
              {t('page.perps.PerpsCard.available')}:{' '}
              {formatUsdValue(Number(accountSummary?.withdrawable))}
            </Text>
          </View>
          <View style={styles.balanceCardBtns}>
            <View style={styles.btnItem}>
              <Button
                type="ghost"
                onPress={() => {
                  setPopupState(prev => ({
                    ...prev,
                    isShowWithdrawPopup: true,
                  }));
                }}
                titleStyle={styles.smBtnTitle}
                title={t('page.perps.PerpsCard.withdrawBtn')}
                buttonStyle={[styles.withdrawBtn, styles.btnHeight]}
                disabled={withdrawDisabled}
              />
            </View>
            <View style={styles.btnItem}>
              <Button
                type="primary"
                onPress={() => {
                  setPopupState(prev => ({
                    ...prev,
                    isShowDepositTokenPopup: true,
                  }));
                }}
                titleStyle={styles.smBtnTitle}
                title={t('page.perps.PerpsCard.depositBtn')}
                buttonStyle={[styles.btnHeight]}
              />
            </View>
          </View>
        </View>
      </LinearGradient>
    );
  }

  return (
    <GasAccountWrapperBg style={[styles.card, styles.loginCard]}>
      <View style={styles.loginCardContent}>
        <RcTradPerps style={styles.icon} />
        <Text style={styles.loginCardTitle}>
          {t('page.perps.PerpsCard.title')}
        </Text>
        <Text style={styles.loginCardDesc}>
          {t('page.perps.PerpsCard.loginDesc')}
        </Text>
      </View>
      <View style={styles.loginCardBtns}>
        <Button
          type="primary"
          onPress={() => {
            setPopupState(prev => ({
              ...prev,
              isShowLoginPopup: true,
            }));
          }}
          titleStyle={styles.btnTitle}
          title={t('page.perps.PerpsCard.loginBtn')}
        />
        <Button
          onPress={() => {
            setPopupState(prev => ({
              ...prev,
              isShowGuidePopup: true,
            }));
          }}
          buttonStyle={styles.learnBtn}
          titleStyle={styles.learnBtnTitle}
          title={t('page.perps.PerpsCard.learnBtn')}
        />
      </View>
    </GasAccountWrapperBg>
  );
};

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  card: {
    borderRadius: 16,
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
  },
  loginCard: {
    paddingTop: 10,
    paddingBottom: 20,
    paddingHorizontal: 16,
    borderRadius: 16,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: 12,
  },
  icon: {
    width: 20,
    height: 20,
  },
  relativeIcon: {
    position: 'absolute',
    top: 0,
    right: 0,
  },
  loginCardTitle: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '900',
    color: colors2024['neutral-title-1'],
    textAlign: 'center',
  },
  loginCardDesc: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '400',
    color: colors2024['neutral-secondary'],
    textAlign: 'center',
  },
  btnTitle: {
    fontSize: 17,
    lineHeight: 22,
  },
  smBtnTitle: {
    fontSize: 18,
    lineHeight: 22,
    color: '#F7FAFC',
  },
  withdrawBtn: {
    backgroundColor: '#2F3135',
    borderColor: 'transparent',
  },
  btnHeight: {
    height: 52,
  },
  loginCardContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  loginCardBtns: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    width: '100%',
    marginTop: 'auto',
  },
  learnBtn: {
    backgroundColor: colors2024['neutral-line'],
  },
  learnBtnTitle: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
  balanceCard: {
    marginTop: 12,
    borderRadius: 16,
    padding: 2, // gradient border width
  },
  balanceCardInner: {
    borderRadius: 14,
    paddingTop: 20,
    paddingHorizontal: 16,
    paddingBottom: 20,
    backgroundColor: '#0E1A1E',
  },
  balanceCardContent: {
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    // alignItems: 'center',
    // minHeight: 93,
    marginBottom: 14,
  },
  balanceCardContentLeft: {
    display: 'flex',
    gap: 4,
    flexDirection: 'row',
    // justifyContent: 'space-between',
    alignItems: 'center',
  },
  balance: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '900',
    color: '#F7FAFC',
  },
  pnl: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    marginTop: 0,
  },
  pnlRed: {
    color: colors2024['red-default'],
  },
  pnlGreen: {
    color: colors2024['green-default'],
  },
  availableBalance: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '400',
    color: '#717380',
    marginTop: 4,
  },
  balanceCardBtns: {
    display: 'flex',
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    width: '100%',
  },
  btnItem: {
    flex: 1,
    width: '50%',
  },
}));
