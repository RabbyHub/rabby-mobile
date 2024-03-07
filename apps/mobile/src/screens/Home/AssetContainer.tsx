import { useCurrentAccount } from '@/hooks/account';
import { useThemeColors } from '@/hooks/theme';
import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import {
  Tabs,
  CollapsibleProps,
  MaterialTabBar,
  MaterialTabItem,
} from 'react-native-collapsible-tab-view';
import { DefiScreen } from './DefiScreen';
import { NFTScreen } from './NFTScreen';
import { TokenScreen } from './TokenScreen';

const isAndroid = Platform.OS === 'android';

interface Props {
  renderHeader: CollapsibleProps['renderHeader'];
  onRefresh(): void;
}

export const AssetContainer: React.FC<Props> = ({
  renderHeader,
  onRefresh,
}) => {
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
          borderColor: colors['neutral-line'],
          borderWidth: StyleSheet.hairlineWidth,
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

  const renderTabItem = React.useCallback(
    (props: any) => (
      <MaterialTabItem
        {...(isAndroid && {
          pressColor: 'transparent',
        })}
        {...props}
        inactiveOpacity={1}
      />
    ),
    [],
  );

  const renderTabBar = React.useCallback(
    (props: any) => (
      <MaterialTabBar
        {...props}
        scrollEnabled={false}
        indicatorStyle={styles.indicator}
        tabStyle={styles.tabBar}
        TabItemComponent={renderTabItem}
        activeColor={colors['blue-default']}
        inactiveColor={colors['neutral-body']}
        labelStyle={styles.label}
        indicatorContainerStyle={styles.tabBarIndicator}
      />
    ),
    [
      colors,
      renderTabItem,
      styles.indicator,
      styles.label,
      styles.tabBar,
      styles.tabBarIndicator,
    ],
  );

  if (!currentAccount?.address) {
    return null;
  }

  return (
    <Tabs.Container
      lazy
      containerStyle={styles.container}
      minHeaderHeight={100}
      renderTabBar={renderTabBar}
      headerContainerStyle={styles.tabBarWrap}
      renderHeader={renderHeader}>
      <Tabs.Tab label="Token" name="token">
        <TokenScreen onRefresh={onRefresh} />
      </Tabs.Tab>
      <Tabs.Tab label="DeFi" name="defi">
        <DefiScreen onRefresh={onRefresh} />
      </Tabs.Tab>
      <Tabs.Tab label="NFT" name="nft">
        <NFTScreen onRefresh={onRefresh} />
      </Tabs.Tab>
    </Tabs.Container>
  );
};
