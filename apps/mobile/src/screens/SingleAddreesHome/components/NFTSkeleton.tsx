import { Skeleton } from '@rneui/themed';
import { memo } from 'react';
import { View } from 'react-native';

export const NFTListLoader = memo(
  ({ detailWidth }: { detailWidth: number }) => (
    <View
      // eslint-disable-next-line react-native/no-inline-styles
      style={{
        paddingHorizontal: 20,
        height: (40 + detailWidth) * 5 + 50,
      }}>
      {Array(5)
        .fill(0)
        .map((e, i) => (
          <View key={i}>
            <Skeleton height={20} style={{ marginTop: 10 }} />
            <View
              // eslint-disable-next-line react-native/no-inline-styles
              style={{
                flexDirection: 'row',
                marginTop: 10,
                gap: 10,
              }}>
              <Skeleton width={detailWidth} height={detailWidth} />
              <Skeleton width={detailWidth} height={detailWidth} />
              <Skeleton width={detailWidth} height={detailWidth} />
            </View>
          </View>
        ))}
    </View>
  ),
);
