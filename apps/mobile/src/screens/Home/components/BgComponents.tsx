import { createContext, useContext } from 'react';
import type { PropsWithChildren } from 'react';
import { Dimensions, ImageBackground } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { useBgSize } from '../hooks/useBgSize';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { useHomeFoldChart, useSingleHomeIsDecrease } from '../hooks/singleHome';

const ScreenWidth = Dimensions.get('window').width;

const HomeBackgroundOpacityContext = createContext<SharedValue<number> | null>(
  null,
);

export const HomeBackgroundOpacityProvider = ({
  children,
  value,
}: PropsWithChildren<{ value: SharedValue<number> }>) => (
  <HomeBackgroundOpacityContext.Provider value={value}>
    {children}
  </HomeBackgroundOpacityContext.Provider>
);

export const useHomeBackgroundOpacity = () => {
  const opacity = useContext(HomeBackgroundOpacityContext);
  const fallbackOpacity = useSharedValue(1);
  return opacity ?? fallbackOpacity;
};

export const TopBg = ({ isDecrease }: { isDecrease?: boolean }) => {
  const { layouts, bgFullHeight } = useBgSize();
  const { styles } = useTheme2024({ getStyle: getStyles });
  const opacity = useHomeBackgroundOpacity();
  const opacityStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.topWrapper,
        {
          height: layouts.fold.top.height,
        },
        opacityStyle,
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
  const opacity = useHomeBackgroundOpacity();
  const opacityStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.centerWrapper,
        {
          height: fold
            ? layouts.fold.center.height
            : layouts.unfold.center.height,
        },
        opacityStyle,
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
    </Animated.View>
  );
};

export const EndBg = () => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const { layouts, bgFullHeight } = useBgSize();
  const { isFoldChart } = useHomeFoldChart();
  const { isDecrease } = useSingleHomeIsDecrease();
  const opacity = useHomeBackgroundOpacity();
  const opacityStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.endBg,
        {
          top: isFoldChart ? layouts.fold.end.top : layouts.unfold.end.top,
          height: bgFullHeight,
        },
        opacityStyle,
      ]}>
      <ImageBackground
        source={
          !isDecrease
            ? require('@/assets2024/singleHome/up.png')
            : require('@/assets2024/singleHome/loss.png')
        }
        resizeMode="cover"
        style={styles.endBgImage}
      />
    </Animated.View>
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
  endBgImage: {
    width: ScreenWidth,
    height: '100%',
  },
}));
