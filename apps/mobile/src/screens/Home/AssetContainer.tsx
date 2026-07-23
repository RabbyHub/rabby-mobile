import React, { useCallback, useMemo } from 'react';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';

import { Tabs } from 'react-native-collapsible-tab-view';
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
import { apiCustomTestnet } from '@/core/apis';
import { apisAddressBalance } from '@/hooks/useCurrentBalance';
import { ReceiveOnNoAssets } from './components/ReceiveOnNoAssets';
import { useAccountHomeShowReceiveTip } from '../Address/components/MultiAssets/hooks';

const renderHeader = () => null;

export const AssetContainer = () => {
  const { styles } = useTheme2024({ getStyle: getStyles });

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
  const customTestnetCount = useMemo(
    () => apiCustomTestnet.getCustomTestnetList().length,
    [],
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
      containerStyle={styles.container}
      headerHeight={0}
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
        <TokenList
          noAssetsOnAnyChain={noAssetsOnAnyChain}
          onForeground={handleForegroundRefreshBalance}
          onRefresh={handleRefresh}
        />
      </Tabs.Tab>
      <Tabs.Tab label={renderLabel('DeFi')} name="defi">
        <PortfolioList
          onForeground={handleForegroundRefreshBalance}
          onRefresh={handleRefresh}
        />
      </Tabs.Tab>
      <Tabs.Tab label={renderLabel('NFT')} name="nft">
        <NFTList
          onForeground={handleForegroundRefreshBalance}
          onRefresh={handleRefresh}
        />
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
