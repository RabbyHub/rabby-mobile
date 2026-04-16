import { Animated, Dimensions, ImageBackground } from 'react-native';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { useMemo } from 'react';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { ALERT_HEIGHT, HEADER_CHART_HEIGHT } from '@/constant/layout';
import { BG_FULL_HEIGHT } from '@/screens/Home/hooks/useBgSize';

const ScreenWidth = Dimensions.get('window').width;

export const useBgSize = () => {
  const { safeTop } = useSafeSizes();

  const sizes = useMemo(() => {
    const topHeight = Math.max(safeTop, 80);

    const layouts = {
      top: {
        height: topHeight,
        top: 0,
      },
      end: {
        height: HEADER_CHART_HEIGHT + ALERT_HEIGHT,
        top: 0 - topHeight,
      },
    };

    return {
      layouts,
      topHeight,
    };
  }, [safeTop]);
  return sizes;
};

export const TopBg = ({
  fadeAnim,
  isDecrease,
}: {
  fadeAnim: Animated.Value;
  isDecrease: boolean;
}) => {
  const { layouts } = useBgSize();
  const { styles } = useTheme2024({ getStyle: getStyles });
  return (
    <Animated.View
      style={[
        styles.topWrapper,
        {
          height: layouts.top.height,
          opacity: fadeAnim,
        },
      ]}>
      <ImageBackground
        source={
          !isDecrease
            ? require('@/assets2024/singleHome/up.png')
            : require('@/assets2024/singleHome/loss.png')
        }
        resizeMode="cover"
        style={[
          styles.topBg,
          {
            height: BG_FULL_HEIGHT,
          },
        ]}
      />
    </Animated.View>
  );
};

export const EndBg = ({ isDecrease }: { isDecrease: boolean }) => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const { layouts } = useBgSize();
  return (
    <ImageBackground
      source={
        !isDecrease
          ? require('@/assets2024/singleHome/up.png')
          : require('@/assets2024/singleHome/loss.png')
      }
      resizeMode="cover"
      // imageStyle={{ resizeMode: 'stretch' }}
      style={[
        styles.endBg,
        {
          top: layouts.end.top,
          height: BG_FULL_HEIGHT,
        },
      ]}
    />
  );
};

const getStyles = createGetStyles2024(() => ({
  topWrapper: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: ScreenWidth,
    overflow: 'hidden',
    // backgroundColor: 'red',
  },
  topBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: ScreenWidth,
  },
  centerWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: ScreenWidth,
    overflow: 'hidden',
  },
  centerBg: {
    position: 'absolute',
    left: 0,
    width: ScreenWidth,
    zIndex: -100,
  },
  endBg: {
    position: 'absolute',
    left: 0,
    width: ScreenWidth,
    zIndex: -100,
  },
}));
