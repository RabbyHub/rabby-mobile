import RcTransferUSDC from '@/assets2024/icons/perps/PerpsProTransferUSDC.svg';
import AutoLockView from '@/components/AutoLockView';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { Text } from '@/components/Typography';
import { Button } from '@/components2024/Button';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import {
  BOTTOM_BUTTON_SINGLE_HEIGHT,
  BOTTOM_BUTTON_BOTTOM_OFFSET,
  getBottomButtonBottomOffset,
} from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import { BottomSheetTextInput, BottomSheetView } from '@gorhom/bottom-sheet';
import BigNumber from 'bignumber.js';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { usePerpsProKeyboardInput } from '../common/usePerpsProKeyboardInput';
import { PERPS_PRO_ANDROID_SINGLE_LINE_INPUT_STYLE } from '../common/perpsProSingleLineInput';
import { formatPerpsProDecimal } from '../../utils/format';
import { PerpsProDialogBackdrop } from '../common/PerpsProDialogBackdrop';
import { PERPS_PRO_DIALOG_TOKENS } from '../common/perpsProDialogVisual';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePerpsProSheetNavigationRegistration } from '../common/perpsProSheetNavigationRegistry';
import { getPerpsProTransferSheetStyles } from './PerpsProTransferSheet.styles';

const SHORTCUTS = [0.25, 0.5, 0.75, 1] as const;

const isUnsignedDecimalInput = (value: string) => /^\d*\.?\d*$/.test(value);

export const PerpsProTransferSheet: React.FC<{
  available: string;
  onClose: () => void;
  onConfirm: (amount: string) => void;
  pending: boolean;
  visible: boolean;
}> = React.memo(({ available, onClose, onConfirm, pending, visible }) => {
  const modalRef = useRef<AppBottomSheetModal>(null);
  const inputRef = useRef<React.ElementRef<typeof BottomSheetTextInput>>(null);
  const keyboard = usePerpsProKeyboardInput(inputRef, { enabled: visible });
  const [amount, setAmount] = useState('');
  const { colors2024, styles } = useTheme2024({
    getStyle: getPerpsProTransferSheetStyles,
  });
  const { t } = useTranslation();
  const { bottom } = useSafeAreaInsets();
  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <PerpsProDialogBackdrop
        {...props}
        pressBehavior={pending ? 'none' : 'close'}
      />
    ),
    [pending],
  );
  usePerpsProSheetNavigationRegistration({
    active: visible,
    dismiss: onClose,
    dismissible: !pending,
  });

  useEffect(() => {
    if (visible) {
      setAmount('');
      modalRef.current?.present();
    } else {
      modalRef.current?.close();
    }
  }, [visible]);

  const availableValue = useMemo(
    () => new BigNumber(available || 0),
    [available],
  );
  const amountValue = useMemo(() => new BigNumber(amount || 0), [amount]);
  const hasAvailable = availableValue.isFinite() && availableValue.gt(0);
  const valid =
    amountValue.isFinite() &&
    amountValue.gt(0) &&
    hasAvailable &&
    amountValue.lte(availableValue);

  return (
    <AppBottomSheetModal
      ref={modalRef}
      {...makeBottomSheetProps({
        colors: colors2024,
        linearGradientType: 'bg0',
      })}
      backgroundStyle={styles.background}
      backdropComponent={renderBackdrop}
      enableDynamicSizing={false}
      enablePanDownToClose={!pending}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      handleIndicatorStyle={styles.handleIndicator}
      handleStyle={styles.handle}
      onDismiss={() => {
        if (!pending) onClose();
      }}
      style={styles.modal}
      snapPoints={[
        490 + getBottomButtonBottomOffset(bottom) - BOTTOM_BUTTON_BOTTOM_OFFSET,
      ]}>
      <BottomSheetView style={styles.sheetView}>
        <AutoLockView style={styles.container}>
          <Text style={styles.title}>
            {t('page.perps.pro.account.transfer')}
          </Text>
          <View style={styles.content}>
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>
                {t('page.perps.pro.account.transfer')}
              </Text>
              <View
                style={styles.directionCard}
                testID="perps-pro-transfer-direction-card">
                <View style={styles.directionRow}>
                  <Text style={styles.directionLabel}>{t('global.from')}</Text>
                  <Text style={styles.directionValue}>
                    {t('page.perps.pro.account.spot')}
                  </Text>
                </View>
                <View style={styles.directionRow}>
                  <Text style={styles.directionLabel}>{t('global.to')}</Text>
                  <Text style={styles.directionValue}>
                    {t('page.perps.pro.account.perps')}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <View
                style={styles.amountHeader}
                testID="perps-pro-transfer-amount-header">
                <Text style={styles.sectionLabel}>
                  {t('page.perps.pro.account.amount')}
                </Text>
                <Text style={styles.balance}>{`${t(
                  'page.perps.pro.account.balance',
                )}:${formatPerpsProDecimal(available, 2)} USDC`}</Text>
              </View>
              <View
                style={styles.amountField}
                testID="perps-pro-transfer-amount-field">
                <Text pointerEvents="none" style={styles.amountPrefix}>
                  $
                </Text>
                <BottomSheetTextInput
                  {...keyboard}
                  ref={inputRef}
                  accessibilityLabel={t('page.perps.pro.account.amount')}
                  allowFontScaling={false}
                  cursorColor={PERPS_PRO_DIALOG_TOKENS.inputCursor}
                  editable={!pending}
                  keyboardType="decimal-pad"
                  onChangeText={value => {
                    if (isUnsignedDecimalInput(value)) setAmount(value);
                  }}
                  placeholder="0"
                  placeholderTextColor={colors2024['neutral-foot']}
                  selectionColor={PERPS_PRO_DIALOG_TOKENS.inputCursor}
                  style={[
                    styles.amountInput,
                    PERPS_PRO_ANDROID_SINGLE_LINE_INPUT_STYLE,
                  ]}
                  testID="perps-pro-transfer-amount"
                  value={amount}
                />
                <View
                  style={styles.tokenPill}
                  testID="perps-pro-transfer-token-pill">
                  <RcTransferUSDC
                    width={24}
                    height={24}
                    testID="perps-pro-transfer-usdc-icon"
                  />
                  <Text style={styles.tokenText}>USDC</Text>
                </View>
              </View>
              <View style={styles.shortcuts}>
                {SHORTCUTS.map(shortcut => (
                  <Pressable
                    accessibilityRole="button"
                    disabled={pending || !hasAvailable}
                    key={shortcut}
                    onPress={() => {
                      if (!availableValue.isFinite() || availableValue.lte(0)) {
                        return;
                      }
                      setAmount(
                        availableValue
                          .multipliedBy(shortcut)
                          .decimalPlaces(2, BigNumber.ROUND_DOWN)
                          .toFixed(),
                      );
                    }}
                    style={[
                      styles.shortcut,
                      (pending || !hasAvailable) && styles.shortcutDisabled,
                    ]}
                    testID={`perps-pro-transfer-shortcut-${shortcut}`}>
                    <Text style={styles.shortcutText}>
                      {shortcut === 1
                        ? t('page.perps.pro.account.max')
                        : `${shortcut * 100}%`}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
          <View style={styles.footer} testID="perps-pro-transfer-footer">
            <Button
              disabled={!valid || pending}
              buttonStyle={[
                styles.button,
                (!valid || pending) && styles.buttonDisabled,
              ]}
              height={BOTTOM_BUTTON_SINGLE_HEIGHT}
              loading={pending}
              onPress={() => onConfirm(amountValue.toFixed())}
              title={t('global.confirm')}
              titleStyle={styles.buttonTitle}
              disabledTitleStyle={styles.buttonDisabledTitle}
              type="primary"
            />
          </View>
        </AutoLockView>
      </BottomSheetView>
    </AppBottomSheetModal>
  );
});

PerpsProTransferSheet.displayName = 'PerpsProTransferSheet';
