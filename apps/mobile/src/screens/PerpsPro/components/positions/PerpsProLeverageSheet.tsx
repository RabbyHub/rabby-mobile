import AutoLockView from '@/components/AutoLockView';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { Text } from '@/components/Typography';
import { Button } from '@/components2024/Button';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import {
  BOTTOM_BUTTON_SINGLE_HEIGHT,
  BOTTOM_BUTTON_TITLE_STYLE,
  BOTTOM_BUTTON_TOP_OFFSET,
  getBottomButtonBottomOffset,
} from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { PerpsProSlider } from '../common/PerpsProSlider';

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
        ref={modalRef}
        {...makeBottomSheetProps({
          colors: colors2024,
          linearGradientType: 'bg1',
        })}
        onDismiss={onClose}
        snapPoints={[340]}>
        <BottomSheetView style={styles.sheetView}>
          <AutoLockView style={styles.container}>
            <View style={styles.titleRow}>
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
                style={styles.stepButton}>
                <View style={styles.minus} />
              </Pressable>
              <Text style={styles.value}>{value}x</Text>
              <Pressable
                accessibilityRole="button"
                disabled={pending || value >= safeMax}
                onPress={increment}
                style={styles.stepButton}>
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
                step={1}
                value={value}
              />
              <View style={styles.sliderLabels}>
                <Text style={styles.sliderLabel}>1x</Text>
                <Text style={styles.sliderLabel}>{safeMax}x</Text>
              </View>
            </View>
            <View style={styles.footer}>
              <Button
                disabled={value === safeCurrent || pending}
                height={BOTTOM_BUTTON_SINGLE_HEIGHT}
                loading={pending}
                onPress={() => onConfirm(value)}
                title={t('global.confirm')}
                titleStyle={BOTTOM_BUTTON_TITLE_STYLE}
                type="hyperliquid"
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
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  title: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
  },
  maximum: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
  },
  inputRow: {
    alignItems: 'center',
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 8,
    flexDirection: 'row',
    height: 56,
    justifyContent: 'space-between',
    marginTop: 24,
    paddingHorizontal: 8,
  },
  stepButton: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    position: 'relative',
    width: 40,
  },
  minus: {
    backgroundColor: colors2024['neutral-title-1'],
    borderRadius: 1,
    height: 2,
    width: 14,
  },
  plusHorizontal: {
    backgroundColor: colors2024['neutral-title-1'],
    borderRadius: 1,
    height: 2,
    position: 'absolute',
    width: 14,
  },
  plusVertical: {
    backgroundColor: colors2024['neutral-title-1'],
    borderRadius: 1,
    height: 14,
    position: 'absolute',
    width: 2,
  },
  value: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
  },
  sliderSection: {
    marginTop: 20,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  sliderLabel: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 16,
  },
  footer: {
    marginTop: 'auto',
    paddingBottom: getBottomButtonBottomOffset(safeAreaInsets.bottom),
    paddingTop: BOTTOM_BUTTON_TOP_OFFSET,
  },
}));
