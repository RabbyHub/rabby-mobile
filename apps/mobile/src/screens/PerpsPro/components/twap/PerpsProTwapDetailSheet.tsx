import RcBack from '@/assets2024/icons/perps/PerpsHeaderBack.svg';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import BigNumber from 'bignumber.js';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import AutoLockView from '@/components/AutoLockView';
import { Text } from '@/components/Typography';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { getBottomButtonBottomOffset } from '@/constant/layout';
import type { PerpsTwapFill, PerpsTwapRecord } from '@/hooks/perps/twap/types';
import {
  addPerpsTwapFills,
  usePerpsTwapFills,
  usePerpsTwapRecord,
} from '@/hooks/perps/twap/usePerpsTwapStore';
import { loadPerpsTwapFills } from '@/hooks/perps/twap/twapRepository';
import { usePerpsProTradeAmountUnit } from '../../scene/usePerpsProTradePreferences';
import { formatPerpsProDecimal } from '../../utils/format';
import { getPerpsProDialogStyles } from '../common/perpsProDialogVisual';
import { PerpsProDialogBackdrop } from '../common/PerpsProDialogBackdrop';
import { usePerpsProSheetNavigationRegistration } from '../common/perpsProSheetNavigationRegistry';
import {
  PerpsProTwapCard,
  PerpsProTwapValue,
  usePerpsProTwapMarket,
} from './PerpsProTwapCard';

export const PerpsProTwapDetailSheet = React.memo(
  ({
    order: initial,
    onClose,
    history = false,
  }: {
    order: PerpsTwapRecord;
    onClose: () => void;
    history?: boolean;
  }) => {
    const { t } = useTranslation();
    const { colors2024, styles } = useTheme2024({ getStyle });
    const { height } = useWindowDimensions();
    const modal = useRef<AppBottomSheetModal>(null);
    const current = usePerpsTwapRecord(initial.state.user, initial.key);
    const order = current ?? initial;
    const fills = usePerpsTwapFills(initial.state.user, initial.key);
    const amountUnit = usePerpsProTradeAmountUnit();
    const market = usePerpsProTwapMarket(initial.state.coin, false);
    const now = Date.now();
    const [load, setLoad] = useState<
      'loading' | 'partial' | 'complete' | 'error'
    >('loading');
    const [retry, setRetry] = useState(0);
    const loadOrder = useRef(order);
    loadOrder.current = order;
    usePerpsProSheetNavigationRegistration({ active: true, dismiss: onClose });
    useEffect(() => {
      modal.current?.present();
    }, []);
    useEffect(() => {
      let valid = true;
      setLoad('loading');
      loadPerpsTwapFills(initial.state.user, loadOrder.current, () => valid)
        .then(result => {
          if (!valid) return;
          addPerpsTwapFills(initial.state.user, result.fills);
          setLoad(result.complete ? 'complete' : 'partial');
        })
        .catch(() => {
          if (valid) setLoad('error');
        });
      return () => {
        valid = false;
      };
    }, [initial.key, initial.state.user, order.endedAt, retry]);
    const renderFill = useCallback(
      ({ item }: { item: PerpsTwapFill }) => {
        const base = amountUnit === 'base';
        const size = base
          ? item.sz
          : new BigNumber(item.sz).times(item.px).toFixed();
        return (
          <View style={styles.fill}>
            <View style={styles.fillHeading}>
              <Text
                style={[
                  styles.side,
                  {
                    color:
                      colors2024[
                        item.side === 'B' ? 'green-default' : 'red-default'
                      ],
                    backgroundColor:
                      colors2024[
                        item.side === 'B' ? 'green-light-1' : 'red-light-1'
                      ],
                  },
                ]}>
                {t(
                  `page.perps.pro.trade.${item.side === 'B' ? 'buy' : 'sell'}`,
                )}
              </Text>
              <Text style={styles.fillTime}>
                {dayjs(item.time).format('YYYY/MM/DD HH:mm:ss')}
              </Text>
            </View>
            <View style={styles.fillValues}>
              <View style={styles.third}>
                <PerpsProTwapValue
                  fullWidth
                  label={t('page.perps.pro.twap.averagePrice')}
                  value={formatPerpsProDecimal(
                    item.px,
                    market?.pxDecimals ?? 6,
                  )}
                />
              </View>
              <View style={styles.third}>
                <PerpsProTwapValue
                  fullWidth
                  label={`${t('page.perps.pro.twap.size')} (${
                    base
                      ? market?.displayBase ?? item.coin
                      : market?.quoteAsset ?? '--'
                  })`}
                  value={formatPerpsProDecimal(
                    size,
                    base ? market?.szDecimals ?? 8 : 2,
                  )}
                />
              </View>
              <View style={styles.third}>
                <PerpsProTwapValue
                  fullWidth
                  label={`${t('page.perps.pro.twap.fee')} (${item.feeToken})`}
                  value={formatPerpsProDecimal(item.fee, 6)}
                />
              </View>
            </View>
          </View>
        );
      },
      [
        amountUnit,
        market?.displayBase,
        market?.pxDecimals,
        market?.quoteAsset,
        market?.szDecimals,
        styles,
        colors2024,
        t,
      ],
    );
    const renderSeparator = useCallback(
      () => <View style={styles.separator} />,
      [styles.separator],
    );
    return (
      <AppBottomSheetModal
        ref={modal}
        onDismiss={onClose}
        snapPoints={[Math.min(height * 0.85, 760)]}
        enableDynamicSizing={false}
        {...makeBottomSheetProps({
          colors: colors2024,
          linearGradientType: 'bg0',
        })}
        backdropComponent={PerpsProDialogBackdrop}
        backgroundStyle={styles.background}
        handleIndicatorStyle={styles.handleIndicator}
        handleStyle={styles.handle}
        style={styles.modal}>
        <AutoLockView style={styles.body}>
          <View style={styles.titleRow}>
            {history ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('global.back')}
                onPress={onClose}
                style={styles.back}
                hitSlop={10}>
                <RcBack
                  width={24}
                  height={24}
                  color={colors2024['neutral-title-1']}
                  style={styles.backIcon}
                />
              </Pressable>
            ) : null}
            <Text style={styles.title}>
              {t(
                !history && order.endedAt === null
                  ? 'page.perps.pro.twap.detailTitle'
                  : 'page.perps.pro.twap.historyDetailTitle',
              )}
            </Text>
          </View>
          <View style={styles.summary}>
            <PerpsProTwapCard
              order={order}
              amountUnit={amountUnit}
              now={now}
              variant={history ? 'historyDetail' : 'runningDetail'}
            />
          </View>
          <View style={styles.tradesPanel}>
            <Text style={styles.trades}>
              {t('page.perps.pro.twap.trades')} {fills.length}
            </Text>
            <BottomSheetFlatList
              data={fills}
              keyExtractor={item => item.key}
              renderItem={renderFill}
              ItemSeparatorComponent={renderSeparator}
              initialNumToRender={8}
              showsVerticalScrollIndicator={false}
              windowSize={5}
              contentContainerStyle={styles.list}
              ListFooterComponent={
                load === 'complete' ? null : (
                  <Pressable
                    disabled={load === 'loading'}
                    onPress={() => setRetry(value => value + 1)}
                    style={styles.footer}>
                    <Text style={styles.footerText}>
                      {t(`page.perps.pro.twap.fills.${load}`)}
                    </Text>
                  </Pressable>
                )
              }
              ListEmptyComponent={
                load === 'complete' ? (
                  <Text style={styles.footerText}>
                    {t('page.perps.pro.twap.noTrades')}
                  </Text>
                ) : null
              }
            />
          </View>
        </AutoLockView>
      </AppBottomSheetModal>
    );
  },
);
PerpsProTwapDetailSheet.displayName = 'PerpsProTwapDetailSheet';
const getStyle = createGetStyles2024(
  ({ colors2024, safeAreaInsets, isLight }) => ({
    ...getPerpsProDialogStyles(colors2024, safeAreaInsets.bottom, isLight),
    body: { flex: 1, paddingTop: 8 },
    titleRow: { justifyContent: 'center', minHeight: 24 },
    back: { position: 'absolute', left: 20, zIndex: 1 },
    backIcon: { transform: [{ rotate: '180deg' }] },
    summary: { marginTop: 24 },
    tradesPanel: {
      flex: 1,
      marginHorizontal: 12,
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: colors2024[isLight ? 'neutral-bg-1' : 'neutral-bg-2'],
      marginBottom: getBottomButtonBottomOffset(safeAreaInsets.bottom),
    },
    list: { paddingBottom: 8 },
    trades: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '700',
      color: colors2024['neutral-title-1'],
      marginHorizontal: 12,
      marginTop: 12,
      marginBottom: 12,
    },
    fill: {
      marginHorizontal: 12,
    },
    separator: {
      marginHorizontal: 12,
      marginVertical: 10,
      height: 1,
      backgroundColor: colors2024['neutral-bg-5'],
    },
    fillHeading: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginBottom: 8,
    },
    side: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '500',
      paddingHorizontal: 4,
      paddingVertical: 1,
      borderRadius: 4,
      overflow: 'hidden',
    },
    fillTime: {
      fontFamily: 'SF Pro Rounded',
      fontWeight: '400',
      fontSize: 12,
      lineHeight: 16,
      color: colors2024['neutral-secondary'],
    },
    fillValues: { flexDirection: 'row', gap: 8 },
    third: { flex: 1, minWidth: 0 },
    footer: { padding: 16 },
    footerText: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 13,
      lineHeight: 18,
      color: colors2024['neutral-foot'],
      textAlign: 'center',
    },
  }),
);
