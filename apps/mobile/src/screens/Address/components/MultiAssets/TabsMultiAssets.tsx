import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';

import { useTranslation } from 'react-i18next';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { ChainListItem } from '@/components2024/SelectChainWithDistribute';
import { TokenList } from './TokenList';
import { ProtocolList } from './ProtocolList';
import { useChainInfo } from '@/screens/Home/useChainInfo';
import { Tabs } from 'react-native-collapsible-tab-view';
import {
  HeaderHeight,
  TabsTopHeader,
} from '@/screens/Home/components/OverviewTopHeader';
import { useMulti24hBalance } from '@/hooks/use24hBalance';
import CustomLabel from '@/screens/Home/components/Tabs/CustomLabel';
import { HomeCustomMaterialTabBar } from '@/screens/Home/components/CustomTabBar';
import { ChainSelector } from '@/screens/Home/components/AssetRenderItems/SectionHeaders';
import { useAssets } from '@/screens/Search/useAssets';
import { isTabsSwiping, useAccountInfo } from './hooks';
import { NFTList } from './NFTList';
import { matomoRequestEvent } from '@/utils/analytics';

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
export const TAB_HEADER_FULL_HEIGHT = 94;
export const TAB_HEADER_MIN_HEIGHT = 44;

interface Props {
  onIndexChange(index: number): void;
  overViewContent: React.ReactNode;
  data: ReturnType<typeof useMulti24hBalance>['combineData'];
  loading: boolean;
  tabIndex: number;
}

export const enum TabName {
  overview = 'overview',
  token = 'token',
  defi = 'defi',
  nft = 'nft',
}

export const TabsMultiAssets: React.FC<Props> = ({
  onIndexChange,
  data,
  loading,
  overViewContent,
  tabIndex,
}) => {
  const { t } = useTranslation();
  const { styles, isLight, colors2024 } = useTheme2024({ getStyle: getStyles });

  const chainSelectModalRef = useRef<
    ReturnType<typeof createGlobalBottomSheetModal2024> | undefined
  >();
  const [selectChainItem, setSelectChainItem] = useState<
    ChainListItem | undefined
  >();

  const { chainsInfo, updateToken, updatePortfolio, updateNft } =
    useChainInfo();
  const { top10Addresses } = useAccountInfo();
  const { getCacheTop10Assets } = useAssets({ hideCombined: false });

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

  const renderTabBar = React.useCallback(
    (
      _props: React.ComponentProps<
        typeof HomeCustomMaterialTabBar
      >['materialTabBarProps'],
    ) => (
      <HomeCustomMaterialTabBar
        materialTabBarProps={{
          ..._props,
        }}
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
    [chainsInfo.chainAssets, handleOnChainClick, selectChainItem?.chain],
  );

  const renderLabel = useCallback(
    (name: string) =>
      // eslint-disable-next-line react/no-unstable-nested-components
      ({ index, indexDecimal }) =>
        <CustomLabel index={index} indexDecimal={indexDecimal} text={name} />,
    [],
  );

  const renderHeader = useCallback(() => {
    return (
      <TabsTopHeader
        data={data}
        loading={loading}
        showNetWorth={tabIndex !== 0}
      />
    );
  }, [data, loading, tabIndex]);

  useEffect(() => {
    const id = setTimeout(() => {
      getCacheTop10Assets({
        realTimeAddresses: top10Addresses,
        core: true,
        maxTokenLength: 500,
        maxDefiLength: 20,
        maxNFTLength: 200,
      });
    }, 0);
    return () => {
      id && clearTimeout(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const handleTabChange = useCallback(
    ({ prevIndex, index }: { prevIndex: number; index: number }) => {
      // 在前两个tab之间切换
      const isSwapBetweenOverviewAndOtherTabs =
        (prevIndex === 0 && index === 1) || (prevIndex === 1 && index === 0);
      if (isSwapBetweenOverviewAndOtherTabs) {
        matomoRequestEvent({
          category: 'HomeTab',
          action: 'HomeTab_Switch',
        });
      }
    },
    [],
  );

  return (
    <Tabs.Container
      onIndexChange={onIndexChange}
      onTabChange={handleTabChange}
      renderHeader={renderHeader}
      renderTabBar={renderTabBar}
      headerHeight={HeaderHeight}
      minHeaderHeight={HeaderHeight}
      tabBarHeight={74}
      lazy
      pagerProps={{
        onPageScrollStateChanged: event => {
          isTabsSwiping.value = event?.nativeEvent?.pageScrollState !== 'idle';
        },
      }}
      containerStyle={styles.container}
      headerContainerStyle={styles.headerContainer}>
      <Tabs.Tab
        key={TabName.overview}
        name={TabName.overview}
        label={() => null}>
        {overViewContent}
      </Tabs.Tab>

      <Tabs.Tab
        key={TabName.token}
        name={TabName.token}
        label={renderLabel('Token')}>
        <TokenList chain={selectChainItem?.chain} updateToken={updateToken} />
      </Tabs.Tab>
      <Tabs.Tab
        key={TabName.defi}
        name={TabName.defi}
        label={renderLabel('DeFi')}>
        <ProtocolList
          chain={selectChainItem?.chain}
          updatePortfolio={updatePortfolio}
        />
      </Tabs.Tab>
      <Tabs.Tab key={TabName.nft} name={TabName.nft} label={renderLabel('NFT')}>
        <NFTList chain={selectChainItem?.chain} updateNft={updateNft} />
      </Tabs.Tab>
    </Tabs.Container>
  );
};

const getStyles = createGetStyles2024(() => ({
  container: {
    flex: 1,
    marginTop: 64,
  },
  headerContainer: {
    backgroundColor: 'transparent',
    shadowColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
}));
