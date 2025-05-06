import React from 'react';
import { useTranslation } from 'react-i18next';
import { View, Platform, Dimensions, Text } from 'react-native';
import {
  Tabs,
  MaterialTabBar,
  MaterialTabItem,
} from 'react-native-collapsible-tab-view';

import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { useCurrentAccount } from '@/hooks/account';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { ApprovalsBottomArea } from './components/Layout';
import { ApprovalsLayouts, IOS_SWIPABLE_LEFT_OFFSET } from './layout';
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
import { IS_IOS } from '@/core/native/utils';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { WalletIcon } from '@/components2024/WalletIcon/WalletIcon';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
const isAndroid = Platform.OS === 'android';

const ApprovalScreenContainer = () => {
  const { currentAccount } = useCurrentAccount();
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { setNavigationOptions } = useSafeSetNavigationOptions();
  const { filterType, setFilterType } = useApprovalsPage();

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
        style={styles.tabBarWrap}
        indicatorStyle={styles.indicator}
        tabStyle={styles.tabBar}
        TabItemComponent={renderTabItem}
        activeColor={colors2024['brand-default']}
        inactiveColor={colors2024['neutral-secondary']}
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
    ],
  );

  const getHeaderTitle = React.useCallback(() => {
    return (
      <View style={styles.title}>
        <WalletIcon
          type={currentAccount?.brandName as KEYRING_TYPE}
          width={25}
          height={25}
          borderRadius={6}
        />
        <Text numberOfLines={1} ellipsizeMode="tail" style={styles.titleText}>
          {currentAccount?.aliasName || currentAccount?.brandName}
        </Text>
      </View>
    );
  }, [
    currentAccount?.aliasName,
    currentAccount?.brandName,
    styles.title,
    styles.titleText,
  ]);

  React.useEffect(() => {
    setNavigationOptions({
      headerTitle: getHeaderTitle,
      headerStyle: {
        backgroundColor: colors2024['neutral-bg-1'],
      },
    });
  }, [
    setNavigationOptions,
    getHeaderTitle,
    currentAccount?.aliasName,
    colors2024,
  ]);

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

export default function ApprovalsScreen() {
  const { styles } = useTheme2024({ getStyle });

  const approvalsPageCtx = useApprovalsPageOnTop({ isTestnet: false });

  const { loadApprovals } = approvalsPageCtx;

  React.useEffect(() => {
    loadApprovals();
  }, [loadApprovals]);

  return (
    <NormalScreenContainer2024 overwriteStyle={styles.root}>
      <ApprovalsPageContext.Provider value={approvalsPageCtx}>
        <View style={styles.verticalContainer}>
          <ApprovalScreenContainer />

          <BottomSheetApprovalContract />
          <BottomSheetApprovalAsset />

          <ApprovalsBottomArea />
        </View>
      </ApprovalsPageContext.Provider>
    </NormalScreenContainer2024>
  );
}

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  root: {
    // backgroundColor: colors2024['neutral-bg-2'],
  },
  verticalContainer: {
    flex: 1,
    alignItems: 'center',
    position: 'relative',
  },
  title: {
    gap: 8,
    flexDirection: 'row',
  },
  titleText: {
    color: colors2024['neutral-title-1'],
    fontWeight: '800',
    fontSize: 20,
    fontFamily: 'SF Pro Rounded',
    lineHeight: 24,
  },
  tabContainer: {
    backgroundColor: isLight
      ? colors2024['neutral-bg-0']
      : colors2024['neutral-bg-1'],
  },
  tabHeaderContainer: {
    shadowColor: 'transparent',
    borderTopWidth: 0,
    borderColor: colors2024['neutral-line'],
  },
  tabBar: {
    height: ApprovalsLayouts.tabbarHeight,
    backgroundColor: colors2024['neutral-bg-1'],
    borderBottomWidth: 0.5,
    borderColor: colors2024['neutral-line'],
  },
  tabBarWrap: {
    backgroundColor: colors2024['neutral-bg-1'],
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    textTransform: 'none',
  },
  indicator: {
    backgroundColor: colors2024['brand-default'],
    height: 4,
    borderRadius: 100,
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
    color: colors2024['neutral-body'],
    marginTop: 16,
  },
}));
