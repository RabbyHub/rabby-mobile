import { useCurrentAccount } from '@/hooks/account';
import { useTheme2024 } from '@/hooks/theme';
import React, { useState } from 'react';
import { Platform, StyleSheet, useWindowDimensions } from 'react-native';
import {
  Tabs,
  CollapsibleProps,
  MaterialTabBar,
  MaterialTabItem,
} from 'react-native-collapsible-tab-view';
import { DefiScreen } from './DefiScreen';
import { NFTScreen } from './NFTScreen';
import { TokenScreen } from './TokenScreen';
import { createGetStyles2024 } from '@/utils/styles';

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
  const [activeTab, setActiveTab] = useState('token');
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { width } = useWindowDimensions();

  const renderTabItem = React.useCallback(
    (props: any) => (
      <MaterialTabItem
        {...(isAndroid && {
          pressColor: 'transparent',
        })}
        {...props}
        style={StyleSheet.flatten([
          props.style,
          activeTab === props.name ? styles.activeTab : {},
        ])}
      />
    ),
    [activeTab, styles.activeTab],
  );

  const renderTabBar = React.useCallback(
    (props: any) => (
      <MaterialTabBar
        {...props}
        scrollEnabled={false}
        style={styles.tabBarWrap}
        contentContainerStyle={styles.tabList}
        tabStyle={styles.tabBar}
        indicatorStyle={styles.indicator}
        TabItemComponent={renderTabItem}
        activeColor="white"
        inactiveColor={colors2024['neutral-foot']}
        labelStyle={styles.label}
      />
    ),
    [
      colors2024,
      renderTabItem,
      styles.indicator,
      styles.label,
      styles.tabBar,
      styles.tabBarWrap,
      styles.tabList,
    ],
  );

  if (!currentAccount?.address) {
    return null;
  }

  return (
    <Tabs.Container
      lazy
      width={width - 32}
      containerStyle={styles.container}
      renderTabBar={renderTabBar}
      headerContainerStyle={styles.headerContainer}
      onTabChange={tab => {
        setActiveTab(tab.tabName);
      }}
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

const getStyles = createGetStyles2024(ctx => ({
  container: {
    backgroundColor: ctx.colors2024['neutral-bg-1'],
    width: '100%',
    paddingBottom: 18,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
  },
  headerContainer: {
    backgroundColor: ctx.colors2024['neutral-bg-2'],
    shadowColor: 'transparent',
  },
  tabBarWrap: {
    backgroundColor: ctx.colors2024['neutral-bg-1'],
    paddingTop: 18,
    paddingHorizontal: 16,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    width: '100%',
  },
  tabList: {
    display: 'flex',
    width: '100%',
    gap: 12,
  },
  tabBar: {
    borderRadius: 120,
    height: 36,
    backgroundColor: ctx.colors2024['neutral-bg-2'],
  },
  label: {
    fontSize: 16,
    lineHeight: 20,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '500',
    textTransform: 'none',
  },
  indicator: {
    display: 'none',
  },
  activeTab: {
    backgroundColor: 'rgba(19, 20, 22, 1)',
  },
}));
