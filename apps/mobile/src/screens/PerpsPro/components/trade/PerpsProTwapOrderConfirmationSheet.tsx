import React, { useEffect, useRef } from 'react';
import { Pressable, View } from 'react-native';
import BigNumber from 'bignumber.js';
import { useTranslation } from 'react-i18next';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import AutoLockView from '@/components/AutoLockView';
import { Text } from '@/components/Typography';
import { Button } from '@/components2024/Button';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { BOTTOM_BUTTON_SINGLE_HEIGHT } from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import type { PerpsProTwapOrderCommand } from '../../actions/twapOrder';
import { formatPerpsProDecimal } from '../../utils/format';
import { PerpsProCheckboxIcon } from '../common/PerpsProCheckboxIcon';
import { PerpsProDialogBackdrop } from '../common/PerpsProDialogBackdrop';
import { usePerpsProSheetNavigationRegistration } from '../common/perpsProSheetNavigationRegistry';
import {
  getPerpsProDialogStyles,
  getPerpsProDialogCheckboxStyles,
  getPerpsProConfirmationFooterStyle,
  resolvePerpsProDialogCardBackground,
} from '../common/perpsProDialogVisual';
import { getPerpsProListRowStyles } from '../common/perpsProListVisual';
import { PERPS_PRO_NUMBER_STYLE } from '../common/perpsProNumberText';

export const PerpsProTwapOrderConfirmationSheet = React.memo(
  ({
    command,
    onClose,
    onConfirm,
    onToggleSkip,
    pending,
    skipConfirmation,
  }: {
    command: PerpsProTwapOrderCommand | null;
    onClose: () => void;
    onConfirm: () => void;
    onToggleSkip: () => void;
    pending: boolean;
    skipConfirmation: boolean;
  }) => {
    const { colors2024, styles } = useTheme2024({ getStyle });
    const { t } = useTranslation();
    const modal = useRef<AppBottomSheetModal>(null);
    usePerpsProSheetNavigationRegistration({
      active: !!command,
      dismiss: onClose,
      dismissible: !pending,
    });
    useEffect(() => {
      if (command) modal.current?.present();
      else modal.current?.close();
    }, [command]);
    if (!command) return null;
    const facts = command.reviewFacts;
    const isBuy = command.side === 'buy';
    const base = facts.amountUnit === 'base';
    const size = base
      ? command.baseSize
      : new BigNumber(command.baseSize).times(facts.midPrice).toFixed();
    const rows = [
      [
        t('page.perps.pro.twap.totalSize'),
        `${base ? '' : '≈'}${formatPerpsProDecimal(
          size,
          base ? facts.szDecimals : 2,
        )} ${base ? facts.displayBase : facts.quoteAsset}`,
      ],
      [t('page.perps.pro.twap.totalTime'), `${command.durationMinutes} min`],
      [
        t('page.perps.pro.trade.markPrice'),
        `${formatPerpsProDecimal(facts.markPrice, facts.pxDecimals)} ${
          facts.quoteAsset
        }`,
      ],
      [
        t('page.perps.pro.trade.reduceOnly'),
        t(
          command.reduceOnly
            ? 'page.perps.pro.trade.yes'
            : 'page.perps.pro.trade.no',
        ),
      ],
    ];
    return (
      <AppBottomSheetModal
        ref={modal}
        onDismiss={onClose}
        enableDynamicSizing
        enablePanDownToClose={!pending}
        {...makeBottomSheetProps({
          colors: colors2024,
          linearGradientType: 'bg0',
        })}
        backdropComponent={PerpsProDialogBackdrop}
        backgroundStyle={styles.background}
        handleIndicatorStyle={styles.handleIndicator}
        handleStyle={styles.handle}
        style={styles.modal}>
        <BottomSheetView>
          <AutoLockView style={styles.container}>
            <Text style={styles.title}>{facts.displayPair}</Text>
            <View style={styles.tags}>
              {facts.sourceTag ? (
                <Text style={styles.tag}>{facts.sourceTag}</Text>
              ) : null}
              <Text style={styles.tag}>
                {facts.marginMode === 'cross' ? 'Cross' : 'Isolated'}{' '}
                {facts.leverage}x
              </Text>
            </View>
            <View style={styles.details}>
              <View style={styles.row}>
                <Text style={styles.label}>
                  {t('page.perps.pro.trade.direction')}
                </Text>
                <Text
                  style={[
                    styles.value,
                    {
                      color:
                        colors2024[isBuy ? 'green-default' : 'red-default'],
                    },
                  ]}>
                  {t(`page.perps.pro.trade.${isBuy ? 'buy' : 'sell'}`)} /{' '}
                  {t(`page.perps.pro.trade.${isBuy ? 'long' : 'short'}`)}
                </Text>
              </View>
              {rows.map(([label, value]) => (
                <View key={label} style={styles.row}>
                  <Text style={styles.label}>{label}</Text>
                  <Text numberOfLines={1} style={styles.value}>
                    {value}
                  </Text>
                </View>
              ))}
            </View>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: skipConfirmation }}
              onPress={onToggleSkip}
              style={styles.checkboxRow}>
              <PerpsProCheckboxIcon
                checked={skipConfirmation}
                checkColor={colors2024['neutral-InvertHighlight']}
              />
              <Text style={styles.checkboxText}>
                {t('page.perps.pro.twap.skipConfirmation')}
              </Text>
            </Pressable>
            <View style={styles.footer}>
              <Button
                type="primary"
                height={BOTTOM_BUTTON_SINGLE_HEIGHT}
                title={t('global.confirm')}
                onPress={onConfirm}
                loading={pending}
                disabled={pending}
                buttonStyle={[styles.button, pending && styles.buttonDisabled]}
                titleStyle={styles.buttonTitle}
              />
            </View>
          </AutoLockView>
        </BottomSheetView>
      </AppBottomSheetModal>
    );
  },
);
PerpsProTwapOrderConfirmationSheet.displayName =
  'PerpsProTwapOrderConfirmationSheet';
const getStyle = createGetStyles2024(
  ({ colors2024, safeAreaInsets, isLight }) => ({
    ...getPerpsProDialogStyles(colors2024, safeAreaInsets.bottom, isLight),
    ...getPerpsProDialogCheckboxStyles(colors2024),
    container: { paddingHorizontal: 16, paddingTop: 8 },
    tags: {
      flexDirection: 'row',
      gap: 4,
      justifyContent: 'center',
      flexWrap: 'wrap',
      marginTop: 4,
    },
    tag: {
      backgroundColor: colors2024['neutral-bg-2'],
      color: colors2024['neutral-secondary'],
      fontSize: 12,
      lineHeight: 16,
      paddingHorizontal: 4,
      borderRadius: 4,
    },
    details: {
      marginTop: 24,
      backgroundColor: resolvePerpsProDialogCardBackground(colors2024, isLight),
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    row: getPerpsProListRowStyles(colors2024).listRow,
    label: getPerpsProListRowStyles(colors2024).listLabel,
    value: {
      ...PERPS_PRO_NUMBER_STYLE,
      ...getPerpsProListRowStyles(colors2024).listValue,
      flexShrink: 1,
      marginLeft: 12,
      textAlign: 'right',
    },
    footer: getPerpsProConfirmationFooterStyle(safeAreaInsets.bottom),
  }),
);
