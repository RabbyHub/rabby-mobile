import React, { useMemo } from 'react';
import { ActivityIndicator, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { buildSparklinePath } from '@/hooks/perps/spot/spotSparklinePath';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';

const HEIGHT = 120;

/** Closing-price curve of the selected range; colored by its direction. */
export const SpotSparkline: React.FC<{
  closes: ReadonlyArray<number>;
  isLoading: boolean;
  width: number;
}> = React.memo(({ closes, isLoading, width }) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const isUp = closes.length > 1 && closes[closes.length - 1] >= closes[0];
  const color = isUp ? colors2024['green-default'] : colors2024['red-default'];
  const fill = isUp ? colors2024['green-light-1'] : colors2024['red-light-1'];
  const paths = useMemo(
    () => buildSparklinePath(closes, width, HEIGHT),
    [closes, width],
  );

  return (
    <View style={styles.container}>
      {paths.line ? (
        <Svg width={width} height={HEIGHT}>
          <Path d={paths.area} fill={fill} />
          <Path
            d={paths.line}
            stroke={color}
            strokeWidth={2}
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
      ) : isLoading ? (
        <ActivityIndicator color={colors2024['neutral-foot']} />
      ) : (
        <View style={styles.emptyLine} />
      )}
    </View>
  );
});

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    height: HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyLine: {
    alignSelf: 'stretch',
    height: 1,
    backgroundColor: colors2024['neutral-line'],
  },
}));
