import { useCurrentAccount } from '@/hooks/account';
import { useThemeColors } from '@/hooks/theme';
import React from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { SceneMap, TabBar, TabView } from 'react-native-tab-view';
import { DefiScreen } from './DefiScreen';
import { NFTScreen } from './NFTScreen';
import { TokenScreen } from './TokenScreen';

const renderScene = SceneMap({
  token: TokenScreen,
  defi: DefiScreen,
  nft: NFTScreen,
});

export const AssetContainer = () => {
  const layout = useWindowDimensions();
  const { currentAccount } = useCurrentAccount();
  const [index, setIndex] = React.useState(0);
  const [routes] = React.useState([
    { key: 'token', title: 'Token' },
    { key: 'defi', title: 'Defi' },
    { key: 'nft', title: 'NFT' },
  ]);
  const colors = useThemeColors();
  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        scene: {
          flex: 1,
          backgroundColor: colors['neutral-bg-1'],
        },
        tabBarWrap: {
          backgroundColor: colors['neutral-bg-1'],
          shadowColor: 'transparent',
        },
        tabBar: {
          height: 36,
        },
        label: {
          fontSize: 16,
          height: 36,
          fontWeight: '500',
          margin: 0,
          padding: 0,
          textTransform: 'none',
        },
        indicator: {
          backgroundColor: colors['blue-default'],
          height: 2,
        },
        tabBarIndicator: {
          flexDirection: 'row',
          justifyContent: 'center',
          backgroundColor: 'transparent',
        },
      }),
    [colors],
  );

  const renderTabBar = React.useCallback(
    (tabBarProps: any) => {
      return (
        <TabBar
          {...tabBarProps}
          style={styles.tabBarWrap}
          tabStyle={styles.tabBar}
          labelStyle={styles.label}
          activeColor={colors['blue-default']}
          inactiveColor={colors['neutral-body']}
          indicatorStyle={styles.indicator}
        />
      );
    },
    [colors, styles],
  );

  if (!currentAccount?.address) {
    return null;
  }

  return (
    <TabView
      navigationState={{ index, routes }}
      renderScene={renderScene}
      onIndexChange={setIndex}
      initialLayout={{ width: layout.width }}
      sceneContainerStyle={styles.scene}
      renderTabBar={renderTabBar}
    />
  );
};
