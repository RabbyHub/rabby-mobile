import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { PerpsProAccountSkeleton } from '../components/account/PerpsProAccountSkeleton';
import { PerpsProKlineSheet } from '../components/chart/PerpsProKlineSheet';
import { PerpsProHeader } from '../components/header/PerpsProHeader';
import { usePerpsProHeaderCollapse } from '../components/header/usePerpsProHeaderCollapse';
import {
  PerpsProMarketBarSkeleton,
  PerpsProSceneSkeleton,
} from '../components/loading/PerpsProSceneSkeleton';
import { PerpsProMarketBar } from '../components/market/PerpsProMarketBar';
import {
  PerpsProMarketSelector,
  type PerpsProMarketSelectorHandle,
} from '../components/market/PerpsProMarketSelector';
import { PerpsProTradeSkeleton } from '../components/trade/PerpsProTradeSkeleton';
import { getPerpsProColumnLayout } from '../model/layout';
import { PerpsProRealtimeOrderBook } from './PerpsProRealtimeOrderBook';
import { usePerpsProScene } from './usePerpsProScene';

export const PerpsProScene: React.FC<{
  isModeSwitching: boolean;
  onSwitchToSimple: () => void;
}> = ({ isModeSwitching, onSwitchToSimple }) => {
  const { width } = useWindowDimensions();
  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const scene = usePerpsProScene();
  const headerCollapse = usePerpsProHeaderCollapse();
  const marketSelectorRef = useRef<PerpsProMarketSelectorHandle>(null);
  const [klineOpen, setKlineOpen] = useState(false);
  const openKline = useCallback(() => setKlineOpen(true), []);
  const closeKline = useCallback(() => setKlineOpen(false), []);
  const openMarketSelector = useCallback(
    () => marketSelectorRef.current?.present(),
    [],
  );
  const { gap, orderBookWidth, tradeWidth } = useMemo(
    () => getPerpsProColumnLayout(width),
    [width],
  );
  const orderBookColumnStyle = useMemo<ViewStyle>(
    () => ({ width: orderBookWidth }),
    [orderBookWidth],
  );
  const tradeColumnStyle = useMemo<ViewStyle>(
    () => ({ width: tradeWidth }),
    [tradeWidth],
  );
  const columnsStyle = useMemo<ViewStyle>(() => ({ gap }), [gap]);
  const isMarketLoading =
    !scene.currentMarket &&
    (scene.marketDataStatus === 'idle' ||
      scene.marketDataStatus === 'loading' ||
      scene.isResolvingMarket);

  return (
    <>
      <View style={styles.container}>
        <Animated.View
          style={[
            styles.headerClip,
            {
              height: headerCollapse.headerHeight,
              opacity: headerCollapse.headerOpacity,
            },
          ]}>
          <PerpsProHeader
            isModeSwitching={isModeSwitching}
            onSwitchToSimple={onSwitchToSimple}
          />
        </Animated.View>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          onScroll={headerCollapse.onScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          stickyHeaderIndices={[0]}
          style={styles.scroll}
          testID="perps-pro-scroll">
          {isMarketLoading ? (
            <PerpsProMarketBarSkeleton />
          ) : (
            <PerpsProMarketBar
              market={scene.currentMarket}
              onOpenKline={openKline}
              onPress={openMarketSelector}
            />
          )}
          {scene.currentMarket ? (
            <View style={[styles.columns, columnsStyle]}>
              <View style={orderBookColumnStyle}>
                <PerpsProRealtimeOrderBook
                  enabled={scene.realtimeEnabled}
                  market={scene.currentMarket}
                  onSelectTickOption={scene.selectTickOption}
                  precision={scene.precision}
                  selectedTickOption={scene.selectedTickOption}
                  tickOptions={scene.tickOptions}
                />
              </View>
              <View style={tradeColumnStyle}>
                <PerpsProTradeSkeleton
                  quoteAsset={scene.currentMarket.quoteAsset}
                />
              </View>
            </View>
          ) : isMarketLoading ? (
            <PerpsProSceneSkeleton
              gap={gap}
              orderBookWidth={orderBookWidth}
              tradeWidth={tradeWidth}
            />
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                {t('page.perps.pro.common.unavailable')}
              </Text>
              {scene.marketDataStatus === 'error' ? (
                <Pressable
                  accessibilityLabel={t('page.perps.pro.common.retry')}
                  accessibilityRole="button"
                  onPress={scene.retryMarketData}
                  style={styles.retryButton}>
                  <Text style={styles.retryText}>
                    {t('page.perps.pro.common.retry')}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          )}
          <PerpsProAccountSkeleton />
        </ScrollView>
      </View>
      <PerpsProMarketSelector
        currentMarketKey={scene.currentMarket?.marketKey ?? null}
        onSelect={scene.selectMarket}
        ref={marketSelectorRef}
      />
      {klineOpen && scene.currentMarket ? (
        <PerpsProKlineSheet
          enabled={scene.klineEnabled}
          market={scene.currentMarket}
          onClose={closeKline}
        />
      ) : null}
    </>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    flex: 1,
  },
  headerClip: {
    overflow: 'hidden',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  columns: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    paddingTop: 8,
  },
  empty: {
    alignItems: 'center',
    gap: 12,
    height: 516,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  emptyText: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  retryButton: {
    alignItems: 'center',
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 8,
    height: 36,
    justifyContent: 'center',
    minWidth: 88,
    paddingHorizontal: 16,
  },
  retryText: {
    color: colors2024['blue-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
}));
