import React from 'react';
import { View, Animated } from 'react-native';
import HomeHeaderArea from './HeaderArea';
import { SingleHomeRightArea } from './SingleHomeRightArea';
import { AssetContainer } from './AssetContainer';
import { createGetStyles2024, makeDebugBorder } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { BottomBtns } from './components/BottomBtns';
import { TopBg } from './components/BgComponents';
import { useBgSize } from './hooks/useBgSize';
import { useRendererDetect } from '@/components/Perf/PerfDetector';
import {
  apisSingleHome,
  useSingleHomeAccount,
  useSingleHomeIsDecrease,
} from './hooks/singleHome';
import { useUnmount } from 'ahooks';
import { HomeTopArea } from './components/HomeTopArea';
import { HeaderBackPressable } from '@/hooks/navigation';

function HomeHeader() {
  const { styles } = useTheme2024({ getStyle: getHomeHeaderStyle });

  return (
    <View style={styles.container}>
      <View style={styles.containerLeft}>
        <HeaderBackPressable style={{ marginRight: 8 }} />
        <HomeHeaderArea />
      </View>
      <View style={styles.containerRight}>
        <SingleHomeRightArea />
      </View>
    </View>
  );
}

const getHomeHeaderStyle = createGetStyles2024(
  ({ colors2024, safeAreaInsets }) => {
    return {
      container: {
        marginTop: safeAreaInsets.top,
        height: 52,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        backgroundColor: 'transparent',
        width: '100%',
        zIndex: 10,
      },

      containerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-start',
        // ...makeDebugBorder(),
        width: '100%',
        flexShrink: 1,
      },

      containerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        flexShrink: 0,
        // ...makeDebugBorder('green'),
      },
    };
  },
);

function SingleAddressHome(): JSX.Element {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const fadeAnim = React.useRef(new Animated.Value(1)).current;
  const { safeTop, topHeight } = useBgSize();
  const { currentAccount } = useSingleHomeAccount();

  const { isDecrease } = useSingleHomeIsDecrease();

  const handleReachTopStatusChange = React.useCallback(
    (status: boolean) => {
      apisSingleHome.setReachTop(!status);
      Animated.timing(fadeAnim, {
        toValue: status ? 1 : 0,
        duration: 100,
        useNativeDriver: true,
      }).start();
    },
    [fadeAnim],
  );

  useRendererDetect({ name: 'SingleAddressHome' });

  const handleTouchEnd = () => {
    apisSingleHome.setFoldChart(true);
  };

  useUnmount(() => {
    apisSingleHome.clearCurrentAccount();
  });

  return (
    <NormalScreenContainer2024
      type="bg1"
      overwriteStyle={[
        styles.rootScreenContainer,
        {
          // 设计要求，TODO: check一些安卓机型
          paddingTop: topHeight,
        },
      ]}>
      <TopBg fadeAnim={fadeAnim} isDecrease={isDecrease} />

      <View style={styles.safeView} onTouchStart={handleTouchEnd}>
        <HomeTopArea />
        <AssetContainer onReachTopStatusChange={handleReachTopStatusChange} />
      </View>
      <View style={styles.bottomContainer} onTouchStart={handleTouchEnd}>
        <BottomBtns currentAccount={currentAccount} />
      </View>
    </NormalScreenContainer2024>
  );
}

SingleAddressHome.Header = HomeHeader;

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  rootScreenContainer: {
    // paddingHorizontal: 16,
    backgroundColor: colors2024['neutral-bg-gray'],
  },
  bottomContainer: {
    width: '100%',
    height: 116,
    backgroundColor: colors2024['neutral-bg-1'],
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  safeView: {
    flex: 1,
    width: '100%',
    overflow: 'hidden',
  },
}));

export default SingleAddressHome;
