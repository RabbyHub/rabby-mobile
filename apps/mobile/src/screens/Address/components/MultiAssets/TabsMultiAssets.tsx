import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Dimensions } from 'react-native';
import { createGetStyles2024 } from '@/utils/styles';
import {
  ASSETS_ITEM_HEIGHT_NEW,
  ASSETS_SECTION_HEADER,
} from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';

import { useTranslation } from 'react-i18next';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { ChainListItem } from '@/components2024/SelectChainWithDistribute';
import { useGlobalStatus } from '@/hooks/useGlobalStatus';
import { NetWorkError } from '@/components2024/GlobalWarning/NetWorkError';
import { TokenList } from './TokenList';
import { ProtocolList } from './ProtocolList';
import { NFTList } from './NFTList';
import { useChainInfo } from '@/screens/Home/useChainInfo';
import { Tabs } from 'react-native-collapsible-tab-view';
import { TabsTopHeader } from '@/screens/Home/components/OverviewTopHeader';
import { useMulti24hBalance } from '@/hooks/use24hBalance';
import CustomLabel from '@/screens/Home/components/Tabs/CustomLabel';
import { HomeCustomMaterialTabBar } from '@/screens/Home/components/CustomTabBar';
import { ChainSelector } from '@/screens/Home/components/AssetRenderItems/SectionHeaders';

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
  onRefresh(): void;
  onIndexChange(index: number): void;
  overViewContent: React.ReactNode;
  data: ReturnType<typeof useMulti24hBalance>['combineData'];
  loading: boolean;
  tabIndex: number;
}
const FOOTER_HEIGHT = 56;

export const TabsMultiAssets: React.FC<Props> = ({
  onRefresh,
  onIndexChange,
  data,
  loading,
  overViewContent,
  tabIndex,
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

  const { chainsInfo, updateToken, updatePortfolio, updateNft } =
    useChainInfo();
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
    (_props: any) => (
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

  const handleRefresh = useCallback(async () => {
    onRefresh?.();
  }, [onRefresh]);

  const errorNotAssets = useMemo(() => {
    return isDisConnect;
  }, [isDisConnect]);
  const renderHeader = useCallback(() => {
    return (
      <TabsTopHeader
        data={data}
        loading={loading}
        showNetWorth={tabIndex !== 0}
      />
    );
  }, [data, loading, tabIndex]);

  if (errorNotAssets) {
    return (
      <NetWorkError
        hasError={isDisConnect}
        onRefresh={() => {
          handleRefresh();
        }}
        style={styles.netWorkError}
      />
    );
  }
  return (
    <Tabs.Container
      onIndexChange={onIndexChange}
      renderHeader={renderHeader}
      renderTabBar={renderTabBar}
      headerHeight={0}
      minHeaderHeight={0}
      tabBarHeight={0}
      containerStyle={styles.container}
      headerContainerStyle={styles.headerContainer}>
      <Tabs.Tab name="overview" label={() => null}>
        {overViewContent}
      </Tabs.Tab>

      <Tabs.Tab name="token" label={renderLabel('Token')}>
        <TokenList
          chain={selectChainItem?.chain}
          onRefresh={handleRefresh}
          updateToken={updateToken}
        />
      </Tabs.Tab>
      <Tabs.Tab name="defi" label={renderLabel('Defi')}>
        <ProtocolList
          chain={selectChainItem?.chain}
          onRefresh={handleRefresh}
          updatePortfolio={updatePortfolio}
        />
      </Tabs.Tab>
      <Tabs.Tab name="nft" label={renderLabel('NFT')}>
        <NFTList
          chain={selectChainItem?.chain}
          onRefresh={handleRefresh}
          updateNft={updateNft}
        />
      </Tabs.Tab>
    </Tabs.Container>
  );
};

const getStyles = createGetStyles2024(ctx => ({
  container: {
    flex: 1,
    marginTop: 64,
  },
  headerContainer: {
    backgroundColor: 'transparent',
    shadowColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
    // paddingTop: 64,
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
  label: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    textTransform: 'none',
  },
  tabsBarContainer: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 16,
    position: 'relative',
    height: 36,
    paddingBottom: 4,
    overflow: 'hidden',
  },
  indicator: {
    height: 3,
  },
  bg: {
    position: 'absolute',
    left: 0,
    width: ScreenWidth,
    height: 32,
    zIndex: -100,
  },
  segmentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  tabsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
}));
