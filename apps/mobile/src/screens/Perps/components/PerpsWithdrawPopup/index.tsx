import {
  RcIconInfo2CC,
  RcIconInfoCC,
  RcIconInfoFillCC,
} from '@/assets/icons/common';
import AutoLockView from '@/components/AutoLockView';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { Button } from '@/components2024/Button';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import React, { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { PerpsWithdrawFeePopup } from './PerpsWithdrawFeePopup';

export const PerpsWithdrawPopup: React.FC<{
  visible?: boolean;
  onClose?(): void;
}> = ({ visible, onClose }) => {
  const modalRef = useRef<AppBottomSheetModal>(null);

  const { styles, colors2024, isLight } = useTheme2024({
    getStyle: getStyle,
  });

  const { t } = useTranslation();

  const { height } = useWindowDimensions();
  const maxHeight = useMemo(() => {
    return height - 200;
  }, [height]);

  useEffect(() => {
    if (visible) {
      modalRef.current?.present();
    } else {
      modalRef.current?.dismiss();
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
        // enableDynamicSizing
        snapPoints={[376]}
        maxDynamicContentSize={maxHeight}>
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
                $100 {t('page.perps.PerpsWithdrawPopup.available')}
              </Text>
            </View>
            <View style={styles.inputContainer}>
              <BottomSheetTextInput
                keyboardType="numeric"
                style={styles.input}
                placeholder="$0"
              />
            </View>

            <TouchableOpacity>
              <View style={styles.feeContainer}>
                <Text style={styles.fee}>Fee : $1.00</Text>
                <RcIconInfoFillCC color={'#CED0DA'} width={15} height={15} />
              </View>
            </TouchableOpacity>
          </View>
          <Button
            type="primary"
            title={t('page.perps.PerpsWithdrawPopup.withdrawBtn')}
            onPress={() => {}}
          />
        </AutoLockView>
      </AppBottomSheetModal>
      <PerpsWithdrawFeePopup visible={false} />
    </>
  );
};

const getStyle = createGetStyles2024(ctx => {
  return {
    container: {
      height: '100%',
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
      lineHeight: 36,
      fontWeight: '700',
      // color: ctx.colors2024['neutral-body'],
      flex: 1,
    },
    inputError: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '500',
      color: ctx.colors2024['neutral-error'],
      backgroundColor: ctx.colors2024['neutral-bg-2'],
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderColor: ctx.colors2024['neutral-error'],
      borderWidth: 1,
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
      marginTop: 38,
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
