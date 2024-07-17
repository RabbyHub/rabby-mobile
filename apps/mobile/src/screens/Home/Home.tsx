/**
 * Sample React Native HomeScreen
 * https://github.com/facebook/react-native
 *
 * @format
 */
import React, { useCallback } from 'react';
import { SafeAreaView } from 'react-native';
import RootScreenContainer from '@/components/ScreenContainer/RootScreenContainer';

import HeaderArea from './HeaderArea';
import { StackActions, useFocusEffect } from '@react-navigation/native';
import { useThemeStyles } from '@/hooks/theme';
import { AssetContainer } from './AssetContainer';

import { HomeTopArea } from './components/HomeTopArea';
import { useMemoizedFn } from 'ahooks';
import { keyringService } from '@/core/services';
import { RootNames } from '@/constant/layout';
import { useTriggerHomeBalanceUpdate } from '@/hooks/useCurrentBalance';
import { useCurrentAccount } from '@/hooks/account';
import { createGetStyles, makeDebugBorder } from '@/utils/styles';
import { ScreenSpecificStatusBar } from '@/components/FocusAwareStatusBar';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';

function HomeScreen(): JSX.Element {
  const { navigation, setNavigationOptions } = useSafeSetNavigationOptions();
  const { styles, colors } = useThemeStyles(getStyles);
  const { triggerUpdate } = useTriggerHomeBalanceUpdate();
  const { currentAccount } = useCurrentAccount({
    disableAutoFetch: true,
  });

  React.useEffect(() => {
    setNavigationOptions({
      headerTitle: () => (
        <HomeScreen.HeaderArea key={currentAccount?.address} />
      ),
      headerStyle: {
        backgroundColor: colors['neutral-bg-1'],
      },
    });
  }, [colors, currentAccount?.address, navigation, setNavigationOptions]);

  const init = useMemoizedFn(async () => {
    const accounts = await keyringService.getAllVisibleAccountsArray();
    if (!accounts?.length) {
      navigation.dispatch(
        StackActions.replace(RootNames.StackGetStarted, {
          screen: RootNames.GetStarted,
        }),
      );
      // navigate(RootNames.StackAddress, {
      //   screen: RootNames.ImportNewAddress,
      // });
    } else if (__DEV__) {
      // debug only
      // navigation.dispatch(
      //   StackActions.replace(RootNames.StackSettings, {
      //     screen: RootNames.SetPassword,
      //   }),
      // );
      // navigation.dispatch(
      //   StackActions.replace(RootNames.Unlock),
      // );
    }
  });

  useFocusEffect(
    useCallback(() => {
      init();
    }, [init]),
  );

  return (
    <RootScreenContainer fitStatuBar style={styles.rootScreenContainer}>
      <ScreenSpecificStatusBar screenName={RootNames.Home} />
      <SafeAreaView style={styles.safeView}>
        <AssetContainer
          renderHeader={() => <HomeTopArea />}
          onRefresh={triggerUpdate}
        />
      </SafeAreaView>
    </RootScreenContainer>
  );
}

HomeScreen.HeaderArea = HeaderArea;

const getStyles = createGetStyles(colors => {
  return {
    rootScreenContainer: {
      backgroundColor: colors['neutral-bg-1'],
      // ...makeDebugBorder(),
    },
    safeView: {
      flex: 1,
      overflow: 'hidden',
    },
    sectionContainer: {
      marginTop: 32,
      paddingHorizontal: 24,
    },
    sectionTitle: {
      fontSize: 24,
      fontWeight: '600',
    },
    sectionDescription: {
      marginTop: 8,
      fontSize: 18,
      fontWeight: '400',
    },
    highlight: {
      fontWeight: '700',
    },
  };
});

export default HomeScreen;
