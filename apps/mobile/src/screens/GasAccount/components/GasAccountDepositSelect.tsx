import {
  RcIconApplePayCC,
  RcIconGooglePayCC,
} from '@/assets2024/icons/gas-account';
import { Button } from '@/components2024/Button';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Text, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

export const GasAccountDepositSelect: React.FC<{
  onSelect(type: 'token' | 'pay'): void;
}> = ({ onSelect }) => {
  const { t } = useTranslation();
  const { styles } = useTheme2024({
    getStyle: getStyles,
  });

  return (
    <KeyboardAwareScrollView
      enableOnAndroid
      scrollEnabled={false}
      keyboardOpeningTime={0}
      // style={styles.container}
      contentContainerStyle={styles.container}>
      <View style={styles.containerHorizontal}>
        <Text style={styles.title}>
          {t('page.gasAccount.depositSelectPopup.title')}
        </Text>
        <Text style={styles.description}>
          {t('page.gasAccount.depositSelectPopup.desc')}
        </Text>
      </View>

      <View style={styles.accountDepositGroup}>
        <Button
          type="primary"
          onPress={() => {
            onSelect('token');
          }}
          titleStyle={styles.btnTitle}
          title={
            <View style={styles.depositWithTitle}>
              <Text style={styles.btnTitle}>
                {t('page.gasAccount.depositSelectPopup.depositToken')}
              </Text>
              <Text style={styles.btnDesc}>
                {t('page.gasAccount.depositSelectPopup.depositTokenDesc')}
              </Text>
            </View>
          }
        />

        <Button
          type="primary"
          onPress={() => {
            onSelect('pay');
          }}
          buttonStyle={styles.depositWithPayBtn}
          titleStyle={styles.btnTitle}
          title={
            <View style={styles.depositWithTitle}>
              <View style={styles.depositWithPayRow}>
                {Platform.OS === 'android' ? (
                  <>
                    <Text style={styles.btnTitle}>
                      {t('page.gasAccount.depositSelectPopup.buyWith')}
                    </Text>
                    <RcIconGooglePayCC />
                  </>
                ) : (
                  <Text style={styles.btnTitle}>
                    {t('page.gasAccount.depositSelectPopup.buyWithApple')}
                  </Text>
                )}
              </View>
              <Text style={styles.btnDesc}>
                {Platform.OS === 'ios'
                  ? t('page.gasAccount.depositPopup.applePayFeeDesc1')
                  : t('page.gasAccount.depositPopup.googlePayFeeDesc')}
              </Text>
            </View>
          }
        />
      </View>
    </KeyboardAwareScrollView>
  );
};

const getStyles = createGetStyles2024(({ colors2024, isLight }) => ({
  container: {
    width: '100%',
    flex: 1,
  },
  containerHorizontal: {
    paddingHorizontal: 20,
  },
  title: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    lineHeight: 24,
    fontStyle: 'normal',
    fontWeight: '800',
    color: colors2024['neutral-title-1'],
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontStyle: 'normal',
    fontWeight: '400',
    color: colors2024['neutral-secondary'],
  },
  amountSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    width: '100%',
  },
  amountButton: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    height: 60,
    borderRadius: 10,
    backgroundColor: colors2024['neutral-bg-2'],
    borderWidth: 1,
    borderColor: 'transparent',
  },
  selectedAmountButton: {
    backgroundColor: colors2024['brand-light-1'],
    borderColor: colors2024['brand-default'],
  },
  amountText: {
    color: colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 20,
  },

  tokenLabel: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontStyle: 'normal',
    fontWeight: '500',
    color: colors2024['neutral-foot'],
    marginBottom: 8,
    textAlign: 'left',
    width: '100%',
  },

  btnContainer: {
    marginTop: 26,
    paddingHorizontal: 20,
    justifyContent: 'flex-end',
  },

  accountDepositGroup: {
    flexDirection: 'column',
    gap: 16,
    width: '100%',
    marginTop: 50,
    paddingHorizontal: 20,
  },

  depositWithPayBtn: {
    height: 60,
    ...(isLight
      ? {
          backgroundColor: '#000',
        }
      : {
          backgroundColor: colors2024['neutral-bg-2'],
          borderWidth: 1,
          borderColor: colors2024['neutral-line'],
        }),
  },
  depositWithTitle: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
  },

  depositWithPayRow: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btnTitle: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    lineHeight: 24,
    fontStyle: 'normal',
    fontWeight: '700',
    color: colors2024['neutral-InvertHighlight'],
  },

  btnDesc: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontStyle: 'normal',
    fontWeight: '400',
    color: colors2024['neutral-InvertHighlight'],
    opacity: 0.6,
  },
}));
