import React, { useCallback } from 'react';
import { SafeAreaView } from 'react-native';
import HeaderArea from './HeaderArea';
import { StackActions, useFocusEffect } from '@react-navigation/native';
import { AssetContainer } from './AssetContainer';

import { HomeTopArea } from './components/HomeTopArea';
import { useMemoizedFn } from 'ahooks';
import { keyringService } from '@/core/services';
import { RootNames } from '@/constant/layout';
import { useTriggerHomeBalanceUpdate } from '@/hooks/useCurrentBalance';
import { useCurrentAccount } from '@/hooks/account';
import { ScreenSpecificStatusBar } from '@/components/FocusAwareStatusBar';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';

function HomeScreen(): JSX.Element {
  const { navigation, setNavigationOptions } = useSafeSetNavigationOptions();
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });

  const { triggerUpdate } = useTriggerHomeBalanceUpdate();
  const { currentAccount } = useCurrentAccount({
    disableAutoFetch: true,
  });

  React.useEffect(() => {
    setNavigationOptions({
      headerTitle: () => (
        <HomeScreen.HeaderArea key={currentAccount?.address} />
      ),
      headerTitleAlign: 'left',
    });
  }, [currentAccount?.address, navigation, setNavigationOptions]);

  const init = useMemoizedFn(async () => {
    const accounts = await keyringService.getAllVisibleAccountsArray();
    if (!accounts?.length) {
      navigation.dispatch(
        StackActions.replace(RootNames.StackGetStarted, {
          screen: RootNames.GetStartedScreen2024,
        }),
      );
    }
  });

  useFocusEffect(
    useCallback(() => {
      init();
    }, [init]),
  );

  return (
    <NormalScreenContainer2024
      type="linear"
      linearProp={{
        colors: [colors2024['neutral-bg-2'], colors2024['neutral-bg-3']],
        locations: [0.2072, 0.3181],
        start: { x: 0.5, y: 0 },
        end: { x: 0.5, y: 1 },
      }}
      style={styles.rootScreenContainer}>
      {/* <ScreenSpecificStatusBar screenName={RootNames.Home} /> */}
      <SafeAreaView style={styles.safeView}>
        <AssetContainer
          renderHeader={() => <HomeTopArea />}
          onRefresh={triggerUpdate}
        />
      </SafeAreaView>
    </NormalScreenContainer2024>
  );
}

HomeScreen.HeaderArea = HeaderArea;

const getStyles = createGetStyles2024(() => ({
  rootScreenContainer: {
    paddingHorizontal: 16,
  },
  safeView: {
    borderRadius: 24,
    flex: 1,
    width: '100%',
    overflow: 'hidden',
  },
}));

export default HomeScreen;
