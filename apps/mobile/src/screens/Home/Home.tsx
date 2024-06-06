/**
 * Sample React Native HomeScreen
 * https://github.com/facebook/react-native
 *
 * @format
 */
import React, { useCallback, useEffect } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import RootScreenContainer from '@/components/ScreenContainer/RootScreenContainer';

import HeaderArea from './HeaderArea';
import {
  StackActions,
  useFocusEffect,
  useNavigation,
} from '@react-navigation/native';
import { useThemeColors } from '@/hooks/theme';
import { AssetContainer } from './AssetContainer';

import { HomeTopArea } from './components/HomeTopArea';
import { useMemoizedFn } from 'ahooks';
import { keyringService } from '@/core/services';
import { navigate } from '@/utils/navigation';
import { RootNames } from '@/constant/layout';
import { useUpdateNonce } from '@/hooks/useCurrentBalance';
import { useCurrentAccount } from '@/hooks/account';

function HomeScreen(): JSX.Element {
  const navigation = useNavigation();
  const colors = useThemeColors();
  const [nonce, setNonce] = useUpdateNonce();
  const { currentAccount } = useCurrentAccount({
    disableAutoFetch: true,
  });

  React.useEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <HomeScreen.HeaderArea key={currentAccount?.address} />
      ),
      headerStyle: {
        backgroundColor: colors['neutral-bg-1'],
      },
    });
  }, [colors, currentAccount?.address, navigation]);

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
      navigation.dispatch(
        StackActions.replace(RootNames.StackSettings, {
          screen: RootNames.SetPassword,
        }),
      );
    }
  });

  const handleRefresh = () => {
    setNonce(nonce + 1);
  };

  useFocusEffect(
    useCallback(() => {
      init();
    }, [init]),
  );

  return (
    <RootScreenContainer style={{ backgroundColor: colors['neutral-bg-1'] }}>
      <SafeAreaView style={styles.safeView}>
        <AssetContainer
          renderHeader={() => <HomeTopArea />}
          onRefresh={handleRefresh}
        />
      </SafeAreaView>
    </RootScreenContainer>
  );
}

HomeScreen.HeaderArea = HeaderArea;

const styles = StyleSheet.create({
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
});

export default HomeScreen;
