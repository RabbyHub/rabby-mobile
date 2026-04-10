import { RcIconApple, RcIconGooglePayCC } from '@/assets2024/icons/gas-account';
import { Tip } from '@/components';
import { Button } from '@/components2024/Button';
import { useTheme2024 } from '@/hooks/theme';
import { useGasAccountDepositAvailableTokens } from '@/screens/GasAccount/hooks/useDepositTokenAvailability';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { Text } from '@/components/Typography';

export const GasAccountDepositSelect: React.FC<{
  onSelect(type: 'token' | 'pay'): void;
  minDepositPrice?: number;
  disableL2Deposit?: boolean;
}> = ({ onSelect, minDepositPrice, disableL2Deposit }) => {
  const { t } = useTranslation();
  const { styles, colors2024, isLight } = useTheme2024({
    getStyle: getStyles,
  });
  const {
    hasAvailableTokens,
    isCheckingAvailability,
    checkIsExpireAndUpdate,
    refreshBridgeSupportTokenList,
  } = useGasAccountDepositAvailableTokens(minDepositPrice, {
    disableL2Deposit,
  });
  const [showDisabledTip, setShowDisabledTip] = useState(false);

  useEffect(() => {
    Promise.allSettled([
      checkIsExpireAndUpdate(),
      refreshBridgeSupportTokenList(),
    ]);
  }, [checkIsExpireAndUpdate, refreshBridgeSupportTokenList]);

  useEffect(() => {
    if (hasAvailableTokens || isCheckingAvailability) {
      setShowDisabledTip(false);
    }
  }, [hasAvailableTokens, isCheckingAvailability]);

  const tokenDisabled = !isCheckingAvailability && !hasAvailableTokens;

  const handlePressDepositToken = useCallback(() => {
    if (tokenDisabled) {
      setShowDisabledTip(true);
      return;
    }
    onSelect('token');
  }, [onSelect, tokenDisabled]);

  return (
    <KeyboardAwareScrollView
      enableOnAndroid
      scrollEnabled={false}
      keyboardOpeningTime={0}
      contentContainerStyle={styles.container}>
      <View style={styles.containerHorizontal}>
        <Text style={styles.title}>
          {t('page.gasAccount.depositPopup.gasDepositTitle')}
        </Text>
      </View>

      <View style={styles.accountDepositGroup}>
        <Button
          type="primary"
          onPress={handlePressDepositToken}
          titleStyle={[styles.btnTitle]}
          buttonStyle={
            tokenDisabled && { backgroundColor: colors2024['brand-disable'] }
          }
          title={
            <Tip
              placement="top"
              isVisible={showDisabledTip}
              onClose={() => setShowDisabledTip(false)}
              content={
                <View style={styles.tipContent}>
                  <Text style={styles.tipText} numberOfLines={1}>
                    {t(
                      'page.gasAccount.depositSelectPopup.insufficientTokenBalance',
                    )}
                  </Text>
                </View>
              }
              contentStyle={styles.tipContentStyle}
              tooltipStyle={styles.tipTooltipStyle}>
              <View style={styles.depositWithTitle}>
                <Text style={styles.btnTitle}>
                  {t('page.gasAccount.depositSelectPopup.depositToken')}
                </Text>
              </View>
            </Tip>
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
                <Text style={[styles.btnTitle, styles.payTitle]}>
                  {t('page.gasAccount.depositWith')}
                </Text>
                {Platform.OS === 'android' ? (
                  <RcIconGooglePayCC color={isLight ? '#fff' : '#000'} />
                ) : (
                  <>
                    <RcIconApple color={isLight ? '#fff' : '#000'} />
                    <Text style={[styles.btnTitle, styles.payTitle]}>
                      {t('page.gasAccount.depositSelectPopup.appStore')}
                    </Text>
                  </>
                )}
              </View>
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
    paddingBottom: 48,
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
    marginTop: 16,
    paddingHorizontal: 20,
  },

  depositWithPayBtn: {
    height: 60,
    ...(isLight
      ? {
          backgroundColor: '#000',
        }
      : {
          backgroundColor: '#fff',
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

  payTitle: {
    color: isLight ? '#fff' : '#000',
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
  tokenButtonTrigger: {
    width: '100%',
  },
  tipTooltipStyle: {
    shadowColor: 'rgba(0, 0, 0, 0.06)',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 20,
  },
  tipContentStyle: {
    backgroundColor: colors2024['neutral-black'],
    borderRadius: 8,
    padding: 0,
  },
  tipContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tipText: {
    color: colors2024['neutral-title-2'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
    textAlign: 'left',
  },
}));
