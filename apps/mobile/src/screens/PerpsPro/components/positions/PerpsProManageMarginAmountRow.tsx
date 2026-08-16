import { Text, TextInput } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import React, { useCallback, useImperativeHandle, useRef } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { PositionMarginRange } from '../../model/positionMargin';
import { PerpsProDecimalTextInput } from '../trade/PerpsProDecimalTextInput';

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
      quoteAsset: string;
      range: PositionMarginRange | null;
    }
  >(
    (
      {
        draft,
        onBeginEditing,
        onChangeDraft,
        onSelectTarget,
        pending,
        quoteAsset,
        range,
      },
      forwardedRef,
    ) => {
      const inputRef = useRef<TextInput>(null);
      const { colors2024, styles } = useTheme2024({ getStyle });
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
            onPress={() => range && onSelectTarget(range.min)}
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
              {quoteAsset}
            </Text>
            <PerpsProDecimalTextInput
              accessibilityLabel={t('page.perps.pro.positions.configureMargin')}
              cursorColor={colors2024['brand-default']}
              editable={!pending}
              inputComponent={PerpsProManageMarginBottomSheetTextInput}
              keyboardType="decimal-pad"
              maxDecimals={2}
              onChangeText={onChangeDraft}
              onFocus={onBeginEditing}
              ref={inputRef}
              selectionColor={colors2024['brand-default']}
              style={styles.amountInput}
              testID="perps-pro-manage-margin-input"
              value={draft}
            />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={pending || !range}
            onPress={() => range && onSelectTarget(range.max)}
            style={[styles.boundButton, styles.maxButton]}
            testID="perps-pro-manage-margin-max">
            <Text style={styles.boundButtonText}>
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
    alignItems: 'center',
    flexDirection: 'row',
    height: 58,
    justifyContent: 'space-between',
    left: 12,
    position: 'absolute',
    right: 12,
    top: 16,
  },
  boundButton: {
    alignItems: 'center',
    backgroundColor: colors2024['neutral-bg-1'],
    borderRadius: 6,
    height: 26,
    justifyContent: 'center',
    zIndex: 2,
  },
  minButton: { width: 37 },
  maxButton: { width: 44 },
  boundButtonText: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
  amountEditor: {
    alignItems: 'center',
    flex: 1,
    height: 58,
  },
  unit: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro',
    fontSize: 12,
    lineHeight: 16,
  },
  amountInput: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro',
    fontSize: 36,
    fontWeight: '700',
    height: 42,
    lineHeight: 42,
    margin: 0,
    padding: 0,
    textAlign: 'center',
    width: '100%',
  },
}));
