import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { RcIconQuoteEnd, RcIconQuoteStart } from '@/assets/icons/gas-account';
import { Button } from '@/components2024/Button';
import { GasAccountWrapperBg } from '../components/WrapperBg';
import { GasAccountBlueLogo } from './GasAccountBlueLogo';

interface Props {
  onLoginPress?(): void;
}
export const GasAccountLoginCard: React.FC<Props> = ({ onLoginPress }) => {
  const { t } = useTranslation();

  const { styles } = useTheme2024({ getStyle });

  return (
    <GasAccountWrapperBg style={styles.loginContainer}>
      <GasAccountBlueLogo style={styles.logo} />
      <View style={styles.quoteContainer}>
        <RcIconQuoteStart style={styles.quoteStart} />
        <Text style={styles.loginTip}>
          {t('component.gasAccount.loginInTip.title')}
        </Text>
      </View>
      <View style={styles.quoteContainer}>
        <Text style={styles.loginDesc}>
          {t('component.gasAccount.loginInTip.desc')}
        </Text>
        <RcIconQuoteEnd style={styles.quoteEnd} />
      </View>
      <View style={styles.buttonContainer}>
        <Button
          containerStyle={styles.confirmButton}
          onPress={onLoginPress}
          type="primary"
          title={t('component.gasAccount.loginInTip.login')}
        />
      </View>
    </GasAccountWrapperBg>
  );
};

const getStyle = createGetStyles2024(({ colors2024, colors }) => ({
  buttonContainer: {
    gap: 12,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors['neutral-bg1'],
  },
  confirmButton: {
    width: '100%',
    height: 52,
  },
  loginContainer: {
    paddingTop: 34,
    paddingBottom: 20,
    paddingHorizontal: 16,
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
  logo: {
    width: 50,
    height: 50,
    marginBottom: 34,
  },
  loginTip: {
    color: colors2024['brand-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontStyle: 'normal',
    fontWeight: '700',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  loginDesc: {
    color: colors2024['brand-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontStyle: 'normal',
    fontWeight: '700',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 32,
  },
  popupBody: {
    padding: 0,
  },
  quoteContainer: {
    position: 'relative',
    // marginBottom: 16,
  },
  quoteEnd: {
    position: 'absolute',
    top: 2,
    right: -20,
  },
  quoteStart: {
    position: 'absolute',
    top: 2,
    left: -20,
  },
}));
