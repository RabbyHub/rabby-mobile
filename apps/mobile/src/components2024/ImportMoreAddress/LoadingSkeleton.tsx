import React from 'react';
import { View, ScrollView } from 'react-native';
import { Skeleton } from '@rneui/themed';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { LoadingLinear } from '@/screens/TokenDetail/components/TokenPriceChart/LoadingLinear';

const SKELETON_COUNT = 6;

export const LoadingSkeleton = () => {
  const { styles, colors2024 } = useTheme2024({ getStyle });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
        <View key={i} style={styles.card}>
          <Skeleton
            animation="wave"
            LinearGradientComponent={LoadingLinear}
            boneColor={colors2024['neutral-bg-2']}
            width={168}
            height={34}
            style={styles.skeletonBar}
          />
        </View>
      ))}
    </ScrollView>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    flex: 1,
  },
  content: {
    gap: 12,
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: colors2024['neutral-bg-1'],
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  skeletonBar: {
    borderRadius: 100,
  },
}));
