import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View, Platform, StyleSheet } from 'react-native';
import {
  Tabs,
  MaterialTabBar,
  MaterialTabItem,
} from 'react-native-collapsible-tab-view';

import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import { useCurrentAccount } from '@/hooks/account';
import { useThemeColors, useThemeStyles } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import { ApprovalsBottomArea } from './components/Layout';
import { ApprovalsLayouts } from './layout';
import ListByAssets from './ListByAssets';
import ListByContracts from './ListByContracts';
import {
  ApprovalsPageContext,
  FILTER_TYPES,
  useApprovalsPage,
  useApprovalsPageOnTop,
} from './useApprovalsPage';
import BottomSheetApprovalContract from './components/BottomSheetApprovalContract';
import BottomSheetApprovalAsset from './components/BottomSheetApprovalAsset';
import NetSwitchTabs, {
  useSwitchNetTab,
} from '@/components/PillsSwitch/NetSwitchTabs';
import RcIconNotFindCC from '@/assets/icons/select-chain/icon-notfind-cc.svg';

const isAndroid = Platform.OS === 'android';

const ApprovalScreenContainer = () => {
  const { currentAccount } = useCurrentAccount();
  const { styles, colors } = useThemeStyles(getStyles);
  const { t } = useTranslation();

  const renderTabItem = React.useCallback<
    React.ComponentProps<typeof MaterialTabBar>['TabItemComponent'] & object
  >(
    props => (
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

  const renderTabBar = React.useCallback<
    React.ComponentProps<typeof Tabs.Container>['renderTabBar'] & object
  >(
    props => (
      <MaterialTabBar
        {...props}
        scrollEnabled={false}
        indicatorStyle={styles.indicator}
        tabStyle={styles.tabBar}
        TabItemComponent={renderTabItem}
        activeColor={colors['blue-default']}
        inactiveColor={colors['neutral-body']}
        labelStyle={styles.label}
      />
    ),
    [colors, renderTabItem, styles.indicator, styles.label, styles.tabBar],
  );

  const { filterType, setFilterType } = useApprovalsPage();

  if (!currentAccount?.address) {
    return null;
  }

  return (
    <Tabs.Container
      initialTabName={filterType}
      onTabChange={({ tabName }) => {
        setFilterType(tabName as any);
      }}
      // {...(__DEV__ && {
      //   initialTabName: 'assets',
      // })}
      lazy
      allowHeaderOverscroll={false}
      containerStyle={[styles.tabContainer]}
      renderTabBar={renderTabBar}
      // disable horizontal swiping-scroll-to-switch
      pagerProps={{ scrollEnabled: false }}
      headerContainerStyle={styles.tabHeaderContainer}>
      <Tabs.Tab
        label={t('page.approvals.tab-switch.contract')}
        name={FILTER_TYPES.contract}>
        <ListByContracts />
      </Tabs.Tab>
      <Tabs.Tab
        label={t('page.approvals.tab-switch.assets')}
        name={FILTER_TYPES.assets}>
        <ListByAssets />
      </Tabs.Tab>
    </Tabs.Container>
  );
};

function MainnetApprovalsScreen() {
  const colors = useThemeColors();

  const approvalsPageCtx = useApprovalsPageOnTop({ isTestnet: false });

  const { loadApprovals } = approvalsPageCtx;

  useEffect(() => {
    loadApprovals();
  }, [loadApprovals]);

  return (
    <ApprovalsPageContext.Provider value={approvalsPageCtx}>
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          backgroundColor: colors['neutral-bg2'],
          position: 'relative',
        }}>
        <ApprovalScreenContainer />

        <BottomSheetApprovalContract />
        <BottomSheetApprovalAsset />

        <ApprovalsBottomArea />
      </View>
    </ApprovalsPageContext.Provider>
  );
}

export default function ApprovalsScreen() {
  const { selectedTab, onTabChange } = useSwitchNetTab();
  const colors = useThemeColors();
  const styles = getStyles(colors);
  return (
    <NormalScreenContainer>
      <NetSwitchTabs
        value={selectedTab}
        onTabChange={onTabChange}
        style={styles.netTabs}
      />
      {selectedTab === 'mainnet' ? (
        <MainnetApprovalsScreen />
      ) : (
        <View style={styles.notFound}>
          <RcIconNotFindCC color={colors['neutral-body']} />
          <Text style={styles.notFoundText}>
            Not supported for custom network
          </Text>
        </View>
      )}
    </NormalScreenContainer>
  );
}

const getStyles = createGetStyles(colors => {
  return StyleSheet.create({
    tabContainer: {
      backgroundColor: colors['neutral-bg2'],
    },
    tabHeaderContainer: {
      backgroundColor: colors['neutral-bg2'],
      shadowColor: 'transparent',
      borderTopWidth: 0,
      borderColor: colors['neutral-line'],
      borderWidth: StyleSheet.hairlineWidth,
      // ...makeDevOnlyStyle({ backgroundColor: 'transparent' }),
      // ...makeDebugBorder('red'),
    },
    tabBar: {
      height: ApprovalsLayouts.tabbarHeight,
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
    netTabs: {
      marginBottom: 18,
    },
    notFound: {
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '80%',
    },
    notFoundText: {
      fontSize: 14,
      lineHeight: 17,
      color: colors['neutral-body'],
      marginTop: 16,
    },
  });
});
