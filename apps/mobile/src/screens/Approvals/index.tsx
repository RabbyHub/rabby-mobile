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
import {
  ApprovalsBottomArea,
  ApprovalsLayouts,
  ApprovalsTabView,
} from './components/Layout';
import ListByAssets from './ListByAssets';
import ListByContracts from './ListByContracts';
import {
  ApprovalsPageContext,
  useApprovalsPageOnTop,
} from './useApprovalsPage';

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

  if (!currentAccount?.address) {
    return null;
  }

  return (
    <Tabs.Container
      lazy
      containerStyle={[styles.tabContainer]}
      renderTabBar={renderTabBar}
      // disable horizontal swiping-scroll-to-switch
      pagerProps={{ scrollEnabled: false }}
      headerContainerStyle={styles.tabHeaderContainer}>
      <Tabs.Tab label={t('page.approvals.tab-switch.contract')} name="contract">
        <ListByContracts />
      </Tabs.Tab>
      <Tabs.Tab label={t('page.approvals.tab-switch.assets')} name="assets">
        <ListByAssets />
      </Tabs.Tab>
    </Tabs.Container>
  );
};

export default function ApprovalsScreen() {
  const colors = useThemeColors();

  const approvalsPageCtx = useApprovalsPageOnTop({ isTestnet: false });

  const { loadApprovals } = approvalsPageCtx;

  useEffect(() => {
    loadApprovals();
  }, [loadApprovals]);
  return (
    <ApprovalsPageContext.Provider value={approvalsPageCtx}>
      <NormalScreenContainer
        style={{
          flex: 1,
          alignItems: 'center',
          backgroundColor: colors['neutral-bg2'],
          position: 'relative',
        }}>
        <ApprovalScreenContainer />

        <ApprovalsBottomArea />
      </NormalScreenContainer>
    </ApprovalsPageContext.Provider>
  );
}

const getStyles = createGetStyles(colors => {
  return StyleSheet.create({
    tabContainer: {
      backgroundColor: colors['neutral-bg2'],
    },
    tabHeaderContainer: {
      backgroundColor: colors['neutral-bg2'],
      // ...makeDevOnlyStyle({ backgroundColor: 'transparent' }),
      shadowColor: 'transparent',
      borderTopWidth: 0,
      borderColor: colors['neutral-line'],
      borderWidth: StyleSheet.hairlineWidth,
    },
    tabBar: {
      height: ApprovalsLayouts.tabbarHeight,
    },
    // tabBarIndicator: {
    //   flexDirection: 'row',
    //   justifyContent: 'center',
    //   backgroundColor: 'transparent',
    // },
    label: {
      fontSize: 16,
      fontWeight: '500',
      textTransform: 'none',
    },
    indicator: {
      backgroundColor: colors['blue-default'],
      height: 2,
    },
  });
});
