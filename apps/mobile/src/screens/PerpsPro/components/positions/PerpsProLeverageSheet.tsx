import AutoLockView from '@/components/AutoLockView';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { Text } from '@/components/Typography';
import { Button } from '@/components2024/Button';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { PerpsProSlider } from '../common/PerpsProSlider';

// Figma 80481:14828 is a documented compact sheet action special case.
const PERPS_PRO_LEVERAGE_CONFIRM_HEIGHT = 36;

export const PerpsProLeverageSheet: React.FC<{
  currentLeverage: number;
  maxLeverage: number;
  onClose: () => void;
  onConfirm: (leverage: number) => void;
  pending: boolean;
  visible: boolean;
}> = React.memo(
  ({ currentLeverage, maxLeverage, onClose, onConfirm, pending, visible }) => {
    const modalRef = useRef<AppBottomSheetModal>(null);
    const { colors2024, styles } = useTheme2024({ getStyle });
    const { t } = useTranslation();
    const safeMax = Math.max(1, Math.floor(maxLeverage));
    const safeCurrent = Math.min(
      safeMax,
      Math.max(1, Math.round(currentLeverage)),
    );
    const [value, setValue] = useState(safeCurrent);

    useEffect(() => {
      if (visible) {
        setValue(safeCurrent);
        modalRef.current?.present();
      } else {
        modalRef.current?.close();
      }
    }, [safeCurrent, visible]);

    const decrement = useCallback(
      () => setValue(current => Math.max(1, current - 1)),
      [],
    );
    const increment = useCallback(
      () => setValue(current => Math.min(safeMax, current + 1)),
      [safeMax],
    );

    return (
      <AppBottomSheetModal
        enablePanDownToClose={!pending}
        ref={modalRef}
        {...makeBottomSheetProps({
          colors: colors2024,
          linearGradientType: 'bg1',
        })}
        onDismiss={onClose}
        snapPoints={[288]}>
        <BottomSheetView style={styles.sheetView}>
          <AutoLockView style={styles.container}>
            <View style={styles.titleGroup}>
              <Text style={styles.title}>
                {t('page.perps.pro.positions.adjustLeverage')}
              </Text>
              <Text style={styles.maximum}>
                {t('page.perps.pro.positions.upToLeverage', {
                  leverage: safeMax,
                })}
              </Text>
            </View>
            <View style={styles.inputRow}>
              <Pressable
                accessibilityRole="button"
                disabled={pending || value <= 1}
                onPress={decrement}
                style={styles.stepButton}
                testID="perps-pro-leverage-decrement">
                <View style={styles.minus} />
              </Pressable>
              <Text style={styles.value}>{value}x</Text>
              <Pressable
                accessibilityRole="button"
                disabled={pending || value >= safeMax}
                onPress={increment}
                style={styles.stepButton}
                testID="perps-pro-leverage-increment">
                <View style={styles.plusHorizontal} />
                <View style={styles.plusVertical} />
              </Pressable>
            </View>
            <View style={styles.sliderSection}>
              <PerpsProSlider
                disabled={pending}
                maximumValue={safeMax}
                minimumValue={1}
                onValueChange={next => setValue(Math.round(next))}
                pointCount={5}
                step={1}
                tone="neutral"
                value={value}
              />
            </View>
            <View style={styles.footer}>
              <Button
                disabled={pending}
                height={PERPS_PRO_LEVERAGE_CONFIRM_HEIGHT}
                loading={pending}
                onPress={() => onConfirm(value)}
                title={t('global.confirm')}
                titleStyle={styles.buttonTitle}
                testID="perps-pro-leverage-confirm"
                type="primary"
              />
            </View>
          </AutoLockView>
        </BottomSheetView>
      </AppBottomSheetModal>
    );
  },
);

PerpsProLeverageSheet.displayName = 'PerpsProLeverageSheet';

const getStyle = createGetStyles2024(({ colors2024, safeAreaInsets }) => ({
  sheetView: {
    height: '100%',
  },
  container: {
    height: '100%',
    paddingHorizontal: 15,
    paddingTop: 8,
  },
  titleGroup: {
    gap: 8,
  },
  title: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
  },
  maximum: {
    color: colors2024['neutral-body'],
    fontFamily: 'SF Pro',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  inputRow: {
    alignItems: 'center',
    backgroundColor: colors2024['neutral-bg-5'],
    borderRadius: 6,
    flexDirection: 'row',
    height: 40,
    justifyContent: 'space-between',
    marginTop: 16,
    paddingHorizontal: 8,
  },
  stepButton: {
    alignItems: 'center',
    height: 24,
    justifyContent: 'center',
    position: 'relative',
    width: 20,
  },
  minus: {
    backgroundColor: colors2024['neutral-info'],
    borderRadius: 1,
    height: 1.5,
    width: 10,
  },
  plusHorizontal: {
    backgroundColor: colors2024['neutral-info'],
    borderRadius: 1,
    height: 1.5,
    position: 'absolute',
    width: 10,
  },
  plusVertical: {
    backgroundColor: colors2024['neutral-info'],
    borderRadius: 1,
    height: 10,
    position: 'absolute',
    width: 1.5,
  },
  value: {
    color: colors2024['neutral-title-1'],
    flex: 1,
    fontFamily: 'SF Pro',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
    textAlign: 'center',
  },
  sliderSection: {
    marginTop: 8,
  },
  footer: {
    marginTop: 32,
    paddingBottom: Math.max(40, safeAreaInsets.bottom),
  },
  buttonTitle: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
  },
}));
