import React, { useCallback, useMemo, useRef, type ReactNode } from 'react';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';

import {
  Tabs,
  useFocusedTab,
  type CollapsibleRef,
} from 'react-native-collapsible-tab-view';
import { useIsFocused } from '@react-navigation/native';
import { useGlobalStatus } from '@/hooks/useGlobalStatus';
import { NetWorkError } from '@/components2024/GlobalWarning/NetWorkError';
import { PortfolioList } from './PortfolioList';
import { TokenList } from './TokenList';
import { NFTList } from './NFTList';
import { DynamicCustomMaterialTabBar } from './components/Tabs/CustomTabBar';
import CustomLabel from './components/Tabs/CustomLabel';
import { useAddrChainLength } from './useChainInfo';
import { useRendererDetect } from '@/components/Perf/PerfDetector';
import {
  apisSingleHome,
  useSingleHomeAccount,
  useSingleHomeHasNoData,
} from './hooks/singleHome';
import { apisAddressBalance } from '@/hooks/useCurrentBalance';
import { ReceiveOnNoAssets } from './components/ReceiveOnNoAssets';
import { useAccountHomeShowReceiveTip } from '../Address/components/MultiAssets/hooks';
import { useCustomTestnetStore } from '@/store/customTestnet';
import { StoreActivityBoundary } from '@/hooks/storeActivity/StoreActivityBoundary';
import { useActivityStore } from '@/hooks/storeActivity/useActivityStore';
import { useRegressionScenarioComponentAction } from '@/devtools/regressionScenarios/react';

const renderHeader = () => null;

type SingleAddressTabName = 'tokens' | 'defi' | 'nft';

const SingleAddressTabActivityBoundary = ({
  children,
  name,
}: {
  children: ReactNode;
  name: SingleAddressTabName;
}) => {
  const focusedTab = useFocusedTab();
  const isScreenFocused = useIsFocused();

  return (
    <StoreActivityBoundary
      active={isScreenFocused && focusedTab === name}
      label={`single-address-${name}`}>
      {children}
    </StoreActivityBoundary>
  );
};

export const AssetContainer = () => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const tabsRef = useRef<CollapsibleRef<string>>(null);

  const activateTabForRegression = useCallback(
    async (name: SingleAddressTabName) => {
      tabsRef.current?.jumpToTab(name);
      await new Promise<void>(resolve => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
    },
    [],
  );
  const activateTokensForRegression = useCallback(
    () => activateTabForRegression('tokens'),
    [activateTabForRegression],
  );
  const activateDefiForRegression = useCallback(
    () => activateTabForRegression('defi'),
    [activateTabForRegression],
  );
  const activateNftForRegression = useCallback(
    () => activateTabForRegression('nft'),
    [activateTabForRegression],
  );

  useRegressionScenarioComponentAction(
    'single-address.activate-tokens',
    activateTokensForRegression,
  );
  useRegressionScenarioComponentAction(
    'single-address.activate-defi',
    activateDefiForRegression,
  );
  useRegressionScenarioComponentAction(
    'single-address.activate-nft',
    activateNftForRegression,
  );

  const { currentAccount } = useSingleHomeAccount();
  const currentAddress = currentAccount?.address ?? undefined;

  const { isDisConnect } = useGlobalStatus();

  const { chainLength } = useAddrChainLength(currentAddress);

  useRendererDetect({ name: 'Home::AssetContainer' });

  const { hasNoData: hasNoCurveData } = useSingleHomeHasNoData();

  const handleRefresh = useCallback(async () => {
    if (!currentAddress) {
      return;
    }
    await apisAddressBalance.triggerUpdate({
      address: currentAddress,
      force: true,
      fromScene: 'SingleAddressHome',
    });
  }, [currentAddress]);

  const handleForegroundRefreshBalance = useCallback(() => {
    if (!currentAddress) {
      return;
    }
    apisAddressBalance.triggerUpdate({
      address: currentAddress,
      force: false,
      fromScene: 'SingleAddressHome',
    });
  }, [currentAddress]);

  const noAssetsOnAnyChain = chainLength === 0;

  const errorNotAssets = useMemo(() => {
    return isDisConnect && noAssetsOnAnyChain && hasNoCurveData;
  }, [hasNoCurveData, noAssetsOnAnyChain, isDisConnect]);

  const renderLabel = useCallback(
    (name: string) =>
      // eslint-disable-next-line react/no-unstable-nested-components
      ({ index, indexDecimal }) =>
        <CustomLabel index={index} indexDecimal={indexDecimal} text={name} />,
    [],
  );
  // const { noAssetsValue } = useSingleHomeNoAssetsValueOnChain();
  const { accountToShowReceiveTip } =
    useAccountHomeShowReceiveTip(currentAccount);
  const customTestnetCount = useActivityStore(
    useCustomTestnetStore,
    state => Object.keys(state.customTestnet).length,
    Object.is,
    { storeLabel: 'single-address-custom-testnet' },
  );

  if (!currentAccount) {
    return null;
  }

  if (errorNotAssets) {
    return (
      <NetWorkError
        hasError={isDisConnect}
        onRefresh={handleRefresh}
        style={styles.netWorkError}
      />
    );
  }

  if (accountToShowReceiveTip && customTestnetCount === 0) {
    return <ReceiveOnNoAssets account={accountToShowReceiveTip} />;
  }

  return (
    <Tabs.Container
      ref={tabsRef}
      containerStyle={styles.container}
      headerHeight={0}
      lazy
      renderHeader={renderHeader}
      tabBarHeight={32}
      onTabChange={() => {
        setTimeout(() => {
          apisSingleHome.setFoldChart(true);
          // 延迟部分时间，避免tab下面layout计算和顶部高度变化重叠
        }, 150);
      }}
      renderTabBar={DynamicCustomMaterialTabBar}
      headerContainerStyle={styles.tabBarWrap}>
      <Tabs.Tab label={renderLabel('Token')} name="tokens">
        <SingleAddressTabActivityBoundary name="tokens">
          <TokenList
            noAssetsOnAnyChain={noAssetsOnAnyChain}
            onForeground={handleForegroundRefreshBalance}
            onRefresh={handleRefresh}
          />
        </SingleAddressTabActivityBoundary>
      </Tabs.Tab>
      <Tabs.Tab label={renderLabel('DeFi')} name="defi">
        <SingleAddressTabActivityBoundary name="defi">
          <PortfolioList
            onForeground={handleForegroundRefreshBalance}
            onRefresh={handleRefresh}
          />
        </SingleAddressTabActivityBoundary>
      </Tabs.Tab>
      <Tabs.Tab label={renderLabel('NFT')} name="nft">
        <SingleAddressTabActivityBoundary name="nft">
          <NFTList
            onForeground={handleForegroundRefreshBalance}
            onRefresh={handleRefresh}
          />
        </SingleAddressTabActivityBoundary>
      </Tabs.Tab>
    </Tabs.Container>
  );
};

const getStyles = createGetStyles2024(ctx => ({
  container: {
    flex: 1,
  },
  tabBarWrap: {
    backgroundColor: ctx.isLight
      ? ctx.colors2024['neutral-bg-0']
      : ctx.colors2024['neutral-bg-1'],
    shadowColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
  netWorkError: {
    height: '100%',
    marginTop: -50,
    backgroundColor: ctx.colors2024['neutral-bg-0'],
  },
}));
