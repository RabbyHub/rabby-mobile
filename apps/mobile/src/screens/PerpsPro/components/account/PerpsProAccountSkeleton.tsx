import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { View } from 'react-native';

import { PerpsProSkeletonBlock } from '../loading/PerpsProSkeletonBlock';

export const PerpsProAccountSkeleton: React.FC = React.memo(() => {
  const { styles } = useTheme2024({ getStyle });

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityState={{ busy: true }}
      style={styles.container}
      testID="perps-pro-account-skeleton">
      <View style={styles.card}>
        <View style={styles.summary}>
          <View style={styles.summaryColumn}>
            <PerpsProSkeletonBlock
              height={12}
              style={styles.rounded}
              width={112}
            />
            <PerpsProSkeletonBlock
              height={24}
              style={styles.rounded}
              width={132}
            />
          </View>
          <View style={styles.summaryColumnRight}>
            <PerpsProSkeletonBlock
              height={12}
              style={styles.rounded}
              width={88}
            />
            <PerpsProSkeletonBlock
              height={20}
              style={styles.rounded}
              width={96}
            />
          </View>
        </View>
        <View style={styles.metrics}>
          {[0, 1, 2].map(item => (
            <View key={item} style={styles.metric}>
              <PerpsProSkeletonBlock
                height={10}
                style={styles.rounded}
                width={72}
              />
              <PerpsProSkeletonBlock
                height={16}
                style={styles.rounded}
                width={84}
              />
            </View>
          ))}
        </View>
        <View style={styles.actions}>
          <PerpsProSkeletonBlock
            height={36}
            style={styles.action}
            width="48%"
          />
          <PerpsProSkeletonBlock
            height={36}
            style={styles.action}
            width="48%"
          />
        </View>
      </View>
    </View>
  );
});

PerpsProAccountSkeleton.displayName = 'PerpsProAccountSkeleton';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    backgroundColor: colors2024['neutral-bg-1'],
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  card: {
    backgroundColor: colors2024['neutral-bg-2'],
    borderColor: colors2024['neutral-line'],
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  summary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryColumn: {
    gap: 8,
  },
  summaryColumnRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  metrics: {
    borderTopColor: colors2024['neutral-bg-5'],
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
    paddingTop: 12,
  },
  metric: {
    flex: 1,
    gap: 6,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  action: {
    borderRadius: 8,
  },
  rounded: {
    borderRadius: 5,
  },
}));
