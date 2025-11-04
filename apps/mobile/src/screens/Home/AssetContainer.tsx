import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { createGetStyles2024 } from '@/utils/styles';
import { useQueryProjects } from './hooks';
import {
  ASSETS_ITEM_HEIGHT_NEW,
  ASSETS_SECTION_HEADER,
} from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';

import { HomeTopArea } from './components/HomeTopArea';
import { useTranslation } from 'react-i18next';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { ChainListItem } from '@/components2024/SelectChainWithDistribute';
import { Tabs } from 'react-native-collapsible-tab-view';
import { useCurve } from '@/hooks/useCurve';
import useCurrentBalance from '@/hooks/useCurrentBalance';
import { Account } from '@/core/services/preference';
import { useGlobalStatus } from '@/hooks/useGlobalStatus';
import { NetWorkError } from '@/components2024/GlobalWarning/NetWorkError';
import { CurveDayType } from '@/utils/curveDayType';
import { PortfolioList } from './PortfolioList';
import { TokenList } from './TokenList';
import { NFTList } from './NFTList';
import { DynamicCustomMaterialTabBar } from './components/Tabs/CustomTabBar';
import CustomLabel from './components/Tabs/CustomLabel';
import { ChainSelector } from './components/AssetRenderItems/SectionHeaders';

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
  onRefresh(): void;
  onUpdateIsDecrease?: (isDecrease: boolean) => void;
  onReachTopStatusChange?: (status: boolean) => void;
  account: Account;
}
const FOOTER_HEIGHT = 56;

export const AssetContainer: React.FC<Props> = ({
  onRefresh,
  onUpdateIsDecrease,
  onReachTopStatusChange,
  account: currentAccount,
}) => {
  const { styles, isLight, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();

  const chainSelectModalRef = useRef<
    ReturnType<typeof createGlobalBottomSheetModal2024> | undefined
  >();

  const [selectChainItem, setSelectChainItem] = useState<
    ChainListItem | undefined
  >();
  const { isDisConnect } = useGlobalStatus();

  const {
    refreshPositions,
    loadingToken,
    loadingNft,
    loadingPortfolio,
    chainsInfo,
  } = useQueryProjects(currentAccount?.address?.toLowerCase());

  const handleOnChainClick = useCallback(
    (clear: boolean) => {
      if (clear) {
        setSelectChainItem(undefined);
        return;
      }

      if (chainSelectModalRef.current) {
        removeGlobalBottomSheetModal2024(chainSelectModalRef.current);
        chainSelectModalRef.current = undefined;
      }
      chainSelectModalRef.current = createGlobalBottomSheetModal2024({
        name: MODAL_NAMES.SELECT_CHAIN_WITH_DISTRIBUTE,
        value: selectChainItem,
        bottomSheetModalProps: {
          enableContentPanningGesture: true,
          enablePanDownToClose: true,
          rootViewType: 'View',
          handleStyle: {
            backgroundColor: isLight
              ? colors2024['neutral-bg-0']
              : colors2024['neutral-bg-1'],
          },
        },
        chainList: chainsInfo.chainAssets,
        titleText: t('page.receiveAddressList.selectChainTitle'),
        onChange: (v: ChainListItem) => {
          setSelectChainItem(v);
          if (chainSelectModalRef.current) {
            removeGlobalBottomSheetModal2024(chainSelectModalRef.current);
            chainSelectModalRef.current = undefined;
          }
        },
        onClose: () => {
          if (chainSelectModalRef.current) {
            removeGlobalBottomSheetModal2024(chainSelectModalRef.current);
            chainSelectModalRef.current = undefined;
          }
        },
      });
    },
    [chainsInfo.chainAssets, colors2024, isLight, selectChainItem, t],
  );

  const { balance, balanceLoading, evmBalance } = useCurrentBalance(
    currentAccount?.address,
    {
      update: true,
      noNeedBalance: false,
    },
  );
  const {
    result: curveData,
    isLoading: isLoadingCurve,
    refresh: refreshCurve,
    hasNoData: hasNoCurveData,
  } = useCurve(
    currentAccount?.address,
    0,
    evmBalance,
    CurveDayType.DAY,
    balance,
  );

  const handleRefresh = useCallback(
    async (ignoreLoading?: boolean) => {
      onRefresh?.();
      refreshCurve(ignoreLoading);
      refreshPositions(true);
    },
    [onRefresh, refreshCurve, refreshPositions],
  );

  const renderHeader = useCallback(() => {
    return (
      <View
      // style={{
      //   // height:
      //     // HEADER_TOP_AREA_HEIGHT +
      //     // ASSETS_SECTION_HEADER +
      //     // SPACE_BETWEEN_HEADER_AND_CHART +
      //     // ASSETS_SECTION_HEADER +
      //     // (isDisConnect ? ALERT_HEIGHT : 0),
      // }}
      >
        <HomeTopArea
          onUpdateIsDecrease={onUpdateIsDecrease}
          curveData={curveData}
          isLoadingCurve={isLoadingCurve || (balanceLoading && !evmBalance)}
          isDisConnect={isDisConnect}
          onRefresh={() => handleRefresh(true)}
        />
        {/* <View style={{ height: SPACE_BETWEEN_HEADER_AND_CHART }} /> */}
      </View>
    );
  }, [
    evmBalance,
    balanceLoading,
    curveData,
    handleRefresh,
    isDisConnect,
    isLoadingCurve,
    onUpdateIsDecrease,
  ]);

  const hasNotAssets = useMemo(() => {
    return (
      chainsInfo.chainLength === 0 &&
      !loadingPortfolio &&
      !loadingToken &&
      !loadingNft
    );
  }, [chainsInfo.chainLength, loadingNft, loadingPortfolio, loadingToken]);

  const errorNotAssets = useMemo(() => {
    return isDisConnect && hasNotAssets && hasNoCurveData;
  }, [hasNoCurveData, hasNotAssets, isDisConnect]);

  const renderTabBar = React.useCallback(
    (_props: any) => (
      <DynamicCustomMaterialTabBar
        materialTabBarProps={{
          ..._props,
          tabStyle: styles.tabBar,
        }}
        containerStyle={styles.tabsBarContainer}
        indicatorStyle={styles.indicator}
        externalContent={
          <ChainSelector
            top3Chains={chainsInfo.chainAssets
              .map(item => item.chain)
              .slice(0, 3)}
            onChainClick={handleOnChainClick}
            chainServerId={selectChainItem?.chain}
          />
        }
      />
    ),
    [
      chainsInfo.chainAssets,
      handleOnChainClick,
      selectChainItem?.chain,
      styles.indicator,
      styles.tabBar,
      styles.tabsBarContainer,
    ],
  );

  const renderLabel = useCallback(
    (name: string) =>
      // eslint-disable-next-line react/no-unstable-nested-components
      ({ index, indexDecimal }) =>
        <CustomLabel index={index} indexDecimal={indexDecimal} text={name} />,
    [],
  );

  if (!currentAccount?.address) {
    return null;
  }
  if (errorNotAssets) {
    return (
      <NetWorkError
        hasError={isDisConnect}
        onRefresh={() => {
          handleRefresh(true);
        }}
        style={styles.netWorkError}
      />
    );
  }
  return (
    <Tabs.Container
      containerStyle={styles.container}
      // minHeaderHeight={ASSETS_SECTION_HEADER + ASSETS_SECTION_HEADER}
      headerHeight={0}
      // renderTabBar={renderTabBar}
      tabBarHeight={0}
      renderTabBar={renderTabBar}
      renderHeader={renderHeader}
      headerContainerStyle={styles.tabBarWrap}>
      <Tabs.Tab label={renderLabel('Token')} name="tokens">
        <TokenList
          chain={selectChainItem?.chain}
          account={currentAccount}
          onRefresh={handleRefresh}
          onReachTopStatusChange={onReachTopStatusChange}
        />
      </Tabs.Tab>
      <Tabs.Tab label={renderLabel('DeFi')} name="defi">
        <PortfolioList
          chain={selectChainItem?.chain}
          onRefresh={handleRefresh}
          onReachTopStatusChange={onReachTopStatusChange}
          account={currentAccount}
        />
      </Tabs.Tab>
      <Tabs.Tab label={renderLabel('NFT')} name="nft">
        <NFTList
          chain={selectChainItem?.chain}
          account={currentAccount}
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
    backgroundColor: ctx.colors2024['neutral-bg-3'],
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
  tabBar: {
    height: 32,
    width: 'auto',
    flexShrink: 0,
    flex: 0,
    paddingHorizontal: 0,
    // marginRight: 20,
  },
  tabsBarContainer: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 16,
    position: 'relative',
    height: 32,
    overflow: 'hidden',
  },
  indicator: {
    height: 0,
  },
}));
