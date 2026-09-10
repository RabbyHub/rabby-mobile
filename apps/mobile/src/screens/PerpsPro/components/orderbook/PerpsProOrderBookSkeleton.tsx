import React from 'react';
import { View } from 'react-native';

import type { PerpsOrderBookMode } from '../../model/orderBook';
import { PerpsProSkeletonBlock } from '../loading/PerpsProSkeletonBlock';
import { PERPS_PRO_ORDER_BOOK_ROW_HEIGHT } from './PerpsProOrderBookPrimitives';

const SkeletonRow: React.FC<{ index: number; side: 'ask' | 'bid' }> = ({
  index,
  side,
}) => (
  <View style={styles.row}>
    <PerpsProSkeletonBlock
      height={12}
      style={styles.value}
      width={index % 3 === 0 ? 52 : 46}
    />
    <PerpsProSkeletonBlock
      height={12}
      style={styles.value}
      width={(index + (side === 'ask' ? 0 : 1)) % 2 === 0 ? 32 : 38}
    />
  </View>
);

type PerpsProOrderBookSkeletonProps = {
  mode: PerpsOrderBookMode;
  rowCount: number;
};

export const PerpsProOrderBookBodySkeleton: React.FC<PerpsProOrderBookSkeletonProps> =
  React.memo(({ mode, rowCount }) => {
    const renderRows = (side: 'ask' | 'bid') =>
      Array.from({ length: rowCount }, (_, index) => (
        <SkeletonRow key={`${side}:${index}`} index={index} side={side} />
      ));

    return (
      <View
        accessibilityRole="progressbar"
        accessibilityState={{ busy: true }}
        style={styles.body}
        testID="perps-pro-order-book-skeleton">
        {mode !== 'bids' ? renderRows('ask') : null}
        {mode === 'both' ? (
          <View style={styles.middle}>
            <PerpsProSkeletonBlock
              height={18}
              style={styles.value}
              width={72}
            />
            <PerpsProSkeletonBlock
              height={12}
              style={styles.value}
              width={42}
            />
          </View>
        ) : null}
        {mode !== 'asks' ? renderRows('bid') : null}
      </View>
    );
  });

PerpsProOrderBookBodySkeleton.displayName = 'PerpsProOrderBookBodySkeleton';

export const PerpsProOrderBookRatioSkeleton: React.FC = React.memo(() => (
  <View style={styles.ratio}>
    <View style={[styles.ratioLabelLane, styles.buyRatioLabelLane]}>
      <PerpsProSkeletonBlock height={8} style={styles.value} width={24} />
    </View>
    <View style={styles.ratioBarSlot}>
      <PerpsProSkeletonBlock height={4} style={styles.ratioBar} width="100%" />
    </View>
    <View style={[styles.ratioLabelLane, styles.sellRatioLabelLane]}>
      <PerpsProSkeletonBlock height={8} style={styles.value} width={24} />
    </View>
  </View>
));

PerpsProOrderBookRatioSkeleton.displayName = 'PerpsProOrderBookRatioSkeleton';

export const PerpsProOrderBookSkeleton: React.FC<PerpsProOrderBookSkeletonProps> =
  React.memo(props => (
    <View style={styles.container}>
      <PerpsProOrderBookBodySkeleton {...props} />
      <PerpsProOrderBookRatioSkeleton />
    </View>
  ));

PerpsProOrderBookSkeleton.displayName = 'PerpsProOrderBookSkeleton';

const styles = {
  container: {
    gap: 8,
  },
  body: {
    height: 314,
  },
  middle: {
    alignItems: 'center' as const,
    gap: 4,
    height: 58,
    justifyContent: 'center' as const,
    marginVertical: 8,
  },
  ratio: {
    alignItems: 'center' as const,
    flexDirection: 'row' as const,
    gap: 2,
    height: 12,
    width: '100%' as const,
  },
  ratioLabelLane: {
    flexShrink: 0,
    width: 42,
  },
  buyRatioLabelLane: {
    alignItems: 'flex-end' as const,
  },
  sellRatioLabelLane: {
    alignItems: 'flex-start' as const,
  },
  ratioBarSlot: {
    flex: 1,
  },
  ratioBar: {
    borderRadius: 2,
  },
  row: {
    alignItems: 'center' as const,
    flexDirection: 'row' as const,
    height: PERPS_PRO_ORDER_BOOK_ROW_HEIGHT,
    justifyContent: 'space-between' as const,
    padding: 2,
  },
  value: {
    borderRadius: 4,
  },
};
