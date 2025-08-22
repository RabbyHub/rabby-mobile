import { RcTradPerps } from '@/assets2024/icons/perps';
import { Button } from '@/components2024/Button';
import { useTheme2024 } from '@/hooks/theme';
import { GasAccountWrapperBg } from '@/screens/GasAccount/components/WrapperBg';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

export const PerpsAccountCard = () => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  const isLogin = true; // Replace with actual login state
  if (isLogin) {
    return (
      <View style={[styles.card, styles.balanceCard]}>
        <View style={styles.balanceCardContent}>
          <Text style={styles.balance}>${100}</Text>
          <Text style={styles.availableBalance}>
            {t('page.perps.PerpsCard.available')}: $0.00
          </Text>
        </View>
        <View style={styles.balanceCardBtns}>
          <View style={styles.btnItem}>
            <Button
              type="ghost"
              onPress={() => {}}
              title={t('page.perps.PerpsCard.withdrawBtn')}
            />
          </View>
          <View style={styles.btnItem}>
            <Button
              type="primary"
              onPress={() => {}}
              title={t('page.perps.PerpsCard.depositBtn')}
            />
          </View>
        </View>
      </View>
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
          onPress={() => {}}
          title={t('page.perps.PerpsCard.loginBtn')}
        />
        <Button
          onPress={() => {}}
          buttonStyle={styles.learnBtn}
          titleStyle={styles.learnBtnTitle}
          title={t('page.perps.PerpsCard.learnBtn')}
        />
      </View>
    </GasAccountWrapperBg>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  card: {
    borderRadius: 16,
    backgroundColor: colors2024['neutral-bg-1'],
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
  loginCardTitle: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800',
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
    // fontFamily: 'SF Pro Rounded',
    // fontSize: 16,
    // lineHeight: 20,
    // fontWeight: '600',
    // color: colors2024['neutral-title-1'],
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
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
  balanceCard: {
    paddingTop: 24,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  balanceCardContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 5,
    marginBottom: 32,
  },
  balance: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 40,
    lineHeight: 48,
    fontWeight: '800',
    color: colors2024['neutral-title-1'],
  },
  availableBalance: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '400',
    color: colors2024['neutral-foot'],
  },
  balanceCardBtns: {
    display: 'flex',
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  btnItem: {
    flex: 1,
    width: '50%',
  },
}));
