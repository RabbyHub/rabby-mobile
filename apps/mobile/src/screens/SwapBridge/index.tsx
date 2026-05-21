import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AccountSwitcherModal } from '@/components/AccountSwitcher/Modal';
import { HeaderAccountSwitcher } from '@/components/AccountSwitcher/HeaderAccountSwitcher';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { Text } from '@/components/Typography';
import { RootNames } from '@/constant/layout';
import { HeaderBackPressable } from '@/hooks/navigation';
import { useTheme2024 } from '@/hooks/theme';
import {
  type GetNestedScreenRouteProp,
  type SwapBridgeTab,
} from '@/navigation-type';
import { createGetStyles2024 } from '@/utils/styles';

import { Bridge } from './Bridge';
import { BridgeHeader } from '../Bridge/components/BridgeHeader';
import Swap from './Swap';
import { SwapHeader } from '../Swap/components/Header';

type SwapBridgeRoute = GetNestedScreenRouteProp<
  'TransactionNavigatorParamList',
  typeof RootNames.SwapBridge | typeof RootNames.MultiSwapBridge
>;

type SwapBridgeScreenProps = {
  isForMultipleAddress?: boolean;
};

const TABS: { key: SwapBridgeTab; title: string }[] = [
  { key: 'swap', title: 'Swap' },
  { key: 'bridge', title: 'Bridge' },
  // 这两个 tab 不需要翻译，确保长度固定
];

const HEADER_HEIGHT = 58;

const getInitialTab = (route: SwapBridgeRoute): SwapBridgeTab => {
  const activeTab = route.params?.activeTab;
  if (activeTab === 'swap' || activeTab === 'bridge') {
    return activeTab;
  }

  return 'swap';
};

function SwapBridgeHeaderTitle({
  activeTab,
  onTabPress,
}: {
  activeTab: SwapBridgeTab;
  onTabPress: (tab: SwapBridgeTab) => void;
}) {
  const { styles } = useTheme2024({ getStyle });

  return (
    <View style={styles.headerTabs}>
      {TABS.map(tab => {
        const isActive = activeTab === tab.key;

        return (
          <Pressable
            key={tab.key}
            hitSlop={8}
            style={styles.headerTab}
            onPress={() => onTabPress(tab.key)}>
            <Text
              style={[
                styles.headerTabText,
                isActive && styles.headerTabTextActive,
              ]}>
              {tab.title}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function SwapBridgeHeaderRight({
  activeTab,
  isForMultipleAddress,
}: {
  activeTab: SwapBridgeTab;
  isForMultipleAddress: boolean;
}) {
  const { styles } = useTheme2024({ getStyle });

  return (
    <View style={styles.headerRight}>
      <HeaderAccountSwitcher
        forScene="MakeTransactionAbout"
        style={styles.headerAccountSwitcher}
      />
      {activeTab === 'swap' ? (
        <SwapHeader isForMultipleAddress={isForMultipleAddress} />
      ) : (
        <BridgeHeader />
      )}
    </View>
  );
}

function SwapBridgeNativeHeader({
  activeTab,
  isForMultipleAddress,
  onTabPress,
}: {
  activeTab: SwapBridgeTab;
  isForMultipleAddress: boolean;
  onTabPress: (tab: SwapBridgeTab) => void;
}) {
  const { styles } = useTheme2024({ getStyle });
  const { top } = useSafeAreaInsets();

  return (
    <View style={[styles.headerOuter, { marginTop: top }]}>
      <View style={styles.headerInner}>
        <View style={styles.headerLeft}>
          <HeaderBackPressable style={styles.headerBackButton} />
          <SwapBridgeHeaderTitle
            activeTab={activeTab}
            onTabPress={onTabPress}
          />
        </View>
        <SwapBridgeHeaderRight
          activeTab={activeTab}
          isForMultipleAddress={isForMultipleAddress}
        />
      </View>
    </View>
  );
}

function SwapBridgeScreen({
  isForMultipleAddress = false,
}: SwapBridgeScreenProps) {
  const route = useRoute<SwapBridgeRoute>();
  const initialTab = useMemo(() => getInitialTab(route), [route]);
  const [activeTab, setActiveTab] = useState<SwapBridgeTab>(initialTab);
  const { styles } = useTheme2024({ getStyle });
  const { setNavigationOptions } = useSafeSetNavigationOptions();

  const handleTabPress = useCallback(
    (tab: SwapBridgeTab) => {
      if (tab === activeTab) {
        return;
      }

      setActiveTab(tab);
    },
    [activeTab],
  );

  const renderHeader = useCallback(
    () => (
      <SwapBridgeNativeHeader
        activeTab={activeTab}
        isForMultipleAddress={isForMultipleAddress}
        onTabPress={handleTabPress}
      />
    ),
    [activeTab, handleTabPress, isForMultipleAddress],
  );

  useEffect(() => {
    setNavigationOptions({
      title: '',
      header: renderHeader,
    });
  }, [renderHeader, setNavigationOptions]);

  return (
    <View style={styles.container}>
      <AccountSwitcherModal forScene="MakeTransactionAbout" inScreen />
      <View
        pointerEvents={activeTab === 'swap' ? 'auto' : 'none'}
        style={[
          styles.tabScene,
          activeTab !== 'swap' && styles.inactiveTabScene,
        ]}>
        {isForMultipleAddress ? (
          <Swap.ForMultipleAddress
            disableHeaderRight
            disableAccountSwitcherModal
          />
        ) : (
          <Swap disableHeaderRight disableAccountSwitcherModal />
        )}
      </View>
      <View
        pointerEvents={activeTab === 'bridge' ? 'auto' : 'none'}
        style={[
          styles.tabScene,
          activeTab !== 'bridge' && styles.inactiveTabScene,
        ]}>
        {isForMultipleAddress ? (
          <Bridge.ForMultipleAddress
            disableHeaderRight
            disableAccountSwitcherModal
          />
        ) : (
          <Bridge disableHeaderRight disableAccountSwitcherModal />
        )}
      </View>
    </View>
  );
}

function ForMultipleAddress() {
  return <SwapBridgeScreen isForMultipleAddress />;
}

SwapBridgeScreen.ForMultipleAddress = ForMultipleAddress;

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    flex: 1,
    backgroundColor: colors2024['neutral-bg-1'],
  },
  tabScene: {
    ...StyleSheet.absoluteFillObject,
  },
  inactiveTabScene: {
    display: 'none',
  },
  headerOuter: {
    height: HEADER_HEIGHT,
    paddingHorizontal: 12,
    paddingRight: 16,
    paddingVertical: 10,
    backgroundColor: colors2024['neutral-bg-1'],
  },
  headerInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minWidth: 0,
  },
  headerTabs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  headerBackButton: {
    marginLeft: 0,
    paddingLeft: 0,
  },
  headerTab: {
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTabText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    color: colors2024['neutral-info'],
  },
  headerTabTextActive: {
    color: colors2024['neutral-title-1'],
    fontWeight: '800',
    fontSize: 20,
    lineHeight: 24,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    justifyContent: 'flex-end',
    gap: 8,
  },
  headerAccountSwitcher: {
    flex: 1,
    minWidth: 0,
  },
}));

export default SwapBridgeScreen;
