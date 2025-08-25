import AutoLockView from '@/components/AutoLockView';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { Button } from '@/components2024/Button';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import React, { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, useWindowDimensions, View } from 'react-native';
import { PerpsSelectTokenPopup } from './PerpsSelectTokenPopup';

export const PerpsDepositPopup: React.FC<{
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
              {t('page.perps.PerpsDepositPopup.title')}
            </Text>
          </View>
          <View style={styles.formItem}>
            <View style={styles.formItemLabelRow}>
              <Text style={styles.formItemLabel}>
                {t('page.perps.PerpsDepositPopup.amount')}
              </Text>
              <Text style={styles.formItemDesc}>
                {t('page.perps.PerpsDepositPopup.balance')}: $100
              </Text>
            </View>
            <View style={styles.inputContainer}>
              <BottomSheetTextInput
                keyboardType="numeric"
                style={styles.input}
                placeholder="$0"
              />
              <View style={styles.divider} />
              <View style={styles.tokenContainer}>
                <Text style={styles.tokenText}>USDC</Text>
              </View>
            </View>
          </View>
          <Button
            type="primary"
            title={t('page.perps.PerpsDepositPopup.depositBtn')}
            onPress={() => {}}
          />
        </AutoLockView>
      </AppBottomSheetModal>
      <PerpsSelectTokenPopup visible={true} />
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
      paddingVertical: 28,
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
    divider: {
      width: 1,
      height: 28,
      backgroundColor: ctx.colors2024['neutral-line'],
    },
  };
});
