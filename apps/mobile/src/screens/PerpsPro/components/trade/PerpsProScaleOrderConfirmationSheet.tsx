import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { View, useWindowDimensions } from 'react-native';
import {
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import BigNumber from 'bignumber.js';
import { useTranslation } from 'react-i18next';
import AutoLockView from '@/components/AutoLockView';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { Text } from '@/components/Typography';
import { Button } from '@/components2024/Button';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import {
  BOTTOM_BUTTON_SINGLE_HEIGHT,
  BOTTOM_BUTTON_TOP_OFFSET,
  getBottomButtonBottomOffset,
} from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import type { PerpsProScaleOrderPreview } from '../../actions/scaleOrder';
import { getPerpsProScaleBarWidth } from '../../model/scaleOrder';
import {
  formatPerpsProDecimal,
  formatPerpsProVariableDecimal,
} from '../../utils/format';
import {
  getPerpsProDialogStyles,
  resolvePerpsProDialogCardBackground,
} from '../common/perpsProDialogVisual';
import {
  getPerpsProMetadataTagContainerStyle,
  getPerpsProMetadataTagTextStyle,
} from '../common/perpsProSemanticTagStyles';
import { PerpsProDialogBackdrop } from '../common/PerpsProDialogBackdrop';
import { usePerpsProSheetNavigationRegistration } from '../common/perpsProSheetNavigationRegistry';
import { PERPS_PRO_NUMBER_STYLE } from '../common/perpsProNumberText';

export const PerpsProScaleOrderConfirmationSheet = React.memo(
  ({
    command: review,
    pending,
    onClose,
    onConfirm,
    onDismissed,
  }: {
    command: PerpsProScaleOrderPreview | null;
    pending: boolean;
    onClose: () => void;
    onDismissed: (preview: PerpsProScaleOrderPreview) => void;
    onConfirm: () => void;
  }) => {
    const ref = useRef<AppBottomSheetModal>(null);
    const { t } = useTranslation();
    const { styles, colors2024 } = useTheme2024({ getStyle });
    const { height } = useWindowDimensions();
    const [retained, setRetained] = useState(review);
    const command = retained ?? review;
    const closing = command !== review;
    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <PerpsProDialogBackdrop
          {...props}
          pressBehavior={pending || closing ? 'none' : 'close'}
        />
      ),
      [pending, closing],
    );
    usePerpsProSheetNavigationRegistration({
      active: !!command,
      dismiss: onClose,
      dismissible: !pending && !closing,
    });
    useEffect(() => {
      if (retained && retained !== review) {
        ref.current?.dismiss();
      } else if (review) {
        if (!retained) setRetained(review);
        else ref.current?.present();
      }
    }, [review, retained]);
    const rows = useMemo(() => {
      if (!command) return [];
      const max = BigNumber.max(
        ...command.plan.orders.map(leg => leg.size),
      ).toFixed();
      return command.plan.orders.map(leg => ({
        ...leg,
        priceText: formatPerpsProVariableDecimal(leg.price),
        sizeText: formatPerpsProDecimal(
          leg.size,
          command.reviewFacts.szDecimals,
        ),
        width: getPerpsProScaleBarWidth(
          leg.size,
          max,
          command.plan.distribution,
        ),
      }));
    }, [command]);
    if (!command) return null;
    const facts = command.reviewFacts;
    const buy = command.side === 'buy';
    const details = [
      [
        t('page.perps.pro.trade.direction'),
        t(
          buy
            ? 'page.perps.pro.trade.buyLong'
            : 'page.perps.pro.trade.sellShort',
        ),
      ],
      [
        t('page.perps.pro.scaleOrder.totalSize'),
        `${formatPerpsProDecimal(command.plan.totalSize, facts.szDecimals)} ${
          facts.displayBase
        }`,
      ],
      [
        t('page.perps.pro.trade.cost'),
        command.cost === null
          ? '--'
          : `${formatPerpsProDecimal(command.cost, 2)} ${facts.quoteAsset}`,
      ],
      [
        t('page.perps.pro.scaleOrder.averagePrice'),
        `${formatPerpsProDecimal(
          command.plan.averagePrice,
          facts.pxDecimals,
        )} ${facts.quoteAsset}`,
      ],
    ];
    return (
      <AppBottomSheetModal
        ref={ref}
        onDismiss={() => {
          setRetained(null);
          onDismissed(command);
        }}
        enablePanDownToClose={!pending && !closing}
        enableDynamicSizing={false}
        snapPoints={[
          Math.min(
            height * 0.92,
            40 +
              70 +
              144 +
              12 +
              54 +
              rows.length * 30 +
              32 +
              styles.footer.paddingTop +
              styles.footer.paddingBottom +
              BOTTOM_BUTTON_SINGLE_HEIGHT,
          ),
        ]}
        {...makeBottomSheetProps({
          colors: colors2024,
          linearGradientType: 'bg0',
        })}
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.background}
        handleStyle={styles.handle}
        handleIndicatorStyle={styles.handleIndicator}
        style={styles.modal}>
        <AutoLockView style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>{facts.displayPair}</Text>
            <View style={styles.tags}>
              {facts.sourceTag ? (
                <Text style={styles.tag}>{facts.sourceTag}</Text>
              ) : null}
              {command.cost !== null && (
                <Text style={styles.tag}>
                  {facts.marginMode === 'cross' ? 'Cross' : 'Isolated'}{' '}
                  {facts.leverage}x
                </Text>
              )}
            </View>
          </View>
          <View style={styles.summary}>
            {details.map(([label, value], index) => (
              <View key={label} style={styles.row}>
                <Text style={styles.detailLabel}>{label}</Text>
                <Text
                  style={[
                    styles.value,
                    index === 0 && (buy ? styles.buy : styles.sell),
                  ]}>
                  {value}
                </Text>
              </View>
            ))}
          </View>
          <View style={styles.orders}>
            <View style={styles.row}>
              <Text style={styles.detailLabel}>
                {t('page.perps.pro.trade.price')} ({facts.quoteAsset})
              </Text>
              <Text style={styles.detailLabel}>
                {t('page.perps.pro.trade.amount')} ({facts.displayBase})
              </Text>
            </View>
            {/* The frozen plan is capped at 100 rows. Keep every row mounted
                so a native fling never outruns JS list-window rendering. */}
            <BottomSheetScrollView style={styles.orderList}>
              {rows.map(item => (
                <View key={item.price} style={styles.row}>
                  <View
                    pointerEvents="none"
                    style={[
                      styles.bar,
                      buy ? styles.buyBar : styles.sellBar,
                      { width: `${item.width}%` },
                    ]}
                  />
                  <Text style={styles.price}>{item.priceText}</Text>
                  <Text style={styles.value}>{item.sizeText}</Text>
                </View>
              ))}
            </BottomSheetScrollView>
          </View>
          <View style={styles.footer}>
            <Button
              title={t('global.confirm')}
              type="primary"
              height={BOTTOM_BUTTON_SINGLE_HEIGHT}
              onPress={onConfirm}
              disabled={pending || closing}
              loading={pending}
              buttonStyle={[styles.button, pending && styles.buttonDisabled]}
              titleStyle={styles.buttonTitle}
              disabledTitleStyle={styles.buttonDisabledTitle}
            />
          </View>
        </AutoLockView>
      </AppBottomSheetModal>
    );
  },
);
PerpsProScaleOrderConfirmationSheet.displayName =
  'PerpsProScaleOrderConfirmationSheet';
const getStyle = createGetStyles2024(
  ({ colors2024, isLight, safeAreaInsets }) => ({
    ...getPerpsProDialogStyles(colors2024, safeAreaInsets.bottom, isLight),
    container: { flex: 1 },
    header: { paddingTop: 8, paddingBottom: 16, alignItems: 'center', gap: 4 },
    tags: { flexDirection: 'row', gap: 4 },
    tag: {
      ...getPerpsProMetadataTagContainerStyle(colors2024),
      ...getPerpsProMetadataTagTextStyle(colors2024),
    },
    summary: {
      backgroundColor: resolvePerpsProDialogCardBackground(colors2024, isLight),
      marginHorizontal: 12,
      padding: 12,
      borderRadius: 12,
      borderCurve: 'continuous',
    },
    orders: {
      flex: 1,
      backgroundColor: resolvePerpsProDialogCardBackground(colors2024, isLight),
      marginHorizontal: 12,
      marginTop: 12,
      marginBottom: 32,
      padding: 12,
      borderRadius: 12,
      borderCurve: 'continuous',
      overflow: 'hidden',
    },
    orderList: { flex: 1 },
    row: {
      height: 30,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    detailLabel: {
      fontFamily: 'SF Pro Rounded',
      fontWeight: '500',
      fontSize: 14,
      lineHeight: 18,
      color: colors2024['neutral-secondary'],
    },
    value: {
      ...PERPS_PRO_NUMBER_STYLE,
      fontFamily: 'SF Pro Rounded',
      fontWeight: '700',
      fontSize: 14,
      lineHeight: 18,
      color: colors2024['neutral-title-1'],
    },
    price: {
      ...PERPS_PRO_NUMBER_STYLE,
      fontFamily: 'SF Pro Rounded',
      fontWeight: '500',
      fontSize: 14,
      lineHeight: 18,
      color: colors2024['neutral-title-1'],
    },
    buy: { color: colors2024['green-default'] },
    sell: { color: colors2024['red-default'] },
    bar: { position: 'absolute', right: 0, top: 0, bottom: 0 },
    buyBar: { backgroundColor: 'rgba(88, 198, 105, 0.14)' },
    sellBar: { backgroundColor: 'rgba(255, 115, 107, 0.1)' },
    footer: {
      backgroundColor: colors2024['neutral-bg-1'],
      paddingHorizontal: 20,
      paddingTop: BOTTOM_BUTTON_TOP_OFFSET,
      paddingBottom: getBottomButtonBottomOffset(safeAreaInsets.bottom),
    },
  }),
);
