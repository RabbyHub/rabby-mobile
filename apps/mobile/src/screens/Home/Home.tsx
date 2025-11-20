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
import { atom, useSetAtom } from 'jotai';

export const foldChartAtom = atom(true);
function HomeScreen(): JSX.Element {
  const { navigation, setNavigationOptions } = useSafeSetNavigationOptions();
  const { styles } = useTheme2024({ getStyle: getStyles });
  const [isDecrease, setIsDecrease] = React.useState<boolean>(false);
  const [reachTop, setReachTop] = useState(false);
  const setFoldChart = useSetAtom(foldChartAtom);
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

  const handleUpdateIsDecrease = React.useCallback((status: boolean) => {
    setIsDecrease(status);
  }, []);

  const handleReachTopStatusChange = React.useCallback(
    (status: boolean) => {
      setReachTop(!status);
      Animated.timing(fadeAnim, {
        toValue: status ? 1 : 0,
        duration: 100,
        useNativeDriver: true,
      }).start();
    },
    [fadeAnim],
  );
  const renderHeaderTitle = React.useCallback(() => {
    return <HomeScreen.HeaderArea account={currentAccount} />;
  }, [currentAccount]);

  const renderHeaderRight = React.useCallback(() => {
    return <RightArea account={currentAccount} />;
  }, [currentAccount]);

  React.useEffect(() => {
    setNavigationOptions({
      // header: props => <HomeNativeStackHeader {...props} />,
      headerTitle: renderHeaderTitle,
      headerRight: renderHeaderRight,
    });
  }, [
    currentAccount.address,
    navigation,
    renderHeaderRight,
    renderHeaderTitle,
    setNavigationOptions,
  ]);
  const handleTouchEnd = () => {
    setFoldChart(true);
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
          onUpdateIsDecrease={handleUpdateIsDecrease}
          onReachTopStatusChange={handleReachTopStatusChange}
          account={currentAccount}
          reachTop={reachTop}
        />
      </View>
      <View style={styles.bottomContainer} onTouchStart={handleTouchEnd}>
        <BottomBtns currentAccount={currentAccount} />
      </View>
    </NormalScreenContainer2024>
  );
}

HomeScreen.HeaderArea = HeaderArea;

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

export default HomeScreen;
