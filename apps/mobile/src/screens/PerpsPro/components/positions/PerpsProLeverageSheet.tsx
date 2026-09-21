import { PERPS_PRO_NUMBER_STYLE } from '../common/perpsProNumberText';
import AutoLockView from '@/components/AutoLockView';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { Text, TextInput } from '@/components/Typography';
import { Button } from '@/components2024/Button';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import {
  BOTTOM_BUTTON_SINGLE_HEIGHT,
  BOTTOM_BUTTON_BOTTOM_OFFSET,
  BOTTOM_BUTTON_TOP_OFFSET,
  getBottomButtonBottomOffset,
} from '@/constant/layout';
import { IS_ANDROID } from '@/core/native/utils';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import {
  BottomSheetScrollView,
  BottomSheetTextInput,
  BottomSheetView,
  type BottomSheetScrollViewMethods,
} from '@gorhom/bottom-sheet';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { PerpsProSlider } from '../common/PerpsProSlider';
import {
  getPerpsProDialogStyles,
  resolvePerpsProDialogCardBackground,
} from '../common/perpsProDialogVisual';
import { PerpsProDialogBackdrop } from '../common/PerpsProDialogBackdrop';
import RcLeverageMinus from '@/assets2024/icons/perps/PerpsProLeverageMinus.svg';
import RcLeveragePlus from '@/assets2024/icons/perps/PerpsProLeveragePlus.svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePerpsProSheetNavigationRegistration } from '../common/perpsProSheetNavigationRegistry';
import { usePerpsProSliderHaptics } from '../common/usePerpsProSliderHaptics';
import { PerpsProDecimalTextInput } from '../trade/PerpsProDecimalTextInput';
import { PerpsProKeyboardSheetContext } from '../common/PerpsProKeyboardSheetContext';
import { usePerpsProSheetKeyboard } from '../common/usePerpsProSheetKeyboard';
import { PerpsProSheetKeyboardAnimation } from '../common/PerpsProSheetKeyboardAnimation';
import { PERPS_PRO_ANDROID_SINGLE_LINE_INPUT_STYLE } from '../common/perpsProSingleLineInput';

const SHEET_HEIGHT = 362;
const SheetContent = IS_ANDROID ? BottomSheetScrollView : BottomSheetView;

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
    const scrollViewRef = useRef<BottomSheetScrollViewMethods>(null);
    const keyboard = usePerpsProSheetKeyboard({ visible, scrollViewRef });
    const { colors2024, styles } = useTheme2024({ getStyle });
    const { t } = useTranslation();
    const { bottom } = useSafeAreaInsets();
    const safeBottomExtra =
      getBottomButtonBottomOffset(bottom) - BOTTOM_BUTTON_BOTTOM_OFFSET;
    const safeMax = Math.max(1, Math.floor(maxLeverage));
    const safeCurrent = Math.min(
      safeMax,
      Math.max(1, Math.round(currentLeverage)),
    );
    const [draft, setDraft] = useState(String(safeCurrent));
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
          linearGradientType: 'bg0',
        })}
        backdropComponent={PerpsProDialogBackdrop}
        backgroundStyle={styles.background}
        handleIndicatorStyle={styles.handleIndicator}
        handleStyle={styles.handle}
        onDismiss={onClose}
        snapPoints={[SHEET_HEIGHT + safeBottomExtra + keyboard.accessoryInset]}
        style={styles.modal}>
        <PerpsProKeyboardSheetContext.Provider value={keyboard.sheetId}>
          {IS_ANDROID && visible ? (
            <PerpsProSheetKeyboardAnimation
              onReadyChange={keyboard.onSheetReadyChange}
            />
          ) : null}
          <SheetContent
            {...(IS_ANDROID
              ? {
                  ref: scrollViewRef,
                  style: { marginBottom: keyboard.accessoryInset },
                  contentContainerStyle: styles.scrollContent,
                  keyboardShouldPersistTaps: 'handled' as const,
                  onLayout: keyboard.ensureInputVisible,
                  onContentSizeChange: keyboard.ensureInputVisible,
                  onScrollBeginDrag: keyboard.cancelMeasurement,
                  showsVerticalScrollIndicator: false,
                }
              : { style: styles.sheetView })}>
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
                  <RcLeverageMinus
                    color={colors2024['neutral-title-1']}
                    width={16}
                    height={16}
                  />
                </Pressable>
                <Pressable
                  accessible={false}
                  onPress={() => inputRef.current?.focus()}
                  style={styles.valueEditor}>
                  <View
                    style={styles.valueInputViewport}
                    testID="perps-pro-leverage-input-viewport">
                    <Text
                      accessible={false}
                      accessibilityElementsHidden
                      importantForAccessibility="no-hide-descendants"
                      pointerEvents="none"
                      style={[styles.valueInput, styles.valueInputMeasure]}
                      testID="perps-pro-leverage-input-measure">
                      {draft || '0'}
                    </Text>
                    <PerpsProDecimalTextInput
                      accessibilityLabel={t(
                        'page.perps.pro.positions.adjustLeverage',
                      )}
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
                      style={[
                        styles.valueInput,
                        styles.valueInputOverlay,
                        // Clear lineHeight after the style factory's JSON copy.
                        PERPS_PRO_ANDROID_SINGLE_LINE_INPUT_STYLE,
                      ]}
                      testID="perps-pro-leverage-input"
                      value={draft}
                    />
                  </View>
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
                  <RcLeveragePlus
                    color={colors2024['neutral-title-1']}
                    width={16}
                    height={16}
                  />
                </Pressable>
              </View>
              <View
                onStartShouldSetResponderCapture={handleSliderTouchCapture}
                style={styles.sliderSection}
                testID="perps-pro-leverage-slider-section">
                <PerpsProSlider
                  appearance="leverage-dialog"
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
                  buttonStyle={[
                    styles.button,
                    (pending || !isDraftValid) && styles.buttonDisabled,
                  ]}
                  disabled={pending || !isDraftValid}
                  height={BOTTOM_BUTTON_SINGLE_HEIGHT}
                  loading={pending}
                  loadingProps={{ color: styles.buttonDisabledTitle.color }}
                  onPress={confirm}
                  title={t('global.confirm')}
                  titleStyle={styles.buttonTitle}
                  disabledTitleStyle={styles.buttonDisabledTitle}
                  testID="perps-pro-leverage-confirm"
                  type="primary"
                />
              </View>
            </AutoLockView>
          </SheetContent>
        </PerpsProKeyboardSheetContext.Provider>
      </AppBottomSheetModal>
    );
  },
);

PerpsProLeverageSheet.displayName = 'PerpsProLeverageSheet';

const getStyle = createGetStyles2024(
  ({ colors2024, isLight, safeAreaInsets }) => ({
    ...getPerpsProDialogStyles(colors2024, safeAreaInsets.bottom, isLight),
    sheetView: { height: '100%' },
    scrollContent: { flexGrow: 1 },
    container: {
      ...(IS_ANDROID
        ? {
            minHeight:
              SHEET_HEIGHT -
              40 +
              getBottomButtonBottomOffset(safeAreaInsets.bottom) -
              BOTTOM_BUTTON_BOTTOM_OFFSET,
            flexGrow: 1,
          }
        : { height: '100%' }),
      paddingHorizontal: 15,
      paddingTop: 8,
    },
    titleGroup: { gap: 8, alignItems: 'center' },
    maximum: {
      ...PERPS_PRO_NUMBER_STYLE,
      color: colors2024['neutral-secondary'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 16,
      fontWeight: '400',
      lineHeight: 20,
    },
    inputRow: {
      alignSelf: 'center',
      alignItems: 'center',
      backgroundColor: resolvePerpsProDialogCardBackground(colors2024, isLight),
      borderRadius: 12,
      flexDirection: 'row',
      height: 54,
      width: 202,
      justifyContent: 'space-between',
      marginTop: 24,
      paddingHorizontal: 8,
    },
    stepButton: {
      alignItems: 'center',
      backgroundColor: colors2024['neutral-bg-5'],
      borderRadius: 6,
      height: 32,
      width: 32,
      justifyContent: 'center',
    },
    valueEditor: {
      alignItems: 'center',
      flex: 1,
      flexDirection: 'row',
      justifyContent: 'center',
    },
    valueInput: {
      ...PERPS_PRO_NUMBER_STYLE,
      color: colors2024['neutral-title-1'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 36,
      fontWeight: '700',
      height: 42,
      lineHeight: 42,
      margin: 0,
      padding: 0,
      textAlign: 'right',
    },
    // Use the same font and draft to size the input, including tabular digits.
    // The overlay keeps native input/cursor ownership and adds no measuring state.
    valueInputMeasure: { opacity: 0 },
    // Clip the cursor to the font size without shortening native text layout.
    // Compensated side padding preserves digit width and leaves cursor room.
    valueInputViewport: IS_ANDROID
      ? {
          height: 36,
          marginHorizontal: -4,
          overflow: 'hidden',
          paddingHorizontal: 4,
        }
      : {},
    valueInputOverlay: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      // Keep the natural line fully visible to Android's selection scrolling.
      // Its center matches the 36-high clipping window and the unchanged x.
      ...(IS_ANDROID
        ? {
            height: 54,
            left: 4,
            right: 4,
            top: -9,
          }
        : {}),
    },
    valueSuffix: {
      color: colors2024['neutral-title-1'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 36,
      fontWeight: '700',
      lineHeight: 42,
    },
    sliderSection: { marginTop: 24 },
    footer: {
      paddingHorizontal: 5,
      paddingTop: BOTTOM_BUTTON_TOP_OFFSET * 2,
      paddingBottom: getBottomButtonBottomOffset(safeAreaInsets.bottom),
    },
  }),
);
