import { colord } from 'colord';
import { IS_ANDROID } from '@/core/native/utils';
import { PERPS_PRO_ANDROID_SINGLE_LINE_INPUT_STYLE } from '../common/perpsProSingleLineInput';
import {
  PERPS_PRO_DIALOG_TOKENS,
  PERPS_PRO_DIALOG_HEAVY_TEXT_STYLE,
} from '../common/perpsProDialogVisual';
import { PERPS_PRO_NUMBER_STYLE } from '../common/perpsProNumberText';
import { Text, TextInput } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import React, { useCallback, useImperativeHandle, useRef } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { PositionMarginRange } from '../../model/positionMargin';
import { PerpsProDecimalTextInput } from '../trade/PerpsProDecimalTextInput';

const MIN_BUTTON_WIDTH = 32;
const MAX_BUTTON_WIDTH = 40;
const AMOUNT_COLUMN_GAP = 4;
export const PERPS_PRO_MARGIN_AMOUNT_INSETS = {
  left: MIN_BUTTON_WIDTH + AMOUNT_COLUMN_GAP,
  right: MAX_BUTTON_WIDTH + AMOUNT_COLUMN_GAP,
} as const;

const PerpsProManageMarginBottomSheetTextInput = React.forwardRef<
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

PerpsProManageMarginBottomSheetTextInput.displayName =
  'PerpsProManageMarginBottomSheetTextInput';

export const PerpsProManageMarginAmountRow = React.memo(
  React.forwardRef<
    TextInput,
    {
      draft: string;
      onBeginEditing: () => void;
      onChangeDraft: (value: string) => void;
      onSelectTarget: (value: string) => void;
      pending: boolean;
      range: PositionMarginRange | null;
    }
  >(
    (
      { draft, onBeginEditing, onChangeDraft, onSelectTarget, pending, range },
      forwardedRef,
    ) => {
      const inputRef = useRef<TextInput>(null);
      const { styles } = useTheme2024({ getStyle });
      const { t } = useTranslation();
      useImperativeHandle(forwardedRef, () => inputRef.current!);

      const focusInput = useCallback(() => inputRef.current?.focus(), []);

      return (
        <View
          style={styles.amountRow}
          testID="perps-pro-manage-margin-amount-row">
          <Pressable
            accessibilityRole="button"
            disabled={pending || !range}
            onPress={() => range && onSelectTarget(range.displayMin)}
            style={[styles.boundButton, styles.minButton]}
            testID="perps-pro-manage-margin-min">
            <Text style={styles.boundButtonText}>
              {t('page.perps.pro.positions.min')}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={pending}
            onPress={focusInput}
            style={styles.amountEditor}
            testID="perps-pro-manage-margin-amount-editor">
            <Text pointerEvents="none" style={styles.unit}>
              $
            </Text>
            <View
              style={styles.inputViewport}
              testID="perps-pro-manage-margin-input-viewport">
              <Text
                accessible={false}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                pointerEvents="none"
                style={[styles.amountInput, styles.inputMeasure]}
                testID="perps-pro-manage-margin-input-measure">
                {draft || '0'}
              </Text>
              <PerpsProDecimalTextInput
                accessibilityLabel={t(
                  'page.perps.pro.positions.configureMargin',
                )}
                cursorColor={PERPS_PRO_DIALOG_TOKENS.inputCursor}
                editable={!pending}
                inputComponent={PerpsProManageMarginBottomSheetTextInput}
                keyboardType="decimal-pad"
                maxDecimals={2}
                onChangeText={onChangeDraft}
                onFocus={onBeginEditing}
                ref={inputRef}
                selectionColor={PERPS_PRO_DIALOG_TOKENS.inputCursor}
                style={[
                  styles.amountInput,
                  styles.inputOverlay,
                  PERPS_PRO_ANDROID_SINGLE_LINE_INPUT_STYLE,
                ]}
                testID="perps-pro-manage-margin-input"
                value={draft}
              />
            </View>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={pending || !range}
            onPress={() => range && onSelectTarget(range.max)}
            style={[styles.boundButton, styles.maxButton]}
            testID="perps-pro-manage-margin-max">
            <Text style={[styles.boundButtonText, styles.maxLabel]}>
              {t('page.perps.pro.positions.max')}
            </Text>
          </Pressable>
        </View>
      );
    },
  ),
);

PerpsProManageMarginAmountRow.displayName = 'PerpsProManageMarginAmountRow';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  amountRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    height: 62,
    justifyContent: 'space-between',
    left: 16,
    position: 'absolute',
    right: 16,
    top: 44,
  },
  boundButton: {
    alignItems: 'center',
    backgroundColor: colord(PERPS_PRO_DIALOG_TOKENS.actionBackground)
      .alpha(0.12)
      .toRgbString(),
    borderRadius: 8,
    marginTop: 8,
    height: 26,
    justifyContent: 'center',
    zIndex: 2,
  },
  minButton: { width: MIN_BUTTON_WIDTH },
  maxButton: { width: MAX_BUTTON_WIDTH },
  maxLabel: { textTransform: 'uppercase' },
  boundButtonText: {
    color: PERPS_PRO_DIALOG_TOKENS.actionBackground,
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
  },
  amountEditor: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    height: 42,
    position: 'absolute',
    ...PERPS_PRO_MARGIN_AMOUNT_INSETS,
  },
  unit: {
    ...PERPS_PRO_DIALOG_HEAVY_TEXT_STYLE,
    color: colors2024['neutral-title-1'],
    fontSize: 36,
    lineHeight: 42,
  },
  amountInput: {
    ...PERPS_PRO_NUMBER_STYLE,
    ...PERPS_PRO_DIALOG_HEAVY_TEXT_STYLE,
    color: colors2024['neutral-title-1'],
    fontSize: 36,
    height: 42,
    lineHeight: 42,
    margin: 0,
    padding: 0,
    textAlign: 'left',
  },
  inputMeasure: { opacity: 0 },
  inputViewport: {
    flexShrink: 1,
    ...(IS_ANDROID
      ? {
          height: 36,
          marginHorizontal: -4,
          overflow: 'hidden',
          paddingHorizontal: 4,
        }
      : {}),
  },
  inputOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    ...(IS_ANDROID ? { height: 54, left: 4, right: 4, top: -9 } : {}),
  },
}));
