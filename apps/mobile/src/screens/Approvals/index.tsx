import React from 'react';
import { useTranslation } from 'react-i18next';
import { View, Platform } from 'react-native';
import {
  Tabs,
  MaterialTabBar,
  MaterialTabItem,
} from 'react-native-collapsible-tab-view';

import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { ApprovalsBottomArea } from './components/Layout';
import { ApprovalsLayouts } from './layout';
import ListByAssets from './ListByAssets';
import ListByContracts from './ListByContracts';
import EIP7702RevokeList from './EIP7702Revoke';
import {
  ApprovalsPageContext,
  FILTER_TYPES,
  useApprovalsPage,
  useApprovalsPageOnTop,
} from './useApprovalsPage';
import {
  EIP7702ApprovalsProvider,
  useEIP7702Approvals,
} from './useEIP7702Approvals';
import BottomSheetApprovalContract from './components/BottomSheetApprovalContract';
import BottomSheetApprovalAsset from './components/BottomSheetApprovalAsset';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { HeaderRight } from './components/Headers/HeaderRight';
import { HeaderCenter } from './components/Headers/HeaderCenter';
import { ellipsisAddress } from '@/utils/address';
import { CustomMaterialTabBar } from '@/components2024/CustomTabs/CustomMaterialTabBar';
import { Account } from '@/core/services/preference';
import { useRoute } from '@react-navigation/native';
import { GetNestedScreenRouteProp } from '@/navigation-type';
const isAndroid = Platform.OS === 'android';

const ApprovalScreenContainer: React.FC<{
  account: Account;
}> = ({ account: currentAccount }) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { setNavigationOptions } = useSafeSetNavigationOptions();
  const { filterType, setFilterType, searchKw, setSearchKw } =
    useApprovalsPage();
  const { totalCount: eip7702TotalCount } = useEIP7702Approvals();

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
      <CustomMaterialTabBar
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

  const [isSearching, setIsSearching] = React.useState(false);
  const eip7702Label = React.useMemo(() => {
    if (!eip7702TotalCount) {
      return 'EIP-7702';
    }
    return `EIP-7702 (${eip7702TotalCount})`;
  }, [eip7702TotalCount]);

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
        currentAccount={currentAccount}
      />
    );
  }, [currentAccount, filterType, isSearching, searchKw, setSearchKw]);

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
      headerRight: getHeaderRight,
      headerStyle: {
        backgroundColor: colors2024['neutral-bg-1'],
      },
    });
  }, [
    setNavigationOptions,
    getHeaderTitle,
    currentAccount?.aliasName,
    colors2024,
    getHeaderRight,
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
      // pagerProps={{ scrollEnabled: false }}
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

      <Tabs.Tab label={eip7702Label} name={FILTER_TYPES.EIP7702}>
        <EIP7702RevokeList />
      </Tabs.Tab>
    </Tabs.Container>
  );
};

export default function ApprovalsScreen() {
  const { styles } = useTheme2024({ getStyle });
  const route =
    useRoute<
      GetNestedScreenRouteProp<'TransactionNavigatorParamList', 'Approvals'>
    >();

  const account = route.params.account;

  const approvalsPageCtx = useApprovalsPageOnTop({ isTestnet: false, account });

  const { loadApprovals } = approvalsPageCtx;

  React.useEffect(() => {
    loadApprovals();
  }, [loadApprovals]);

  return (
    <NormalScreenContainer2024 overwriteStyle={styles.root}>
      <ApprovalsPageContext.Provider value={approvalsPageCtx}>
        <EIP7702ApprovalsProvider
          account={account}
          isActive={approvalsPageCtx.filterType === FILTER_TYPES.EIP7702}
          prefetch
          searchKeyword={approvalsPageCtx.searchKw}>
          <View style={styles.verticalContainer}>
            <ApprovalScreenContainer account={account} />

            <BottomSheetApprovalContract account={account} />
            <BottomSheetApprovalAsset account={account} />

            <ApprovalsBottomArea account={account} />
          </View>
        </EIP7702ApprovalsProvider>
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
