import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { View } from 'react-native';
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
import { apisAddrChainStatics, useAddrChainLength } from './useChainInfo';
import { useRendererDetect } from '@/components/Perf/PerfDetector';
import {
  apisSingleHome,
  useSingleHomeAccount,
  useSingleHomeChain,
  useSingleHomeHasNoData,
} from './hooks/singleHome';
import {
  apisAddressBalance,
  useAddressBalance,
} from '@/hooks/useCurrentBalance';
import { ReceiveOnNoAssets } from './components/ReceiveOnNoAssets';
import { useCustomTestnetStore } from '@/store/customTestnet';
import { RenderActivityBoundary } from '@/hooks/storeActivity/RenderActivityBoundary';
import { useActivityStore } from '@/hooks/storeActivity/useActivityStore';
import {
  useRegressionScenario,
  useRegressionScenarioAssertion,
  useRegressionScenarioComponentAction,
} from '@/devtools/regressionScenarios/react';
import {
  scheduleSingleAddressAssetDataWarmup,
  singleAddressAssetDataCoordinator,
  type SingleAddressAssetDataTab,
} from './singleAddressAssetDataWarmup';
import { ItemLoader } from './components/Skeleton';
import {
  resolveSingleAddressAssetViewState,
  shouldResolveSingleAddressNoAssets,
  useSingleAddressNoAssetsDecision,
} from './singleAddressNoAssetsDecision';

const renderHeader = () => null;
const NO_ASSETS_DECISION_SKELETONS = ['first', 'second', 'third'];

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
    <RenderActivityBoundary
      active={isScreenFocused && focusedTab === name}
      label={`single-address-${name}`}>
      {children}
    </RenderActivityBoundary>
  );
};

export const AssetContainer = () => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const tabsRef = useRef<CollapsibleRef<string>>(null);
  const regressionScenario = useRegressionScenario<'SingleAddressHome'>();

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
  const { selectedChain } = useSingleHomeChain();

  useEffect(() => {
    if (currentAddress) {
      apisAddrChainStatics.syncAddress(currentAddress);
    }
  }, [currentAddress]);

  useEffect(() => {
    if (!currentAddress) {
      return;
    }

    const input = {
      address: currentAddress,
      chainServerId: selectedChain,
    };
    singleAddressAssetDataCoordinator.prepare(input);
    const warmupHandle = scheduleSingleAddressAssetDataWarmup(input);

    return () => {
      if (
        warmupHandle &&
        typeof warmupHandle === 'object' &&
        'cancel' in warmupHandle
      ) {
        warmupHandle.cancel();
      }
    };
  }, [currentAddress, selectedChain]);

  const { isDisConnect } = useGlobalStatus();

  const { chainLength } = useAddrChainLength(currentAddress);
  const { evmBalance } = useAddressBalance(currentAddress);

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
  const customTestnetCount = useActivityStore(
    useCustomTestnetStore,
    state => Object.keys(state.customTestnet).length,
    Object.is,
    { storeLabel: 'single-address-custom-testnet' },
  );
  const knownEvmBalance =
    evmBalance ??
    (typeof currentAccount?.evmBalance === 'number'
      ? currentAccount.evmBalance
      : null);
  const shouldResolveNoAssets = shouldResolveSingleAddressNoAssets({
    account: currentAccount,
    chainLength,
    customTestnetCount,
    evmBalance: knownEvmBalance,
  });
  const noAssetsDecision = useSingleAddressNoAssetsDecision({
    account: currentAccount,
    enabled: shouldResolveNoAssets,
  });
  const assetViewState = resolveSingleAddressAssetViewState({
    hasCurrentAccount: !!currentAccount,
    hasNetworkError: errorNotAssets,
    shouldResolveNoAssets,
    decision: noAssetsDecision,
  });

  useRegressionScenarioAssertion(
    'single-address-asset-view-settled',
    regressionScenario.active &&
      regressionScenario.scenario === 'single-address' &&
      (assetViewState === 'assets' || assetViewState === 'receive')
      ? { viewState: assetViewState }
      : null,
  );

  if (assetViewState === 'none') {
    return null;
  }

  if (assetViewState === 'network-error') {
    return (
      <NetWorkError
        hasError={isDisConnect}
        onRefresh={handleRefresh}
        style={styles.netWorkError}
      />
    );
  }

  if (assetViewState === 'pending') {
    return (
      <View style={styles.noAssetsDecisionPending}>
        {NO_ASSETS_DECISION_SKELETONS.map(key => (
          <ItemLoader key={key} style={styles.noAssetsDecisionSkeleton} />
        ))}
      </View>
    );
  }

  if (assetViewState === 'receive') {
    return <ReceiveOnNoAssets account={noAssetsDecision.account} />;
  }

  return (
    <Tabs.Container
      ref={tabsRef}
      containerStyle={styles.container}
      headerHeight={0}
      lazy
      renderHeader={renderHeader}
      tabBarHeight={32}
      onTabChange={({ tabName }) => {
        setTimeout(() => {
          apisSingleHome.setFoldChart(true);
          // 延迟部分时间，避免tab下面layout计算和顶部高度变化重叠
        }, 150);

        if (currentAddress && (tabName === 'defi' || tabName === 'nft')) {
          singleAddressAssetDataCoordinator
            .ensure(tabName as SingleAddressAssetDataTab, {
              address: currentAddress,
              chainServerId: selectedChain,
            })
            .catch(error => {
              console.error(
                `[SingleAddressAssetData] ${tabName} activation failed`,
                error,
              );
            });
        }
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
  noAssetsDecisionPending: {
    flex: 1,
    width: '100%',
    gap: 8,
    paddingTop: 40,
    paddingHorizontal: 16,
  },
  noAssetsDecisionSkeleton: {
    marginLeft: 0,
  },
  netWorkError: {
    height: '100%',
    marginTop: -50,
    backgroundColor: ctx.colors2024['neutral-bg-0'],
  },
}));
