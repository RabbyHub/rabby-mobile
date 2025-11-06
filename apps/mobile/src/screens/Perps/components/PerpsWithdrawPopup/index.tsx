import RcIconInfoCC from '@/assets2024/icons/perps/IconInfoCC.svg';
import { AssetAvatar } from '@/components';
import AutoLockView from '@/components/AutoLockView';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { Button } from '@/components2024/Button';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { ARB_USDC_TOKEN_ITEM } from '@/constant/perps';
import { AccountSummary } from '@/hooks/perps/usePerpsStore';
import { useTheme2024 } from '@/hooks/theme';
import { useTipsPopup } from '@/hooks/useTipsPopup';
import { useUsdInput } from '@/hooks/useUsdInput';
import { formatPerpsUsdValue, formatUsdValue } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import { getTokenSymbol } from '@/utils/token';
import { BottomSheetTextInput, BottomSheetView } from '@gorhom/bottom-sheet';
import { useRequest } from 'ahooks';
import BigNumber from 'bignumber.js';
import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Keyboard, Platform, Text, TouchableOpacity, View } from 'react-native';

export const PerpsWithdrawPopup: React.FC<{
  visible?: boolean;
  onClose?(): void;
  onWithdraw?(v: string): void;
  accountSummary?: AccountSummary | null;
}> = ({ visible, onClose, onWithdraw, accountSummary }) => {
  const modalRef = useRef<AppBottomSheetModal>(null);

  const { styles, colors2024, isLight } = useTheme2024({
    getStyle: getStyle,
  });

  const { t } = useTranslation();
  const { showTipsPopup } = useTipsPopup();

  // const [amount, setAmount] = React.useState<string>('');
  const {
    value: amount,
    displayedValue: displayedAmount,
    onChangeText: setAmount,
  } = useUsdInput();
  const { runAsync: handleWithdraw, loading } = useRequest(
    async () => {
      Keyboard.dismiss();
      await onWithdraw?.(amount);
    },
    {
      manual: true,
    },
  );

  const amountValidation = React.useMemo(() => {
    const amountValue = Number(amount);
    if (amountValue === 0) {
      return { isValid: false, error: null };
    }

    if (Number.isNaN(+amount)) {
      return {
        isValid: false,
        error: 'invalid_number',
        errorMessage: t('page.perps.PerpsWithdrawPopup.invalidNumber'),
      };
    }

    if (amountValue > Number(accountSummary?.withdrawable || 0)) {
      return {
        isValid: false,
        error: 'insufficient_balance',
        errorMessage: t('page.perps.PerpsWithdrawPopup.insufficientBalance'),
      };
    }
    if (amountValue < 2) {
      return {
        isValid: false,
        error: 'minimum_limit',
        errorMessage: t('page.perps.PerpsWithdrawPopup.minimumWithdrawSize'),
      };
    }

    return { isValid: true, error: null };
  }, [accountSummary?.withdrawable, amount, t]);

  useEffect(() => {
    if (visible) {
      modalRef.current?.present();
    } else {
      modalRef.current?.close();
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      setAmount('');
    }
  }, [setAmount, visible]);

  return (
    <>
      <AppBottomSheetModal
        ref={modalRef}
        // snapPoints={snapPoints}
        {...makeBottomSheetProps({
          colors: colors2024,
          linearGradientType: 'bg1',
        })}
        onDismiss={onClose}
        enableDynamicSizing
        // snapPoints={[386]
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore">
        <BottomSheetView style={[styles.container]}>
          <View>
            <Text style={styles.title}>
              {t('page.perps.PerpsWithdrawPopup.title')}
            </Text>
          </View>
          <View style={styles.formItem}>
            <View style={styles.formItemLabelRow}>
              <Text style={styles.formItemLabel}>
                {t('page.perps.PerpsWithdrawPopup.amount')}
              </Text>
              <Text style={styles.formItemDesc}>
                {formatPerpsUsdValue(
                  accountSummary?.withdrawable || 0,
                  BigNumber.ROUND_DOWN,
                )}{' '}
                {t('page.perps.PerpsWithdrawPopup.available')}
              </Text>
            </View>
            <View style={styles.inputContainer}>
              <BottomSheetTextInput
                value={displayedAmount}
                onChangeText={setAmount}
                keyboardType="numeric"
                style={[
                  styles.input,
                  !amountValidation.isValid && amount !== ''
                    ? styles.inputError
                    : null,
                ]}
                placeholder="$0"
              />
              {!amount && (
                <TouchableOpacity
                  style={styles.maxButtonWrapper}
                  onPress={() => {
                    setAmount(
                      Number(
                        (
                          Math.floor(
                            Number(accountSummary?.withdrawable || 0) * 100,
                          ) / 100
                        ).toFixed(2),
                      ).toString(),
                    );
                  }}>
                  <Text style={styles.maxButtonText}>MAX</Text>
                </TouchableOpacity>
              )}
              <View style={styles.divider} />

              <View style={styles.tokenContainer}>
                <AssetAvatar
                  size={26}
                  chain={ARB_USDC_TOKEN_ITEM?.chain}
                  logo={ARB_USDC_TOKEN_ITEM?.logo_url}
                  chainSize={12}
                />
                <Text style={styles.tokenText}>
                  {getTokenSymbol(ARB_USDC_TOKEN_ITEM)}
                </Text>
              </View>
            </View>
            <View style={styles.errorContainer}>
              {amountValidation.errorMessage ? (
                <Text style={styles.errorMessage}>
                  {amountValidation.errorMessage}
                </Text>
              ) : null}
            </View>

            <TouchableOpacity
              onPress={() => {
                Keyboard.dismiss();
                showTipsPopup({
                  title: t('page.perps.PerpsWithdrawPopup.feeTooltipTitle'),
                  desc: t('page.perps.PerpsWithdrawPopup.feeTooltipDesc'),
                });
              }}>
              <View style={styles.feeContainer}>
                <Text style={styles.fee}>
                  {t('page.perps.PerpsWithdrawPopup.feeTip')}
                </Text>
                <RcIconInfoCC
                  color={colors2024['neutral-info']}
                  width={18}
                  height={18}
                />
              </View>
            </TouchableOpacity>
          </View>
          <Button
            type="primary"
            disabled={!amountValidation.isValid}
            title={t('page.perps.PerpsWithdrawPopup.withdrawBtn')}
            loading={loading}
            onPress={handleWithdraw}
          />
        </BottomSheetView>
      </AppBottomSheetModal>
    </>
  );
};

const getStyle = createGetStyles2024(ctx => {
  return {
    container: {
      // height: '100%',
      backgroundColor: ctx.colors2024['neutral-bg-1'],
      paddingBottom: 56,
      paddingHorizontal: 20,
      display: 'flex',
      flexDirection: 'column',
    },
    formItem: {
      flexShrink: 0,
    },
    formItemLabelRow: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    formItemLabel: {
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '500',
      color: ctx.colors2024['neutral-secondary'],
      fontFamily: 'SF Pro Rounded',
    },
    formItemDesc: {
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '500',
      color: ctx.colors2024['neutral-secondary'],
      fontFamily: 'SF Pro Rounded',
    },
    inputContainer: {
      borderRadius: 16,
      paddingVertical: 20,
      paddingHorizontal: 20,
      backgroundColor: ctx.colors2024['neutral-bg-2'],
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    input: {
      ...(Platform.OS === 'ios' && {
        fontFamily: 'SF Pro Rounded', // avoid some android phone show number not in center
      }),
      fontSize: 28,
      lineHeight: 36,
      fontWeight: '700',
      color: ctx.colors2024['neutral-title-1'],
      flex: 1,
      minHeight: 52,
      paddingTop: 0,
      paddingBottom: 0,
    },
    inputError: {
      color: ctx.colors2024['red-default'],
    },
    errorContainer: {
      marginTop: 8,
      minHeight: 18,
    },
    errorMessage: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '400',
      color: ctx.colors2024['red-default'],
      flexShrink: 0,
    },
    title: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 20,
      lineHeight: 24,
      fontWeight: '900',
      color: ctx.colors2024['neutral-title-1'],
      marginBottom: 24,
      textAlign: 'center',
    },

    feeContainer: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      marginTop: 20,
      marginBottom: 15,
    },
    fee: {
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '400',
      fontFamily: 'SF Pro Rounded',
      color: ctx.colors2024['neutral-foot'],
    },
    divider: {
      width: 1,
      height: 28,
      backgroundColor: ctx.colors2024['neutral-line'],
    },
    maxButtonWrapper: {
      padding: 4,
      backgroundColor: ctx.colors2024['brand-light-1'],
      borderRadius: 8,
    },
    maxButtonText: {
      color: ctx.colors2024['brand-default'],
      fontSize: 14,
      fontWeight: '700',
      lineHeight: 18,
      fontFamily: 'SF Pro Rounded',
    },
    tokenContainer: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      // padding: 4,
      // backgroundColor: ctx.colors2024['neutral-line'],
      // borderRadius: 100,
    },
    tokenText: {
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '700',
      color: ctx.colors2024['neutral-title-1'],
      fontFamily: 'SF Pro Rounded',
    },
  };
});
