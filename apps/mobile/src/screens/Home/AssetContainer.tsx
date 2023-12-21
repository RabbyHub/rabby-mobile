import { useCurrentAccount } from '@/hooks/account';
import { useThemeColors } from '@/hooks/theme';
import React from 'react';
import { StyleSheet } from 'react-native';
import {
  Tabs,
  CollapsibleProps,
  MaterialTabBar,
} from 'react-native-collapsible-tab-view';
import { DefiScreen } from './DefiScreen';
import { NFTScreen } from './NFTScreen';
import { TokenScreen } from './TokenScreen';

interface Props {
  renderHeader: CollapsibleProps['renderHeader'];
}

export const AssetContainer: React.FC<Props> = ({ renderHeader }) => {
  const { currentAccount } = useCurrentAccount();
  const colors = useThemeColors();
  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        container: {
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
          fontWeight: '500',
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
    (props: any) => (
      <MaterialTabBar
        {...props}
        scrollEnabled={false}
        style={styles.tabBarWrap}
        indicatorStyle={styles.indicator}
        tabStyle={styles.tabBar}
        labelStyle={styles.label}
        indicatorContainerStyle={styles.tabBarIndicator}
      />
    ),
    [styles],
  );

  if (!currentAccount?.address) {
    return null;
  }

  return (
    <Tabs.Container
      containerStyle={styles.container}
      minHeaderHeight={10}
      renderTabBar={renderTabBar}
      renderHeader={renderHeader}>
      <Tabs.Tab label="Token" name="Token">
        <TokenScreen />
      </Tabs.Tab>
      <Tabs.Tab label="DeFi" name="Defi">
        <DefiScreen />
      </Tabs.Tab>
      <Tabs.Tab label="NFT" name="NFT">
        <NFTScreen />
      </Tabs.Tab>
    </Tabs.Container>
  );
};
