import React, { useCallback } from 'react';
import { Pressable, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import type { NativeStackHeaderProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HeaderAccountSwitcher } from '@/components/AccountSwitcher/HeaderAccountSwitcher';
import { Text } from '@/components/Typography';
import { RootNames } from '@/constant/layout';
import { HeaderBackPressable } from '@/hooks/navigation';
import { useTheme2024 } from '@/hooks/theme';
import type { SwapBridgeTab } from '@/navigation-type';
import { createGetStyles2024 } from '@/utils/styles';
import { BridgeHeader } from '../Bridge/components/BridgeHeader';
import { SwapHeader } from '../Swap/components/Header';
import { getSwapBridgeActiveTab } from './navigationParams';

const TABS: { key: SwapBridgeTab; title: string }[] = [
  { key: 'swap', title: 'Swap' },
  { key: 'bridge', title: 'Bridge' },
  // 这两个 tab 不需要翻译，确保长度固定
];

const HEADER_HEIGHT = 58;

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
        formatDefaultAliasAsAddress
        maxWidth={170}
        style={styles.headerAccountSwitcher}
      />
      <View style={styles.headerAction}>
        {activeTab === 'swap' ? (
          <SwapHeader isForMultipleAddress={isForMultipleAddress} />
        ) : (
          <BridgeHeader />
        )}
      </View>
    </View>
  );
}

export function SwapBridgeHeader({
  route,
  navigation,
}: NativeStackHeaderProps) {
  const activeTab = getSwapBridgeActiveTab(route.params);
  // Native-stack renders the header inside this route's navigation context.
  // Swap-again may leave another route mounted, but only the focused route
  // should host shared account/history actions.
  const isScreenFocused = useIsFocused();
  const { styles } = useTheme2024({ getStyle });
  const { top } = useSafeAreaInsets();
  const onTabPress = useCallback(
    (tab: SwapBridgeTab) => {
      if (tab !== activeTab) {
        navigation.setParams({ activeTab: tab });
      }
    },
    [activeTab, navigation],
  );

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
        {isScreenFocused && (
          <SwapBridgeHeaderRight
            activeTab={activeTab}
            isForMultipleAddress={route.name === RootNames.MultiSwapBridge}
          />
        )}
      </View>
    </View>
  );
}

export function renderSwapBridgeHeader(props: NativeStackHeaderProps) {
  return <SwapBridgeHeader {...props} />;
}

const getStyle = createGetStyles2024(({ colors2024 }) => ({
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
    fontFamily: 'SF Pro Rounded',
    fontWeight: '900',
    fontSize: 20,
    lineHeight: 24,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    justifyContent: 'flex-end',
    gap: 8,
  },
  headerAccountSwitcher: {
    flexShrink: 1,
    minWidth: 0,
  },
  headerAction: {
    flexShrink: 0,
  },
}));
