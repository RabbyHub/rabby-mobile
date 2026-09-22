import { PERPS_PRO_NUMBER_STYLE } from '../common/perpsProNumberText';
import RcAlarm from '@/assets2024/icons/perps/PerpsProMarginAlarm.svg';
import AutoLockView from '@/components/AutoLockView';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { Text, TextInput } from '@/components/Typography';
import { Button } from '@/components2024/Button';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import {
  BOTTOM_BUTTON_SINGLE_HEIGHT,
  getBottomButtonBottomOffset,
  BOTTOM_BUTTON_BOTTOM_OFFSET,
} from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import React, { useCallback, useEffect, useRef } from 'react';
import { Keyboard, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { PerpsProManageMarginView } from '../../scene/usePerpsProManageMargin';
import {
  getPerpsProDialogStyles,
  resolvePerpsProDialogCardBackground,
} from '../common/perpsProDialogVisual';
import { PerpsProDialogBackdrop } from '../common/PerpsProDialogBackdrop';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getPerpsProMetadataTagContainerStyle,
  getPerpsProMetadataTagTextStyle,
  getPerpsProTintedTagContainerStyle,
  getPerpsProTintedTagTextStyle,
} from '../common/perpsProSemanticTagStyles';
import {
  formatPerpsProDecimal,
  formatPerpsProPercent,
  formatPerpsProPrice,
} from '../../utils/format';
import { usePerpsProSheetNavigationRegistration } from '../common/perpsProSheetNavigationRegistry';
import {
  PerpsProManageMarginAmountRow,
  PERPS_PRO_MARGIN_AMOUNT_INSETS,
} from './PerpsProManageMarginAmountRow';
import { PerpsProManageMarginSlider } from './PerpsProManageMarginSlider';

const SHEET_HEIGHT = 564;
const CONTENT_HEIGHT = SHEET_HEIGHT - 40;

const formatManageMarginLiquidationPrice = (
  value: string | null,
  pxDecimals: number,
) => {
  if (value === '0') {
    return '0';
  }
  const formatted = formatPerpsProPrice(value, pxDecimals);
  return formatted === '-' ? '--' : formatted;
};

interface ManageMarginPresentation {
  draft: string;
  view: PerpsProManageMarginView;
}

export const PerpsProManageMarginSheet: React.FC<{
  dirty: boolean;
  draft: string;
  onBeginEditing: () => void;
  onChangeDraft: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  onSelectTarget: (value: string) => void;
  pending: boolean;
  view: PerpsProManageMarginView;
  visible: boolean;
}> = React.memo(
  ({
    dirty,
    draft,
    onBeginEditing,
    onChangeDraft,
    onClose,
    onConfirm,
    onSelectTarget,
    pending,
    view,
    visible,
  }) => {
    const modalRef = useRef<AppBottomSheetModal>(null);
    const inputRef = useRef<TextInput>(null);
    const { colors2024, styles } = useTheme2024({ getStyle });
    const { t } = useTranslation();
    const { bottom } = useSafeAreaInsets();
    const bottomInset =
      getBottomButtonBottomOffset(bottom) - BOTTOM_BUTTON_BOTTOM_OFFSET;
    const interactivePresentation = { draft, view };
    const lastInteractivePresentationRef = useRef<ManageMarginPresentation>(
      interactivePresentation,
    );
    if (!pending) {
      lastInteractivePresentationRef.current = interactivePresentation;
    }
    const presentation = pending
      ? lastInteractivePresentationRef.current
      : interactivePresentation;
    const displayDraft = presentation.draft;
    const displayView = presentation.view;
    const hasBoundaryError =
      displayView.targetState === 'belowMin' ||
      displayView.targetState === 'aboveMax';
    const range = displayView.range;
    const confirmDisabled =
      pending || !dirty || displayView.targetState !== 'valid';
    usePerpsProSheetNavigationRegistration({
      active: visible,
      dismiss: onClose,
      dismissible: !pending,
    });

    useEffect(() => {
      if (visible) {
        modalRef.current?.present();
      } else {
        modalRef.current?.close();
      }
    }, [visible]);

    const dismissInput = useCallback(() => {
      inputRef.current?.blur();
      Keyboard.dismiss();
    }, []);
    const selectTarget = useCallback(
      (value: string) => {
        dismissInput();
        onSelectTarget(value);
      },
      [dismissInput, onSelectTarget],
    );
    const currentDistance = displayView.currentLiquidationDistance
      ? formatPerpsProPercent(
          Number(displayView.currentLiquidationDistance),
          2,
          false,
        )
      : '--';
    const projectedDistance = displayView.projectedLiquidationDistance
      ? formatPerpsProPercent(
          Number(displayView.projectedLiquidationDistance),
          2,
          false,
        )
      : '--';
    const currentLiq = formatManageMarginLiquidationPrice(
      displayView.currentLiquidationPrice,
      displayView.pxDecimals,
    );
    const projectedLiq = formatManageMarginLiquidationPrice(
      displayView.projectedLiquidationPrice,
      displayView.pxDecimals,
    );

    return (
      <AppBottomSheetModal
        {...makeBottomSheetProps({
          colors: colors2024,
          linearGradientType: 'bg0',
        })}
        android_keyboardInputMode="adjustPan"
        backdropComponent={PerpsProDialogBackdrop}
        backdropProps={{ pressBehavior: pending ? 'none' : 'close' }}
        backgroundStyle={styles.background}
        enableDynamicSizing={false}
        enablePanDownToClose={!pending}
        handleIndicatorStyle={styles.handleIndicator}
        handleStyle={styles.handle}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        onDismiss={onClose}
        ref={modalRef}
        snapPoints={[SHEET_HEIGHT + bottomInset]}
        style={styles.modal}>
        <BottomSheetView>
          <AutoLockView
            style={styles.container}
            testID="perps-pro-manage-margin-sheet">
            <Text style={styles.title}>
              {t('page.perps.pro.positions.manageMargin')}
            </Text>
            <View style={styles.infoCard}>
              <View style={styles.identityRow}>
                <Text style={styles.pair}>{displayView.displayPair}</Text>
                {displayView.sourceTag ? (
                  <View
                    style={styles.sourceTag}
                    testID="perps-pro-manage-margin-source-tag">
                    <Text style={styles.sourceText}>
                      {displayView.sourceTag}
                    </Text>
                  </View>
                ) : null}
                <View
                  style={
                    displayView.direction === 'long'
                      ? styles.longTag
                      : styles.shortTag
                  }
                  testID="perps-pro-manage-margin-direction-tag">
                  <Text
                    style={
                      displayView.direction === 'long'
                        ? styles.longText
                        : styles.shortText
                    }>
                    {displayView.direction === 'long'
                      ? t('page.perps.pro.positions.long')
                      : t('page.perps.pro.positions.short')}{' '}
                    {displayView.leverage}x
                  </Text>
                </View>
              </View>
              <View style={styles.priceGroup}>
                <View style={styles.factRow}>
                  <Text style={styles.factLabel}>
                    {t('page.perps.pro.positions.entry')} (
                    {displayView.quoteAsset})
                  </Text>
                  <Text style={styles.factValueRounded}>
                    {formatPerpsProPrice(
                      displayView.entryPrice,
                      displayView.pxDecimals,
                    )}
                  </Text>
                </View>
                <View style={styles.factRow}>
                  <Text style={styles.factLabel}>
                    {t('page.perps.pro.positions.mark')} (
                    {displayView.quoteAsset})
                  </Text>
                  <Text style={styles.factValue}>
                    {formatPerpsProPrice(
                      displayView.markPrice,
                      displayView.pxDecimals,
                    )}
                  </Text>
                </View>
              </View>
            </View>
            <View
              style={styles.amountCard}
              testID="perps-pro-manage-margin-amount-card">
              <Text style={styles.configureLabel}>
                {t('page.perps.pro.positions.margin')}{' '}
                <Text style={styles.configureUnit}>
                  ({displayView.quoteAsset})
                </Text>
              </Text>
              <PerpsProManageMarginAmountRow
                draft={displayDraft}
                onBeginEditing={onBeginEditing}
                onChangeDraft={onChangeDraft}
                onSelectTarget={selectTarget}
                pending={pending}
                range={range}
                ref={inputRef}
              />
              <Text style={styles.minimumValue}>
                {range ? formatPerpsProDecimal(range.displayMin, 2) : '--'}
              </Text>
              <Text style={styles.maximumValue}>
                {range ? formatPerpsProDecimal(range.max, 2) : '--'}
              </Text>
              <View style={styles.slider}>
                <PerpsProManageMarginSlider
                  disabled={pending || !range?.hasRepresentableRange}
                  dimWhenDisabled={!range?.hasRepresentableRange}
                  maximum={range?.max ?? '0'}
                  minimum={range?.displayMin ?? '0'}
                  onValueChange={onSelectTarget}
                  value={displayDraft}
                />
              </View>
              {hasBoundaryError ? (
                <View
                  style={styles.warning}
                  testID="perps-pro-manage-margin-warning">
                  <Text numberOfLines={1} style={styles.warningText}>
                    {displayView.targetState === 'belowMin'
                      ? t('page.perps.pro.positions.minimumMargin', {
                          amount: formatPerpsProDecimal(range?.min, 2),
                          quote: displayView.quoteAsset,
                        })
                      : t('page.perps.pro.positions.maximumMargin', {
                          amount: formatPerpsProDecimal(range?.max, 2),
                          quote: displayView.quoteAsset,
                        })}
                  </Text>
                </View>
              ) : null}
            </View>

            <View
              style={styles.riskGroup}
              testID="perps-pro-manage-margin-risk">
              <View style={styles.factRow}>
                <Text style={styles.factLabel}>
                  {t('page.perps.pro.positions.liquidation')}
                </Text>
                <Text style={styles.factValue}>
                  {currentLiq}→ {projectedLiq}
                </Text>
              </View>
              <View style={styles.factRow}>
                <Text style={styles.factLabel}>
                  {t('page.perps.pro.positions.liquidationDistance')}
                </Text>
                <View style={styles.riskValue}>
                  <RcAlarm
                    color={colors2024['neutral-info']}
                    height={16}
                    width={16}
                  />
                  <Text style={styles.factValue}>
                    {currentDistance}→ {projectedDistance}
                  </Text>
                </View>
              </View>
            </View>
            <View style={styles.footer} testID="perps-pro-manage-margin-footer">
              <Button
                buttonStyle={[
                  styles.button,
                  confirmDisabled && styles.buttonDisabled,
                ]}
                disabledTitleStyle={styles.buttonDisabledTitle}
                disabled={confirmDisabled}
                height={BOTTOM_BUTTON_SINGLE_HEIGHT}
                loading={pending}
                loadingProps={{ color: styles.buttonDisabledTitle.color }}
                onPress={() => {
                  dismissInput();
                  onConfirm();
                }}
                testID="perps-pro-manage-margin-confirm"
                title={t('global.confirm')}
                titleStyle={styles.buttonTitle}
                type="primary"
              />
            </View>
          </AutoLockView>
        </BottomSheetView>
      </AppBottomSheetModal>
    );
  },
);

PerpsProManageMarginSheet.displayName = 'PerpsProManageMarginSheet';

const getStyle = createGetStyles2024(
  ({ colors2024, isLight, safeAreaInsets }) => ({
    ...getPerpsProDialogStyles(colors2024, safeAreaInsets.bottom, isLight),
    container: {
      height:
        CONTENT_HEIGHT +
        getBottomButtonBottomOffset(safeAreaInsets.bottom) -
        BOTTOM_BUTTON_BOTTOM_OFFSET,
      paddingHorizontal: 16,
      paddingTop: 8,
      position: 'relative',
    },
    infoCard: {
      backgroundColor: resolvePerpsProDialogCardBackground(colors2024, isLight),
      borderRadius: 12,
      padding: 16,
      gap: 10,
      height: 104,
      left: 16,
      right: 16,
      top: 56,
      position: 'absolute',
    },
    identityRow: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      gap: 4,
      height: 20,
    },
    pair: {
      color: colors2024['neutral-title-1'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 16,
      fontWeight: '700',
      lineHeight: 20,
    },
    sourceTag: {
      alignItems: 'center',
      ...getPerpsProMetadataTagContainerStyle(colors2024),
      justifyContent: 'center',
    },
    sourceText: getPerpsProMetadataTagTextStyle(colors2024),
    longTag: {
      alignItems: 'center',
      ...getPerpsProTintedTagContainerStyle(colors2024, 'positive'),
      justifyContent: 'center',
    },
    shortTag: {
      alignItems: 'center',
      ...getPerpsProTintedTagContainerStyle(colors2024, 'negative'),
      justifyContent: 'center',
    },
    longText: getPerpsProTintedTagTextStyle(colors2024, 'positive'),
    shortText: getPerpsProTintedTagTextStyle(colors2024, 'negative'),
    priceGroup: { gap: 10 },
    factRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 8,
      height: 16,
      justifyContent: 'space-between',
    },
    factLabel: {
      color: colors2024['neutral-secondary'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 12,
      lineHeight: 16,
    },
    factValue: {
      ...PERPS_PRO_NUMBER_STYLE,
      flexShrink: 1,
      minWidth: 0,
      textAlign: 'right',
      color: colors2024['neutral-title-1'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 12,
      fontWeight: '500',
      lineHeight: 16,
    },
    factValueRounded: {
      ...PERPS_PRO_NUMBER_STYLE,
      flexShrink: 1,
      minWidth: 0,
      textAlign: 'right',
      color: colors2024['neutral-title-1'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 12,
      fontWeight: '500',
      lineHeight: 16,
    },
    configureLabel: {
      color: colors2024['neutral-title-1'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 16,
      fontWeight: '700',
      lineHeight: 20,
      position: 'absolute',
      left: 16,
      top: 16,
    },
    configureUnit: {
      color: colors2024['neutral-title-1'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 12,
      fontWeight: '500',
      lineHeight: 16,
    },
    amountCard: {
      backgroundColor: resolvePerpsProDialogCardBackground(colors2024, isLight),
      borderRadius: 12,
      height: 162,
      left: 16,
      position: 'absolute',
      right: 16,
      top: 168,
    },
    minimumValue: {
      ...PERPS_PRO_NUMBER_STYLE,
      color: colors2024['neutral-secondary'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 12,
      fontWeight: '500',
      left: 16,
      minWidth: 32,
      textAlign: 'center',
      lineHeight: 16,
      position: 'absolute',
      top: 82,
    },
    maximumValue: {
      ...PERPS_PRO_NUMBER_STYLE,
      color: colors2024['neutral-secondary'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 12,
      fontWeight: '500',
      lineHeight: 16,
      position: 'absolute',
      right: 16,
      minWidth: 40,
      textAlign: 'center',
      top: 82,
    },
    slider: { left: 16, position: 'absolute', right: 16, top: 114 },
    warning: {
      alignItems: 'center',
      left: 16 + PERPS_PRO_MARGIN_AMOUNT_INSETS.left,
      position: 'absolute',
      right: 16 + PERPS_PRO_MARGIN_AMOUNT_INSETS.right,
      top: 90,
    },
    warningText: {
      color: colors2024['red-default'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 12,
      fontWeight: '500',
      lineHeight: 16,
    },
    riskGroup: {
      backgroundColor: resolvePerpsProDialogCardBackground(colors2024, isLight),
      borderRadius: 12,
      padding: 16,
      height: 74,
      gap: 10,
      left: 16,
      position: 'absolute',
      right: 16,
      top: 338,
    },
    riskValue: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 4,
      flexShrink: 1,
      minWidth: 0,
    },
    footer: {
      bottom: getBottomButtonBottomOffset(safeAreaInsets.bottom),
      left: 20,
      position: 'absolute',
      right: 20,
    },
  }),
);
