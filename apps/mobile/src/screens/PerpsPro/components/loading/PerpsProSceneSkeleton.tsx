import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useMemo } from 'react';
import { View, type ViewStyle } from 'react-native';

import { PerpsProOrderBookSkeleton } from '../orderbook/PerpsProOrderBookSkeleton';
import { PerpsProSkeletonBlock } from './PerpsProSkeletonBlock';

export const PerpsProMarketBarSkeleton: React.FC = React.memo(() => {
  const { styles } = useTheme2024({ getStyle });

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityState={{ busy: true }}
      style={styles.marketBar}
      testID="perps-pro-market-bar-skeleton">
      <View style={styles.marketSummary}>
        <PerpsProSkeletonBlock height={20} style={styles.rounded} width={82} />
        <PerpsProSkeletonBlock height={14} style={styles.rounded} width={42} />
      </View>
      <View style={styles.marketActions}>
        <PerpsProSkeletonBlock height={20} style={styles.rounded} width={20} />
        <PerpsProSkeletonBlock height={20} style={styles.rounded} width={20} />
      </View>
    </View>
  );
});

PerpsProMarketBarSkeleton.displayName = 'PerpsProMarketBarSkeleton';

export const PerpsProSceneSkeleton: React.FC<{
  gap: number;
  orderBookWidth: number;
  tradeWidth: number;
}> = React.memo(({ gap, orderBookWidth, tradeWidth }) => {
  const { styles } = useTheme2024({ getStyle });
  const columnsStyle = useMemo<ViewStyle>(() => ({ gap }), [gap]);
  const orderBookStyle = useMemo<ViewStyle>(
    () => ({ width: orderBookWidth }),
    [orderBookWidth],
  );
  const tradeStyle = useMemo<ViewStyle>(
    () => ({ width: tradeWidth }),
    [tradeWidth],
  );
  const tradeHalfWidth = Math.max(0, (tradeWidth - 8) / 2);

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityState={{ busy: true }}
      style={[styles.columns, columnsStyle]}
      testID="perps-pro-scene-skeleton">
      <View style={[styles.orderBook, orderBookStyle]}>
        <View style={styles.funding}>
          <PerpsProSkeletonBlock
            height={10}
            style={styles.rounded}
            width={56}
          />
          <PerpsProSkeletonBlock
            height={10}
            style={styles.rounded}
            width={70}
          />
        </View>
        <View style={styles.bookHeader}>
          <PerpsProSkeletonBlock
            height={24}
            style={styles.rounded}
            width={42}
          />
          <PerpsProSkeletonBlock
            height={24}
            style={styles.rounded}
            width={42}
          />
        </View>
        <PerpsProOrderBookSkeleton mode="both" rowCount={6} />
        <View style={styles.bookControls}>
          <PerpsProSkeletonBlock
            height={24}
            style={styles.rounded}
            width={88}
          />
          <PerpsProSkeletonBlock
            height={20}
            style={styles.rounded}
            width={20}
          />
        </View>
      </View>
      <View style={[styles.trade, tradeStyle]}>
        <View style={styles.tradeDoubleRow}>
          <PerpsProSkeletonBlock
            height={26}
            style={styles.rounded}
            width={tradeHalfWidth}
          />
          <PerpsProSkeletonBlock
            height={26}
            style={styles.rounded}
            width={tradeHalfWidth}
          />
        </View>
        <PerpsProSkeletonBlock
          height={26}
          style={styles.rounded}
          width={tradeWidth}
        />
        <PerpsProSkeletonBlock
          height={48}
          style={styles.tradeInput}
          width={tradeWidth}
        />
        <PerpsProSkeletonBlock
          height={24}
          style={styles.rounded}
          width={tradeWidth}
        />
        <PerpsProSkeletonBlock
          height={16}
          style={styles.rounded}
          width={tradeWidth}
        />
        <PerpsProSkeletonBlock height={24} style={styles.rounded} width={82} />
        <PerpsProSkeletonBlock height={24} style={styles.rounded} width={96} />
        <View style={styles.tradeOrders}>
          <PerpsProSkeletonBlock
            height={92}
            style={styles.tradeOrder}
            width={tradeWidth}
          />
          <PerpsProSkeletonBlock
            height={92}
            style={styles.tradeOrder}
            width={tradeWidth}
          />
        </View>
      </View>
    </View>
  );
});

PerpsProSceneSkeleton.displayName = 'PerpsProSceneSkeleton';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  marketBar: {
    alignItems: 'center',
    backgroundColor: colors2024['neutral-bg-1'],
    borderTopColor: colors2024['neutral-line'],
    borderTopWidth: 1,
    flexDirection: 'row',
    height: 40,
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  marketSummary: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  marketActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  columns: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  orderBook: {
    gap: 8,
    height: 440,
  },
  funding: {
    gap: 4,
    height: 26,
    justifyContent: 'space-between',
  },
  bookHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 32,
    justifyContent: 'space-between',
  },
  bookControls: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 24,
    justifyContent: 'space-between',
  },
  trade: {
    gap: 8,
    height: 440,
  },
  tradeDoubleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tradeInput: {
    borderRadius: 8,
  },
  tradeOrders: {
    gap: 12,
    height: 196,
  },
  tradeOrder: {
    borderRadius: 12,
  },
  rounded: {
    borderRadius: 6,
  },
}));
