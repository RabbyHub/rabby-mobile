import React, { useCallback, useMemo } from 'react';
import { Dimensions, View } from 'react-native';
import { createGetStyles2024 } from '@/utils/styles';
import {
  ASSETS_ITEM_HEIGHT_NEW,
  ASSETS_SECTION_HEADER,
} from '@/constant/layout';
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
  useSingleHomeAccount,
  useSingleHomeHasNoData,
  useSingleHomeNoAssetsValueOnChain,
} from './hooks/singleHome';
import { apisAddressBalance } from '@/hooks/useCurrentBalance';
import { ReceiveOnNoAssets } from './components/ReceiveOnNoAssets';
import { isDirectlySignableAccount } from '@/core/apis/account';
import { useAccountHomeShowReceiveTip } from '../Address/components/MultiAssets/hooks';

const ScreenWidth = Dimensions.get('window').width;
export const icons = {
  unfoldDark: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_unfold_dark.png'),
  unfoldLight: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_unfold.png'),
  foldDark: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_fold_dark.png'),
  foldLight: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_fold.png'),
  pinDark: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_token_favorite_dark.png'),
  pinLight: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_token_favorite.png'),
  unpinDark: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_token_unfavorite_dark.png'),
  unpinLight: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_token_unfavorite.png'),
};

interface Props {
  onReachTopStatusChange?: (status: boolean) => void;
}
const FOOTER_HEIGHT = 56;

const renderHeader = () => null;

export const AssetContainer: React.FC<Props> = ({ onReachTopStatusChange }) => {
  const { styles } = useTheme2024({ getStyle: getStyles });

  const { currentAccount } = useSingleHomeAccount();
  const currentAddress = currentAccount?.address ?? undefined;

  const { isDisConnect } = useGlobalStatus();

  const { chainLength } = useAddrChainLength(currentAddress);

  useRendererDetect({ name: 'Home::AssetContainer' });

  const { hasNoData: hasNoCurveData } = useSingleHomeHasNoData();

  const handleRefresh = useCallback(async () => {
    if (!currentAddress) return;
    apisAddressBalance.triggerUpdate({
      address: currentAddress,
      force: true,
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

  if (errorNotAssets) {
    return (
      <NetWorkError
        hasError={isDisConnect}
        onRefresh={handleRefresh}
        style={styles.netWorkError}
      />
    );
  }

  if (!currentAccount) return null;
  if (accountToShowReceiveTip) {
    return (
      <ReceiveOnNoAssets.BgWrapper isForSingle>
        <ReceiveOnNoAssets account={accountToShowReceiveTip} isForSingle />
      </ReceiveOnNoAssets.BgWrapper>
    );
  }

  return (
    <Tabs.Container
      containerStyle={styles.container}
      headerHeight={0}
      renderHeader={renderHeader}
      tabBarHeight={32}
      renderTabBar={DynamicCustomMaterialTabBar}
      headerContainerStyle={styles.tabBarWrap}>
      <Tabs.Tab label={renderLabel('Token')} name="tokens">
        <TokenList
          noAssetsOnAnyChain={noAssetsOnAnyChain}
          onRefresh={handleRefresh}
          onReachTopStatusChange={onReachTopStatusChange}
        />
      </Tabs.Tab>
      <Tabs.Tab label={renderLabel('DeFi')} name="defi">
        <PortfolioList
          onRefresh={handleRefresh}
          onReachTopStatusChange={onReachTopStatusChange}
        />
      </Tabs.Tab>
      <Tabs.Tab label={renderLabel('NFT')} name="nft">
        <NFTList
          onRefresh={handleRefresh}
          onReachTopStatusChange={onReachTopStatusChange}
        />
      </Tabs.Tab>
    </Tabs.Container>
  );
};

const getStyles = createGetStyles2024(ctx => ({
  container: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: ASSETS_SECTION_HEADER,
    // paddingHorizontal: 16,
    zIndex: 1,
  },
  bgContainer: {
    // backgroundColor: ctx.colors2024['neutral-bg-1'],
  },
  rowWrap: {
    paddingHorizontal: 16,
  },
  removeLeft: {
    marginLeft: 0,
  },
  renderItemWrapper: {
    backgroundColor: ctx.colors2024['neutral-bg-1'],
    borderRadius: 16,
    height: ASSETS_ITEM_HEIGHT_NEW,
    paddingLeft: 12,
    width: '100%',
  },
  bg2: {
    backgroundColor: ctx.colors2024['neutral-bg-2'],
  },
  sectionHeader: {
    // backgroundColor: ctx.colors2024['neutral-bg-gray'],
    // paddingRight: 8,
    height: ASSETS_SECTION_HEADER,
  },
  buttonHeader: {
    backgroundColor: ctx.colors2024['neutral-bg-1'],
  },
  assetHeader: {
    backgroundColor: ctx.colors2024['neutral-bg-gray'],
    height: ASSETS_SECTION_HEADER,
    // paddingBottom: 8,
    paddingLeft: 12 + 16,
    paddingRight: 16,
    width: '100%',
  },
  hidden: {
    display: 'none',
  },
  symbol: {
    fontSize: 16,
    height: ASSETS_SECTION_HEADER,
    lineHeight: ASSETS_SECTION_HEADER,
    paddingLeft: 9 + 16,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: ctx.colors2024['neutral-secondary'],
    backgroundColor: ctx.colors2024['neutral-bg-gray'],
  },
  footer: {
    height: FOOTER_HEIGHT,
  },
  tabBarWrap: {
    backgroundColor: ctx.isLight
      ? ctx.colors2024['neutral-bg-0']
      : ctx.colors2024['neutral-bg-1'],
    shadowColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
  globalWarning: {
    marginHorizontal: 16,
    marginBottom: 13,
  },
  netWorkError: {
    height: '100%',
    marginTop: -50,
    backgroundColor: ctx.colors2024['neutral-bg-0'],
  },
  bg: {
    position: 'absolute',
    left: 0,
    width: ScreenWidth,
    height: 32,
    zIndex: -100,
  },
}));
