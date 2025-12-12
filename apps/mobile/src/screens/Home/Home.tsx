import React, { useState } from 'react';
import { View, Animated } from 'react-native';
import HeaderArea from './HeaderArea';
import { AssetContainer } from './AssetContainer';
import { useTriggerHomeBalanceUpdate } from '@/hooks/useCurrentBalance';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { useRoute } from '@react-navigation/native';
import { GetNestedScreenRouteProp } from '@/navigation-type';
import { RightArea } from './SingleHomeRightArea';
import { BottomBtns } from './components/BottomBtns';
import { TopBg } from './components/BgComponents';
import { useBgSize } from './hooks/useBgSize';
import { useRendererDetect } from '@/components/Perf/PerfDetector';
import { useSingleHomeIsDecrease } from '@/hooks/useCurve';
import { apisSingleHome } from './hooks/singleHome';

function SingleAddressHome(): JSX.Element {
  const { setNavigationOptions } = useSafeSetNavigationOptions();
  const { styles } = useTheme2024({ getStyle: getStyles });
  const fadeAnim = React.useRef(new Animated.Value(1)).current;
  const { topHeight } = useBgSize();
  const route =
    useRoute<
      GetNestedScreenRouteProp<
        'SingleAddressNavigatorParamList',
        'SingleAddressHome'
      >
    >();
  const currentAccount = route?.params?.account;
  const { triggerUpdate } = useTriggerHomeBalanceUpdate();

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

  React.useEffect(() => {
    setNavigationOptions({
      headerTitle: () => <SingleAddressHome.HeaderArea />,
      headerRight: () => <SingleAddressHome.RightArea />,
    });
  }, [setNavigationOptions]);
  const handleTouchEnd = () => {
    apisSingleHome.setFoldChart(true);
  };

  return (
    <NormalScreenContainer2024
      type="bg1"
      overwriteStyle={[
        styles.rootScreenContainer,
        {
          // 设计要求，TODO： check一些安卓机型
          paddingTop: topHeight,
        },
      ]}>
      <TopBg fadeAnim={fadeAnim} isDecrease={isDecrease} />
      <View style={styles.safeView} onTouchStart={handleTouchEnd}>
        <AssetContainer
          onRefresh={triggerUpdate}
          onReachTopStatusChange={handleReachTopStatusChange}
        />
      </View>
      <View style={styles.bottomContainer} onTouchStart={handleTouchEnd}>
        <BottomBtns currentAccount={currentAccount} />
      </View>
    </NormalScreenContainer2024>
  );
}

SingleAddressHome.RightArea = RightArea;
SingleAddressHome.HeaderArea = HeaderArea;

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
