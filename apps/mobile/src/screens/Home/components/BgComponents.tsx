import { Animated, Dimensions, ImageBackground, View } from 'react-native';
import { useBgSize } from '../hooks/useBgSize';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import {
  useHomeFoldChart,
  useHomeReachTop,
  useSingleHomeIsDecrease,
} from '../hooks/singleHome';

const ScreenWidth = Dimensions.get('window').width;

export const TopBg = ({
  fadeAnim,
  isDecrease,
}: {
  fadeAnim: Animated.Value;
  isDecrease?: boolean;
}) => {
  const { layouts, bgFullHeight } = useBgSize();
  const { styles } = useTheme2024({ getStyle: getStyles });
  return (
    <Animated.View
      style={[
        styles.topWrapper,
        {
          height: layouts.fold.top.height,
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
        // imageStyle={{ resizeMode: 'stretch' }}
        style={[
          styles.topBg,
          {
            height: bgFullHeight,
          },
        ]}
      />
    </Animated.View>
  );
};

export const CenterBg = () => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const { layouts, bgFullHeight } = useBgSize();
  const { isFoldChart: fold } = useHomeFoldChart();
  const { isDecrease } = useSingleHomeIsDecrease();

  return (
    <View
      style={[
        styles.centerWrapper,
        {
          height: fold
            ? layouts.fold.center.height
            : layouts.unfold.center.height,
        },
      ]}>
      <ImageBackground
        source={
          !isDecrease
            ? require('@/assets2024/singleHome/up.png')
            : require('@/assets2024/singleHome/loss.png')
        }
        // imageStyle={{ resizeMode: 'stretch' }}
        resizeMode="cover"
        style={[
          styles.centerBg,
          {
            top: layouts.fold.center.top,
            height: bgFullHeight,
          },
        ]}
      />
    </View>
  );
};

export const EndBg = () => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const { layouts, bgFullHeight } = useBgSize();
  const { isFoldChart } = useHomeFoldChart();

  const { reachTop } = useHomeReachTop();
  const { isDecrease } = useSingleHomeIsDecrease();

  if (!reachTop) return null;

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
          top: isFoldChart ? layouts.fold.end.top : layouts.unfold.end.top,
          height: bgFullHeight,
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
