import { RcIconInfoFillCC } from '@/assets/icons/common';
import AutoLockView from '@/components/AutoLockView';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { Button } from '@/components2024/Button';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { AccountSummary } from '@/hooks/perps/usePerpsStore';
import { useTheme2024 } from '@/hooks/theme';
import { useTipsPopup } from '@/hooks/useTipsPopup';
import { formatUsdValue } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetTextInput, BottomSheetView } from '@gorhom/bottom-sheet';
import { useRequest } from 'ahooks';
import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

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

  const [amount, setAmount] = React.useState<string>('');
  const { runAsync: handleWithdraw, loading } = useRequest(
    async () => {
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
      modalRef.current?.dismiss();
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      setAmount('');
    }
  }, [visible]);

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
      >
        <BottomSheetView>
          <AutoLockView style={[styles.container]}>
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
                  {formatUsdValue(accountSummary?.withdrawable || 0)}{' '}
                  {t('page.perps.PerpsWithdrawPopup.available')}
                </Text>
              </View>
              <View style={styles.inputContainer}>
                <BottomSheetTextInput
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="numeric"
                  style={[
                    styles.input,
                    !amountValidation.isValid ? styles.inputError : null,
                  ]}
                  placeholder="$0"
                />
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
                  showTipsPopup({
                    title: t('page.perps.PerpsWithdrawPopup.feeTooltipTitle'),
                    desc: t('page.perps.PerpsWithdrawPopup.feeTooltipDesc'),
                  });
                }}>
                <View style={styles.feeContainer}>
                  <Text style={styles.fee}>
                    {t('page.perps.PerpsWithdrawPopup.feeTip')}
                  </Text>
                  <RcIconInfoFillCC color={'#CED0DA'} width={15} height={15} />
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
          </AutoLockView>
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
      flex: 1,
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
      fontFamily: 'SF Pro Rounded',
      fontSize: 28,
      // lineHeight: 36,
      fontWeight: '700',
      // color: ctx.colors2024['neutral-body'],
      flex: 1,
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
      fontWeight: '800',
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
  };
});
