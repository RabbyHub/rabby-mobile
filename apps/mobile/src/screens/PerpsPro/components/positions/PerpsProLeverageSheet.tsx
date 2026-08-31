import AutoLockView from '@/components/AutoLockView';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { Text, TextInput } from '@/components/Typography';
import { Button } from '@/components2024/Button';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { BOTTOM_BUTTON_COMPACT_HEIGHT } from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetTextInput, BottomSheetView } from '@gorhom/bottom-sheet';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { PerpsProSlider } from '../common/PerpsProSlider';
import {
  getPerpsProBottomSheetChromeStyles,
  PERPS_PRO_COMPACT_BUTTON_TITLE_STYLE,
  PERPS_PRO_CONFIRM_BUTTON_STYLE,
  resolvePerpsProFieldBackground,
} from '../common/perpsProVisual';
import { usePerpsProSheetNavigationRegistration } from '../common/perpsProSheetNavigationRegistry';
import { usePerpsProSliderHaptics } from '../common/usePerpsProSliderHaptics';
import { PerpsProDecimalTextInput } from '../trade/PerpsProDecimalTextInput';

const PerpsProLeverageBottomSheetTextInput = React.forwardRef<
  TextInput,
  React.ComponentProps<typeof TextInput>
>((props, forwardedRef) => (
  <BottomSheetTextInput
    {...props}
    ref={
      forwardedRef as React.Ref<React.ElementRef<typeof BottomSheetTextInput>>
    }
  />
));

PerpsProLeverageBottomSheetTextInput.displayName =
  'PerpsProLeverageBottomSheetTextInput';

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
    const inputRef = useRef<TextInput>(null);
    const { colors2024, styles } = useTheme2024({ getStyle });
    const { t } = useTranslation();
    const safeMax = Math.max(1, Math.floor(maxLeverage));
    const safeCurrent = Math.min(
      safeMax,
      Math.max(1, Math.round(currentLeverage)),
    );
    const [draft, setDraft] = useState(String(safeCurrent));
    const valueInputWidth = Math.max(
      28,
      Math.max(draft.length, String(safeMax).length) * 9 + 8,
    );
    usePerpsProSheetNavigationRegistration({
      active: visible,
      dismiss: onClose,
      dismissible: !pending,
    });

    useEffect(() => {
      if (visible) {
        setDraft(String(safeCurrent));
        modalRef.current?.present();
      } else {
        modalRef.current?.close();
      }
    }, [safeCurrent, visible]);

    const decrement = useCallback(
      () =>
        setDraft(current => String(Math.max(1, (Number(current) || 1) - 1))),
      [],
    );
    const increment = useCallback(
      () =>
        setDraft(current =>
          String(Math.min(safeMax, Math.max(0, Number(current) || 0) + 1)),
        ),
      [safeMax],
    );
    const normalizeLeverageInput = useCallback(
      (value: string) => {
        if (!value) {
          return value;
        }
        const numericValue = Number(value);
        if (!Number.isFinite(numericValue)) {
          return value;
        }
        return String(Math.min(safeMax, Math.max(1, numericValue)));
      },
      [safeMax],
    );
    const numericDraft = Number(draft);
    const isDraftValid =
      draft !== '' &&
      Number.isInteger(numericDraft) &&
      numericDraft >= 1 &&
      numericDraft <= safeMax;
    const sliderValue = isDraftValid ? numericDraft : 1;
    const sliderHaptics = usePerpsProSliderHaptics({
      disabled: pending,
      maximumValue: safeMax,
      minimumValue: 1,
      step: 1,
      value: sliderValue,
    });
    const confirm = useCallback(() => {
      if (!isDraftValid) {
        return;
      }
      onConfirm(numericDraft);
    }, [isDraftValid, numericDraft, onConfirm]);
    const dismissLeverageInput = useCallback(() => {
      inputRef.current?.blur();
      Keyboard.dismiss();
    }, []);
    const handleSliderTouchCapture = useCallback(() => {
      dismissLeverageInput();
      return false;
    }, [dismissLeverageInput]);

    return (
      <AppBottomSheetModal
        android_keyboardInputMode="adjustPan"
        enableDynamicSizing={false}
        enablePanDownToClose={!pending}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        ref={modalRef}
        {...makeBottomSheetProps({
          colors: colors2024,
          linearGradientType: 'bg1',
        })}
        backgroundStyle={styles.background}
        handleIndicatorStyle={styles.handleIndicator}
        handleStyle={styles.handle}
        onDismiss={onClose}
        snapPoints={[296]}
        style={styles.modal}>
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
                disabled={pending || numericDraft <= 1}
                onPress={decrement}
                style={styles.stepButton}
                testID="perps-pro-leverage-decrement">
                <View style={styles.minus} />
              </Pressable>
              <Pressable
                accessible={false}
                onPress={() => inputRef.current?.focus()}
                style={styles.valueEditor}>
                <PerpsProDecimalTextInput
                  accessibilityLabel={t(
                    'page.perps.pro.positions.adjustLeverage',
                  )}
                  cursorColor={colors2024['brand-default']}
                  editable={!pending}
                  focusCursorAtEnd
                  focusCursorAtEndMode="initialFocus"
                  inputComponent={PerpsProLeverageBottomSheetTextInput}
                  inputMode="numeric"
                  keyboardType="number-pad"
                  maxDecimals={0}
                  normalizeValue={normalizeLeverageInput}
                  onChangeText={setDraft}
                  ref={inputRef}
                  selectionColor={colors2024['brand-default']}
                  style={[styles.valueInput, { width: valueInputWidth }]}
                  testID="perps-pro-leverage-input"
                  value={draft}
                />
                <Text pointerEvents="none" style={styles.valueSuffix}>
                  x
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={pending || numericDraft >= safeMax}
                onPress={increment}
                style={styles.stepButton}
                testID="perps-pro-leverage-increment">
                <View style={styles.plusHorizontal} />
                <View style={styles.plusVertical} />
              </Pressable>
            </View>
            <View
              onStartShouldSetResponderCapture={handleSliderTouchCapture}
              style={styles.sliderSection}
              testID="perps-pro-leverage-slider-section">
              <PerpsProSlider
                disabled={pending}
                dimWhenDisabled={false}
                maximumValue={safeMax}
                minimumValue={1}
                onSlidingComplete={sliderHaptics.onSlidingComplete}
                onSlidingStart={sliderHaptics.onSlidingStart}
                onValueChange={next => {
                  const roundedNext = Math.round(next);
                  sliderHaptics.onValueChange(roundedNext);
                  setDraft(String(roundedNext));
                }}
                pointCount={5}
                showPoints={false}
                step={1}
                tone="neutral"
                value={sliderValue}
              />
            </View>
            <View style={styles.footer} testID="perps-pro-leverage-footer">
              <Button
                buttonStyle={PERPS_PRO_CONFIRM_BUTTON_STYLE}
                disabled={pending || !isDraftValid}
                height={BOTTOM_BUTTON_COMPACT_HEIGHT}
                loading={pending}
                onPress={confirm}
                title={t('global.confirm')}
                titleStyle={PERPS_PRO_COMPACT_BUTTON_TITLE_STYLE}
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

const getStyle = createGetStyles2024(
  ({ colors2024, isLight, safeAreaInsets }) => ({
    ...getPerpsProBottomSheetChromeStyles(colors2024),
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
      backgroundColor: resolvePerpsProFieldBackground({
        darkBackground: colors2024['neutral-bg-5'],
        isLight,
      }),
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
    valueEditor: {
      alignItems: 'center',
      flex: 1,
      flexDirection: 'row',
      justifyContent: 'center',
    },
    valueInput: {
      color: colors2024['neutral-title-1'],
      fontFamily: 'SF Pro',
      fontSize: 14,
      fontWeight: '500',
      height: 24,
      lineHeight: 18,
      margin: 0,
      padding: 0,
      textAlign: 'right',
    },
    valueSuffix: {
      color: colors2024['neutral-title-1'],
      fontFamily: 'SF Pro',
      fontSize: 14,
      fontWeight: '500',
      lineHeight: 18,
    },
    sliderSection: {
      marginTop: 8,
    },
    footer: {
      marginTop: 32,
      paddingBottom: Math.max(40, safeAreaInsets.bottom),
    },
  }),
);
