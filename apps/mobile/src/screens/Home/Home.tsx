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

function HomeScreen(): JSX.Element {
  const navigation = useNavigation();
  const colors = useThemeColors();

  React.useEffect(() => {
    navigation.setOptions({
      headerTitle: () => <HomeScreen.HeaderArea />,
      headerStyle: {
        backgroundColor: colors['neutral-bg-1'],
      },
    });
  }, [colors, navigation]);

  const init = useMemoizedFn(async () => {
    const accounts = await keyringService.getAllVisibleAccounts();
    if (!accounts?.length) {
      navigation.dispatch(
        StackActions.replace(RootNames.StackGetStarted, {
          screen: RootNames.GetStarted,
        }),
      );
      // navigate(RootNames.StackAddress, {
      //   screen: RootNames.ImportNewAddress,
      // });
    }
  });

  useFocusEffect(
    useCallback(() => {
      init();
    }, [init]),
  );

  return (
    <RootScreenContainer style={{ backgroundColor: colors['neutral-bg-1'] }}>
      <SafeAreaView style={styles.safeView}>
        <AssetContainer renderHeader={() => <HomeTopArea />} />
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
