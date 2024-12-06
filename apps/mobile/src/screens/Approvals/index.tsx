import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Platform, Dimensions } from 'react-native';
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
import { IS_IOS } from '@/core/native/utils';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { ellipsisAddress } from '@/utils/address';
import { HeaderRight } from './components/Headers/HeaderRight';
import { HeaderCenter } from './components/Headers/HeaderCenter';
const isAndroid = Platform.OS === 'android';

const ApprovalScreenContainer = () => {
  const { currentAccount } = useCurrentAccount();
  const [isSearching, setIsSearching] = useState(false);
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { setNavigationOptions } = useSafeSetNavigationOptions();
  const { filterType, skAssets, skContract, setSearchKw, setFilterType } =
    useApprovalsPage();
  const searchKw = filterType === 'contract' ? skContract : skAssets;

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
        activeColor={colors2024['brand-default']}
        inactiveColor={colors2024['neutral-secondary']}
        labelStyle={styles.label}
      />
    ),
    [colors2024, renderTabItem, styles.indicator, styles.label, styles.tabBar],
  );

  const getHeaderTitle = React.useCallback(() => {
    return (
      <HeaderCenter
        textTitle={
          currentAccount?.address
            ? currentAccount?.aliasName ||
              ellipsisAddress(currentAccount.address)
            : 'Approvals'
        }
        type={filterType}
        inputValue={searchKw}
        inputOnChange={setSearchKw}
        isSearching={isSearching}
      />
    );
  }, [
    currentAccount?.address,
    currentAccount?.aliasName,
    filterType,
    isSearching,
    searchKw,
    setSearchKw,
  ]);

  const getHeaderRight = React.useCallback(() => {
    return (
      <HeaderRight
        isSearching={isSearching}
        onTap={() => {
          if (isSearching) {
            setSearchKw('');
          }
          setIsSearching(pre => !pre);
        }}
      />
    );
  }, [isSearching, setSearchKw]);

  React.useEffect(() => {
    setNavigationOptions({
      headerTitle: getHeaderTitle,
      headerTitleAlign: isSearching ? 'left' : 'center',
      headerRight: getHeaderRight,
    });
  }, [
    setNavigationOptions,
    getHeaderTitle,
    currentAccount?.aliasName,
    isSearching,
    getHeaderRight,
  ]);

  if (!currentAccount?.address) {
    return null;
  }

  return (
    <Tabs.Container
      {...(IS_IOS && {
        // leave horizontal space to make swipable-to-back area larger
        width: Dimensions.get('window').width - IOS_SWIPABLE_LEFT_OFFSET * 2,
      })}
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

const IOS_SWIPABLE_LEFT_OFFSET = !IS_IOS ? 0 : 2;

export default function ApprovalsScreen() {
  const { styles } = useTheme2024({ getStyle });

  const approvalsPageCtx = useApprovalsPageOnTop({ isTestnet: false });

  const { loadApprovals } = approvalsPageCtx;

  useEffect(() => {
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

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  root: {
    // backgroundColor: colors2024['neutral-bg-2'],
  },
  verticalContainer: {
    flex: 1,
    alignItems: 'center',
    position: 'relative',
  },
  title: {
    color: colors2024['neutral-title-1'],
    fontWeight: '800',
    fontSize: 20,
    fontFamily: 'SF Pro Rounded',
    lineHeight: 24,
  },
  tabContainer: {
    // backgroundColor: colors2024['neutral-bg-2'],
  },
  tabHeaderContainer: {
    shadowColor: 'transparent',
    borderTopWidth: 0,
    borderColor: colors2024['neutral-line'],
  },
  tabBar: {
    height: ApprovalsLayouts.tabbarHeight,
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
    color: colors2024['neutral-body'],
    marginTop: 16,
  },
}));
