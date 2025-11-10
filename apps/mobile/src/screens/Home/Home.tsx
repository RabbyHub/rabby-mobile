/* eslint-disable react-native/no-inline-styles */
import React from 'react';
import { ImageBackground, View, Animated } from 'react-native';
import HeaderArea from './HeaderArea';
import { AssetContainer } from './AssetContainer';
import { useTriggerHomeBalanceUpdate } from '@/hooks/useCurrentBalance';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { useHeaderHeight } from '@react-navigation/elements';
import { useRoute } from '@react-navigation/native';
import { GetNestedScreenRouteProp } from '@/navigation-type';
import { RightArea } from './SingleHomeRightArea';
import { BottomBtns } from './components/BottomBtns';
import { useSafeSizes } from '@/hooks/useAppLayout';

function HomeScreen(): JSX.Element {
  const { navigation, setNavigationOptions } = useSafeSetNavigationOptions();
  const { styles } = useTheme2024({ getStyle: getStyles });
  const [isDecrease, setIsDecrease] = React.useState<boolean>(false);
  const fadeAnim = React.useRef(new Animated.Value(1)).current;
  const route =
    useRoute<
      GetNestedScreenRouteProp<
        'SingleAddressNavigatorParamList',
        'SingleAddressHome'
      >
    >();
  const currentAccount = route?.params?.account;
  const { triggerUpdate } = useTriggerHomeBalanceUpdate();
  const headerHeight = useHeaderHeight();
  const { safeOffHeader } = useSafeSizes();

  const handleUpdateIsDecrease = React.useCallback((status: boolean) => {
    setIsDecrease(status);
  }, []);

  const handleReachTopStatusChange = React.useCallback(
    (status: boolean) => {
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

  return (
    <NormalScreenContainer2024
      type="bg1"
      overwriteStyle={styles.rootScreenContainer}>
      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: '100%',
          height: Math.max(headerHeight, 130),
          opacity: fadeAnim,
        }}>
        <ImageBackground
          source={
            !isDecrease
              ? require('@/assets2024/singleHome/up.png')
              : require('@/assets2024/singleHome/loss.png')
          }
          resizeMode="cover"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: safeOffHeader + 120,
          }}
        />
      </Animated.View>
      <View style={styles.safeView}>
        <AssetContainer
          onRefresh={triggerUpdate}
          onUpdateIsDecrease={handleUpdateIsDecrease}
          onReachTopStatusChange={handleReachTopStatusChange}
          account={currentAccount}
        />
      </View>
      <View style={styles.bottomContainer}>
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
