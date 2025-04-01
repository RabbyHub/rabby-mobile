import React from 'react';
import { Image, ImageBackground, View } from 'react-native';
import HeaderArea from './HeaderArea';
import { AssetContainer } from './AssetContainer';

import { useTriggerHomeBalanceUpdate } from '@/hooks/useCurrentBalance';
import { useCurrentAccount } from '@/hooks/account';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';

function HomeScreen(): JSX.Element {
  const { navigation, setNavigationOptions } = useSafeSetNavigationOptions();
  const { styles, isLight } = useTheme2024({ getStyle: getStyles });
  const [isDecrease, setIsDecrease] = React.useState<boolean>(false);

  const { triggerUpdate } = useTriggerHomeBalanceUpdate();
  const { currentAccount } = useCurrentAccount({
    disableAutoFetch: true,
  });
  const topBg = React.useMemo(() => {
    if (isDecrease) {
      if (isLight) {
        return [
          require('@/assets2024/singleHome/home-loss-bg-1.png'),
          require('@/assets2024/singleHome/home-loss-bg-2.png'),
        ];
      } else {
        return [
          require('@/assets2024/singleHome/home-loss-dark-bg-1.png'),
          require('@/assets2024/singleHome/home-loss-dark-bg-2.png'),
        ];
      }
    } else {
      if (isLight) {
        return [
          require('@/assets2024/singleHome/home-profit-bg-1.png'),
          require('@/assets2024/singleHome/home-profit-bg-2.png'),
        ];
      } else {
        return [
          require('@/assets2024/singleHome/home-profit-dark-bg-1.png'),
          require('@/assets2024/singleHome/home-profit-dark-bg-2.png'),
        ];
      }
    }
  }, [isDecrease, isLight]);

  const handleUpdateIsDecrease = React.useCallback((status: boolean) => {
    setIsDecrease(status);
  }, []);
  React.useEffect(() => {
    setNavigationOptions({
      headerTitle: () => <HomeScreen.HeaderArea />,
    });
  }, [currentAccount?.address, navigation, setNavigationOptions]);

  return (
    <NormalScreenContainer2024
      type="bg1"
      overwriteStyle={styles.rootScreenContainer}>
      <ImageBackground
        source={topBg[0]}
        resizeMode="cover"
        // eslint-disable-next-line react-native/no-inline-styles
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: '100%',
          height: 100,
        }}
      />
      <ImageBackground
        source={topBg[1]}
        resizeMode="cover"
        // eslint-disable-next-line react-native/no-inline-styles
        style={{
          position: 'absolute',
          top: 100,
          right: 0,
          width: '100%',
          height: 150,
        }}
      />
      <View style={styles.safeView}>
        <AssetContainer
          onRefresh={triggerUpdate}
          onUpdateIsDecrease={handleUpdateIsDecrease}
        />
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
  safeView: {
    flex: 1,
    width: '100%',
    overflow: 'hidden',
  },
}));

export default HomeScreen;
