import { AppBottomSheetModal } from '@/components';
import { Text } from '@/components/Typography';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { apisPerps } from '@/core/apis/perps';
import { perpsStore } from '@/hooks/perps/usePerpsStore';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import type { FundingHistoryItem } from '@rabby-wallet/hyperliquid-sdk';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';

import {
  annualizePerpsFundingRate,
  getEstimatedPerpsServerTime,
  getPerpsEstimatedFundingState,
  getPerpsFundingDirection,
  PERPS_PRO_FUNDING_SCHEDULE,
  selectPerpsSignedPositionSize,
  selectPreviousPerpsFunding,
  type PerpsServerClockSample,
} from '../../model/funding';
import type { PerpsProMarket } from '../../model/market';
import {
  formatPerpsProFundingRate,
  formatPerpsProSignedUsd,
} from '../../utils/format';
import { getPerpsProBottomSheetChromeStyles } from '../common/perpsProVisual';
import { usePerpsProSheetNavigationRegistration } from '../common/perpsProSheetNavigationRegistry';

type FundingHistoryState = {
  error: Error | null;
  items: FundingHistoryItem[];
  status: 'loading' | 'ready' | 'error';
};

export const PERPS_PRO_FUNDING_SHEET_HEIGHT = 380;
export const PERPS_PRO_FUNDING_ERROR_SHEET_HEIGHT = 408;
export const PERPS_PRO_FUNDING_SHEET_MIN_BOTTOM_PADDING = 24;

export const getPerpsProFundingDetailSheetLayout = ({
  bottomInset,
  hasHistoryError,
}: {
  bottomInset: number;
  hasHistoryError: boolean;
}) => {
  const normalizedBottomInset =
    Number.isFinite(bottomInset) && bottomInset > 0 ? bottomInset : 0;
  const bottomPadding = Math.max(
    PERPS_PRO_FUNDING_SHEET_MIN_BOTTOM_PADDING,
    normalizedBottomInset,
  );
  const baseHeight = hasHistoryError
    ? PERPS_PRO_FUNDING_ERROR_SHEET_HEIGHT
    : PERPS_PRO_FUNDING_SHEET_HEIGHT;

  return {
    bottomPadding,
    snapPoint:
      baseHeight + bottomPadding - PERPS_PRO_FUNDING_SHEET_MIN_BOTTOM_PADDING,
  };
};

const FundingValueRow: React.FC<{
  label: string;
  value: string;
  valueStyle?: object;
}> = ({ label, value, valueStyle }) => {
  const { styles } = useTheme2024({ getStyle });
  return (
    <View style={styles.valueRow}>
      <Text style={styles.valueLabel}>{label}</Text>
      <Text style={[styles.value, valueStyle]}>{value}</Text>
    </View>
  );
};

export const PerpsProFundingDetailSheet: React.FC<{
  market: PerpsProMarket;
  onClose: () => void;
  serverClock: PerpsServerClockSample | null;
}> = ({ market, onClose, serverClock }) => {
  const { colors2024, styles } = useTheme2024({ getStyle });
  const { bottom: bottomInset } = useSafeAreaInsets();
  const { t } = useTranslation();
  const modalRef = useRef<AppBottomSheetModal>(null);
  usePerpsProSheetNavigationRegistration({ active: true, dismiss: onClose });
  const historyEndTimeRef = useRef(
    getEstimatedPerpsServerTime(serverClock, Date.now()) ?? Date.now(),
  );
  const [historyState, setHistoryState] = useState<FundingHistoryState>({
    error: null,
    items: [],
    status: 'loading',
  });
  const { accountReady, signedPositionSize } = perpsStore(
    useShallow(state => ({
      accountReady: state.isUserDataReady,
      signedPositionSize: selectPerpsSignedPositionSize(
        state.currentClearinghouseState?.assetPositions,
        market.canonicalCoin,
      ),
    })),
  );

  useEffect(() => {
    modalRef.current?.present();
  }, []);

  useEffect(() => {
    let active = true;
    const sdk = apisPerps.getPerpsSDK();
    const endTime = historyEndTimeRef.current;
    const startTime = endTime - PERPS_PRO_FUNDING_SCHEDULE.historyLookbackMs;
    setHistoryState({ error: null, items: [], status: 'loading' });
    sdk.info
      .getFundingHistory(market.canonicalCoin, startTime, endTime)
      .then(items => {
        if (active) {
          setHistoryState({ error: null, items, status: 'ready' });
        }
      })
      .catch(error => {
        if (active) {
          setHistoryState({
            error:
              error instanceof Error
                ? error
                : new Error('Failed to load funding history'),
            items: [],
            status: 'error',
          });
        }
      });
    return () => {
      active = false;
    };
  }, [market.canonicalCoin]);

  const serverNow =
    getEstimatedPerpsServerTime(serverClock, Date.now()) ?? Date.now();
  const previousFunding = useMemo(
    () => selectPreviousPerpsFunding(historyState.items, serverNow),
    [historyState.items, serverNow],
  );
  const currentRate = market.marketData.funding;
  const currentAnnualized = annualizePerpsFundingRate(currentRate);
  const previousAnnualized = annualizePerpsFundingRate(
    previousFunding?.fundingRate,
  );
  const estimatedFundingState = getPerpsEstimatedFundingState({
    accountReady,
    fundingRate: currentRate,
    oraclePrice: market.marketData.oraclePx,
    signedPositionSize,
  });
  const estimatedFunding =
    estimatedFundingState.status === 'ready'
      ? estimatedFundingState.value
      : null;
  const direction = getPerpsFundingDirection(currentRate);
  const directionText =
    direction === 'long-pays-short'
      ? t('page.perps.pro.funding.longPaysShort')
      : direction === 'short-pays-long'
      ? t('page.perps.pro.funding.shortPaysLong')
      : t('page.perps.pro.funding.noPayment');
  const estimatedStyle =
    estimatedFunding == null
      ? styles.valueMuted
      : estimatedFunding >= 0
      ? styles.positive
      : styles.negative;
  const sheetLayout = getPerpsProFundingDetailSheetLayout({
    bottomInset,
    hasHistoryError: Boolean(historyState.error),
  });

  return (
    <AppBottomSheetModal
      enableDynamicSizing={false}
      onDismiss={onClose}
      ref={modalRef}
      snapPoints={[sheetLayout.snapPoint]}
      {...makeBottomSheetProps({
        colors: colors2024,
        linearGradientType: 'bg1',
      })}
      backgroundStyle={styles.background}
      handleIndicatorStyle={styles.handleIndicator}
      handleStyle={styles.handle}
      style={styles.modal}>
      <BottomSheetView
        style={[styles.sheet, { paddingBottom: sheetLayout.bottomPadding }]}>
        <Text style={styles.title}>{t('page.perps.pro.funding.title')}</Text>
        <View style={styles.values} testID="perps-pro-funding-values">
          <FundingValueRow
            label={t('page.perps.pro.funding.interval')}
            value={PERPS_PRO_FUNDING_SCHEDULE.intervalLabel}
            valueStyle={styles.intervalValue}
          />
          <FundingValueRow
            label={t('page.perps.pro.funding.previousRate')}
            value={
              historyState.status === 'loading'
                ? t('page.perps.pro.common.loading')
                : `${formatPerpsProFundingRate(
                    previousFunding?.fundingRate,
                  )} / ${formatPerpsProFundingRate(previousAnnualized, 2)}`
            }
          />
          <FundingValueRow
            label={t('page.perps.pro.funding.nextRate')}
            value={`${formatPerpsProFundingRate(
              currentRate,
            )} / ${formatPerpsProFundingRate(currentAnnualized, 2)}`}
          />
          <FundingValueRow
            label={t('page.perps.pro.funding.estimatedFee')}
            value={
              estimatedFundingState.status === 'ready'
                ? formatPerpsProSignedUsd(estimatedFundingState.value)
                : '--'
            }
            valueStyle={estimatedStyle}
          />
          <View style={styles.valueRow}>
            <Text style={styles.valueLabel}>
              {t('page.perps.pro.funding.direction')}
            </Text>
            <Text
              accessibilityLabel={directionText}
              style={[
                styles.value,
                direction === 'none' ? styles.valueMuted : styles.direction,
              ]}>
              {direction === 'long-pays-short' ? (
                <>
                  <Text style={styles.positive}>
                    {t('page.perps.pro.funding.long')}
                  </Text>{' '}
                  {t('page.perps.pro.funding.pays')}{' '}
                  <Text style={styles.negative}>
                    {t('page.perps.pro.funding.short')}
                  </Text>
                </>
              ) : direction === 'short-pays-long' ? (
                <>
                  <Text style={styles.negative}>
                    {t('page.perps.pro.funding.short')}
                  </Text>{' '}
                  {t('page.perps.pro.funding.pays')}{' '}
                  <Text style={styles.positive}>
                    {t('page.perps.pro.funding.long')}
                  </Text>
                </>
              ) : (
                directionText
              )}
            </Text>
          </View>
        </View>
        {historyState.error ? (
          <Text style={styles.error}>
            {t('page.perps.pro.funding.historyUnavailable')}
          </Text>
        ) : null}
        <Text style={styles.explanation}>
          {t('page.perps.pro.funding.explanation')}
        </Text>
      </BottomSheetView>
    </AppBottomSheetModal>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  ...getPerpsProBottomSheetChromeStyles(colors2024, {
    backgroundColor: colors2024['neutral-bg-1'],
  }),
  sheet: {
    flex: 1,
    paddingHorizontal: 15,
    paddingTop: 8,
  },
  title: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
  },
  values: {
    borderBottomColor: colors2024['neutral-bg-5'],
    borderBottomWidth: 1,
    gap: 8,
    marginTop: 16,
    paddingBottom: 12,
  },
  valueRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  valueLabel: {
    color: colors2024['neutral-secondary'],
    flex: 1,
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
  },
  value: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    marginLeft: 16,
    textAlign: 'right',
  },
  intervalValue: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '500',
  },
  valueMuted: {
    color: colors2024['neutral-secondary'],
  },
  positive: {
    color: colors2024['green-default'],
  },
  negative: {
    color: colors2024['red-default'],
  },
  direction: {
    color: colors2024['neutral-title-1'],
  },
  error: {
    color: colors2024['red-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 16,
    marginTop: 12,
  },
  explanation: {
    color: colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 16,
    marginTop: 19,
  },
}));
