import RcAlarm from '@/assets2024/icons/perps/PerpsProMarginAlarm.svg';
import RcWarning from '@/assets2024/icons/perps/PerpsProMarginWarning.svg';
import AutoLockView from '@/components/AutoLockView';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { Text, TextInput } from '@/components/Typography';
import { Button } from '@/components2024/Button';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { BOTTOM_BUTTON_COMPACT_HEIGHT } from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import React, { useCallback, useEffect, useRef } from 'react';
import { Keyboard, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { PerpsProManageMarginView } from '../../scene/usePerpsProManageMargin';
import {
  getPerpsProBottomSheetChromeStyles,
  PERPS_PRO_COMPACT_BUTTON_TITLE_STYLE,
  resolvePerpsProFieldBackground,
} from '../common/perpsProVisual';
import {
  formatPerpsProDecimal,
  formatPerpsProPercent,
  formatPerpsProPrice,
} from '../../utils/format';
import { usePerpsProSheetNavigationRegistration } from '../common/perpsProSheetNavigationRegistry';
import { PerpsProManageMarginAmountRow } from './PerpsProManageMarginAmountRow';
import { PerpsProManageMarginSlider } from './PerpsProManageMarginSlider';

const SHEET_HEIGHT = 552;
const CONTENT_HEIGHT = SHEET_HEIGHT - 40;

const formatManageMarginLiquidationPrice = (
  value: string | null,
  pxDecimals: number,
) => {
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
      ? formatPerpsProPercent(Number(displayView.currentLiquidationDistance), 2)
      : '--';
    const projectedDistance = displayView.projectedLiquidationDistance
      ? formatPerpsProPercent(
          Number(displayView.projectedLiquidationDistance),
          2,
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
          linearGradientType: 'bg1',
        })}
        android_keyboardInputMode="adjustPan"
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
        snapPoints={[SHEET_HEIGHT]}
        style={styles.modal}>
        <BottomSheetView>
          <AutoLockView
            style={styles.container}
            testID="perps-pro-manage-margin-sheet">
            <Text style={styles.title}>
              {t('page.perps.pro.positions.manageMargin')}
            </Text>
            <View style={styles.identityRow}>
              <Text style={styles.pair}>{displayView.displayPair}</Text>
              {displayView.sourceTag ? (
                <View style={styles.sourceTag}>
                  <Text style={styles.sourceText}>{displayView.sourceTag}</Text>
                </View>
              ) : null}
              <View
                style={
                  displayView.direction === 'long'
                    ? styles.longTag
                    : styles.shortTag
                }>
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
                  {t('page.perps.pro.positions.mark')} ({displayView.quoteAsset}
                  )
                </Text>
                <Text style={styles.factValue}>
                  {formatPerpsProPrice(
                    displayView.markPrice,
                    displayView.pxDecimals,
                  )}
                </Text>
              </View>
            </View>

            <Text style={styles.configureLabel}>
              {t('page.perps.pro.positions.configureMargin')}
            </Text>
            <View
              style={[
                styles.amountCard,
                hasBoundaryError && styles.amountCardError,
              ]}
              testID="perps-pro-manage-margin-amount-card">
              <PerpsProManageMarginAmountRow
                draft={displayDraft}
                onBeginEditing={onBeginEditing}
                onChangeDraft={onChangeDraft}
                onSelectTarget={selectTarget}
                pending={pending}
                quoteAsset={displayView.quoteAsset}
                range={range}
                ref={inputRef}
              />
              <Text style={styles.minimumValue}>
                {range ? formatPerpsProDecimal(range.min, 2) : '--'}
              </Text>
              <Text style={styles.maximumValue}>
                {range ? formatPerpsProDecimal(range.max, 2) : '--'}
              </Text>
              <View style={styles.slider}>
                <PerpsProManageMarginSlider
                  disabled={pending || !range?.hasRepresentableRange}
                  dimWhenDisabled={!range?.hasRepresentableRange}
                  maximum={range?.max ?? '0'}
                  minimum={range?.min ?? '0'}
                  onValueChange={onSelectTarget}
                  value={displayDraft}
                />
              </View>
              {hasBoundaryError ? (
                <View
                  style={styles.warning}
                  testID="perps-pro-manage-margin-warning">
                  <RcWarning
                    color={colors2024['orange-default']}
                    height={14}
                    width={14}
                  />
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
              style={[
                styles.riskGroup,
                hasBoundaryError && styles.riskGroupError,
              ]}
              testID="perps-pro-manage-margin-risk">
              <View style={styles.factRow}>
                <Text style={styles.factLabel}>
                  {t('page.perps.pro.positions.liquidation')}
                </Text>
                <Text style={styles.factValue}>
                  {currentLiq} → {projectedLiq}
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
                    {currentDistance} → {projectedDistance}
                  </Text>
                </View>
              </View>
            </View>
            <View style={styles.footer} testID="perps-pro-manage-margin-footer">
              <Button
                disabled={confirmDisabled}
                height={BOTTOM_BUTTON_COMPACT_HEIGHT}
                loading={pending}
                onPress={() => {
                  dismissInput();
                  onConfirm();
                }}
                testID="perps-pro-manage-margin-confirm"
                title={t('global.confirm')}
                titleStyle={PERPS_PRO_COMPACT_BUTTON_TITLE_STYLE}
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
    ...getPerpsProBottomSheetChromeStyles(colors2024),
    container: {
      height: CONTENT_HEIGHT,
      paddingHorizontal: 15,
      paddingTop: 8,
      position: 'relative',
    },
    title: {
      color: colors2024['neutral-title-1'],
      fontFamily: 'SF Pro',
      fontSize: 16,
      fontWeight: '700',
      lineHeight: 20,
    },
    identityRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 4,
      height: 18,
      marginTop: 12,
    },
    pair: {
      color: colors2024['neutral-title-1'],
      fontFamily: 'SF Pro',
      fontSize: 14,
      fontWeight: '500',
      lineHeight: 18,
    },
    sourceTag: {
      alignItems: 'center',
      backgroundColor: colors2024['neutral-bg-5'],
      borderColor: colors2024['neutral-line'],
      borderRadius: 2,
      borderWidth: 0.5,
      justifyContent: 'center',
      paddingHorizontal: 4,
      paddingVertical: 1,
    },
    sourceText: {
      color: colors2024['neutral-body'],
      fontFamily: 'SF Pro',
      fontSize: 10,
      fontWeight: '500',
      lineHeight: 12,
    },
    longTag: {
      alignItems: 'center',
      backgroundColor: colors2024['green-light-1'],
      borderColor: colors2024['green-light-2'],
      borderRadius: 2,
      borderWidth: 0.5,
      justifyContent: 'center',
      paddingHorizontal: 4,
      paddingVertical: 1,
    },
    shortTag: {
      alignItems: 'center',
      backgroundColor: colors2024['red-light-1'],
      borderColor: colors2024['red-light-2'],
      borderRadius: 2,
      borderWidth: 0.5,
      justifyContent: 'center',
      paddingHorizontal: 4,
      paddingVertical: 1,
    },
    longText: {
      color: colors2024['green-default'],
      fontFamily: 'SF Pro',
      fontSize: 10,
      fontWeight: '500',
      lineHeight: 12,
    },
    shortText: {
      color: colors2024['red-default'],
      fontFamily: 'SF Pro',
      fontSize: 10,
      fontWeight: '500',
      lineHeight: 12,
    },
    priceGroup: { gap: 8, marginTop: 16 },
    factRow: {
      alignItems: 'center',
      flexDirection: 'row',
      height: 16,
      justifyContent: 'space-between',
    },
    factLabel: {
      color: colors2024['neutral-secondary'],
      fontFamily: 'SF Pro',
      fontSize: 12,
      lineHeight: 16,
    },
    factValue: {
      color: colors2024['neutral-title-1'],
      fontFamily: 'SF Pro',
      fontSize: 12,
      fontWeight: '500',
      lineHeight: 16,
    },
    factValueRounded: {
      color: colors2024['neutral-title-1'],
      fontFamily: 'SF Pro',
      fontSize: 12,
      fontWeight: '500',
      lineHeight: 16,
    },
    configureLabel: {
      color: colors2024['neutral-title-1'],
      fontFamily: 'SF Pro',
      fontSize: 14,
      fontWeight: '500',
      lineHeight: 18,
      position: 'absolute',
      left: 15,
      top: 138,
    },
    amountCard: {
      backgroundColor: resolvePerpsProFieldBackground({
        darkBackground: colors2024['neutral-bg-5'],
        isLight,
      }),
      borderRadius: 12,
      height: 138,
      left: 15,
      position: 'absolute',
      right: 15,
      top: 164,
    },
    amountCardError: { height: 184 },
    minimumValue: {
      color: colors2024['neutral-secondary'],
      fontFamily: 'SF Pro',
      fontSize: 12,
      fontWeight: '500',
      left: 12,
      lineHeight: 16,
      position: 'absolute',
      top: 62,
    },
    maximumValue: {
      color: colors2024['neutral-secondary'],
      fontFamily: 'SF Pro',
      fontSize: 12,
      fontWeight: '500',
      lineHeight: 16,
      position: 'absolute',
      right: 12,
      top: 62,
    },
    slider: { left: 12, position: 'absolute', right: 12, top: 90 },
    warning: {
      alignItems: 'center',
      backgroundColor: colors2024['orange-light-1'],
      borderRadius: 6,
      flexDirection: 'row',
      gap: 4,
      left: 12,
      padding: 8,
      position: 'absolute',
      right: 12,
      top: 134,
    },
    warningText: {
      color: colors2024['orange-default'],
      flex: 1,
      fontFamily: 'SF Pro',
      fontSize: 12,
      fontWeight: '500',
      lineHeight: 16,
    },
    riskGroup: {
      gap: 8,
      left: 15,
      position: 'absolute',
      right: 15,
      top: 318,
    },
    riskGroupError: { top: 364 },
    riskValue: { alignItems: 'center', flexDirection: 'row', gap: 4 },
    footer: {
      bottom: Math.max(40, safeAreaInsets.bottom),
      left: 15,
      position: 'absolute',
      right: 15,
    },
  }),
);
