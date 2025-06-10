import React, { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { createGetStyles2024 } from '@/utils/styles';
import { useQueryProjects } from './hooks';
import useSortToken from './hooks/useSortTokens';
import { getTotalFoldToken, getAllDefiCount } from './utils/converAssets';
import { ActionItem, CombineToken } from './types';
import {
  ALERT_HEIGHT,
  ASSETS_ITEM_HEIGHT_NEW,
  ASSETS_SECTION_HEADER,
  DEFI_ITEM_HEIGHT,
  HEADER_TOP_AREA_HEIGHT,
} from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';

import { TokenRowSectionHeader } from './components/AssetRenderItems';
import { HomeTopArea } from './components/HomeTopArea';
import { useTranslation } from 'react-i18next';
import {
  AssestAllHeader,
  AsssetKey,
} from './components/AssetRenderItems/SectionHeaders';
import { useAppOrmSyncEvents } from '@/databases/sync/_event';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import throttle from 'lodash/throttle';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { ChainListItem } from '@/components2024/SelectChainWithDistribute';
import { collectionNftList } from './hooks/nft';
import { chunk } from 'lodash';
import { isScamHidenToken } from './utils/collection';
import { AssetList } from './AssetList';
import { Tabs } from 'react-native-collapsible-tab-view';
import { useCurve } from '@/hooks/useCurve';
import useCurrentBalance from '@/hooks/useCurrentBalance';
import { Account } from '@/core/services/preference';
import { PageMainServices, useGlobalStatus } from '@/hooks/useGlobalStatus';

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

const MIN_HEADER_HEIGHT = ASSETS_SECTION_HEADER + ASSETS_SECTION_HEADER;
const SPACE_BETWEEN_HEADER_AND_CHART = 17;
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

  const [firstRowType, setFirstRowType] = useState('');
  const [selectChainItem, setSelectChainItem] = useState<
    ChainListItem | undefined
  >();
  const [foldHideList, setFoldHideList] = useState(true);
  const [foldNft, setFoldNft] = useState(true);
  const [foldDefi, setFoldDefi] = useState(true);
  const [foldScam, setFoldScam] = useState(true);

  const { errorType } = useGlobalStatus(PageMainServices.SingleHome);

  const {
    tokens: _rawTokens,
    refreshPositions,
    portfolios: _rawPortfolios,
    nftList: _rawNftList,
    loadingToken,
    loadingNft,
    loadingPortfolio,
    refreshing,
    updateTokens,
    updatePortfolio,
    reloadNftList,
    chainsInfo,
  } = useQueryProjects(currentAccount?.address);

  const { tokens, portfolios, nftList } = useMemo(() => {
    return {
      tokens: _rawTokens?.filter(item =>
        selectChainItem?.chain && item?.chain
          ? item.chain === selectChainItem.chain
          : true,
      ),
      portfolios: _rawPortfolios.filter(item =>
        selectChainItem?.chain && item?.chain
          ? item.chain === selectChainItem.chain
          : true,
      ),
      nftList: _rawNftList.filter(item =>
        selectChainItem?.chain && item?.chain
          ? item.chain === selectChainItem.chain
          : true,
      ),
    };
  }, [_rawNftList, _rawPortfolios, _rawTokens, selectChainItem?.chain]);
  const sortTokens = useSortToken(tokens || [], currentAccount);

  const throttleUpdateTokens = useCallback(
    () => throttle(updateTokens, 4000),
    [updateTokens],
  );
  const throttleUpdatePortfolio = useCallback(
    () => throttle(updatePortfolio, 4000),
    [updatePortfolio],
  );
  const throttleReloadNftList = useCallback(
    () => throttle(reloadNftList, 4000),
    [reloadNftList],
  );

  useAppOrmSyncEvents({
    taskFor: ['token', 'nfts', 'protocols'],
    onRemoteDataUpserted: useCallback(
      ctx => {
        if (
          !currentAccount?.address ||
          !isSameAddress(ctx.owner_addr, currentAccount?.address) ||
          !ctx.success
        ) {
          return;
        }
        switch (ctx.taskFor) {
          case 'token':
            throttleUpdateTokens();
            break;
          case 'nfts':
            throttleReloadNftList();
            break;
          case 'protocols':
            throttleUpdatePortfolio();
            break;
          default:
            break;
        }
      },
      [
        currentAccount?.address,
        throttleReloadNftList,
        throttleUpdatePortfolio,
        throttleUpdateTokens,
      ],
    ),
  });

  const foldNftList: ActionItem[] = useMemo(
    () =>
      collectionNftList(nftList.filter(i => i._isFold)).map(item => ({
        type: 'fold_nft',
        data: item,
      })),
    [nftList],
  );
  const unFoldNftList: ActionItem[] = useMemo(
    () =>
      collectionNftList(nftList.filter(i => !i._isFold)).map(item => ({
        type: 'unfold_nft',
        data: item,
      })),
    [nftList],
  );

  const dataList = useMemo(() => {
    const unFoldTokenList: ActionItem[] = sortTokens
      .filter(i => !i._isFold)
      .map(item => ({
        type: 'unfold_token',
        data: item,
      }));
    const foldAndIncludeBalanceTokenList: ActionItem[] = sortTokens
      .filter(
        i =>
          !isScamHidenToken(i) &&
          i._isFold &&
          !i._isExcludeBalance &&
          i._realUsdValue > 0,
      )
      .map(item => ({
        type: 'fold_token',
        data: item,
      }));
    const foldAndExcludeBalanceTokenList: ActionItem[] = sortTokens
      .filter(
        i =>
          !isScamHidenToken(i) &&
          i._isFold &&
          (i._isExcludeBalance || i._realUsdValue === 0),
      )
      .map(item => ({
        type: 'fold_token',
        data: item,
      }));
    const scamTokens: ActionItem[] = sortTokens
      .filter(isScamHidenToken)
      .map(item => ({
        type: 'fold_token',
        data: item,
      }));
    const foldTokenList = [
      ...foldAndIncludeBalanceTokenList,
      ...foldAndExcludeBalanceTokenList,
    ];
    const foldAndIncludeBalanceDefiList = portfolios.filter(
      i => i._isFold && !i._isExcludeBalance && i.netWorth > 0,
    );
    const foldAndExcludeBalanceDefiList = portfolios.filter(
      i => i._isFold && (i._isExcludeBalance || i.netWorth === 0),
    );
    const foldDefiList: ActionItem[] = chunk(
      [...foldAndIncludeBalanceDefiList, ...foldAndExcludeBalanceDefiList],
      2,
    ).map(item => ({
      type: 'fold_defi',
      data: item,
    }));
    const unFoldDefiList: ActionItem[] = chunk(
      portfolios.filter(i => !i._isFold),
      2,
    ).map(item => ({
      type: 'unfold_defi',
      data: item,
    }));
    const itemData: Array<{
      show: boolean;
      data: ActionItem[];
    }> = [
      {
        show: true,
        data: unFoldTokenList,
      },
      {
        show: !!foldTokenList.length,
        data: [
          { type: 'toggle_token_fold' },
          ...(foldHideList ? [] : foldTokenList),
        ],
      },
      {
        show: !foldHideList && !!scamTokens.length,
        data: foldScam
          ? [
              {
                type: 'scam_token',
                data: {
                  total: scamTokens.length,
                  logoUrls: (scamTokens as CombineToken[])
                    .slice(0, 3)
                    .map(i => i.data?.logo_url),
                },
              },
            ]
          : scamTokens,
      },
      {
        show: !!loadingToken && !sortTokens.length,
        data: Array.from({ length: 5 }, () => ({
          type: 'loading-skeleton',
        })),
      },
      {
        show: !loadingToken && !sortTokens.length,
        data: [
          {
            type: 'empty-assets',
            data: t('page.singleHome.sectionHeader.NoData', {
              name: t('page.singleHome.sectionHeader.Token'),
            }),
          },
        ],
      },
      {
        show: true,
        data: [{ type: 'defi_header' }, ...unFoldDefiList],
      },
      {
        show: !!foldDefiList.length,
        data: [
          {
            type: 'toggle_defi_fold',
          },
          ...(foldDefi ? [] : foldDefiList),
        ],
      },
      {
        show: !!loadingPortfolio && !portfolios.length,
        data: Array.from({ length: 2 }, () => ({
          type: 'loading-defi-skeleton',
        })),
      },
      {
        show: !loadingPortfolio && portfolios.length === 0,
        data: [
          {
            type: 'empty-defi',
            data: t('page.singleHome.sectionHeader.NoData', {
              name: t('page.singleHome.sectionHeader.Defi'),
            }),
          },
        ],
      },
      {
        show: true,
        data: [{ type: 'nft_header' }, ...unFoldNftList],
      },
      {
        show: !!foldNftList.length,
        data: [{ type: 'toggle_nft_fold' }, ...(foldNft ? [] : foldNftList)],
      },
      {
        show: !!loadingNft && !nftList.length,
        data: Array.from({ length: 5 }, () => ({
          type: 'loading-skeleton',
        })),
      },
      {
        show: !loadingNft && nftList.length === 0,
        data: [
          {
            type: 'empty-nft',
            data: t('page.singleHome.sectionHeader.NoData', {
              name: t('page.singleHome.sectionHeader.Nft'),
            }),
          },
        ],
      },
    ];
    return itemData
      .filter(item => item.show)
      .map(item => item.data)
      .flat();
  }, [
    foldDefi,
    foldHideList,
    foldNft,
    foldNftList,
    foldScam,
    loadingNft,
    loadingPortfolio,
    loadingToken,
    nftList.length,
    portfolios,
    sortTokens,
    t,
    unFoldNftList,
  ]);

  const handleSwitchTab = useCallback(
    (key: AsssetKey) => {
      setFoldHideList(true);
      setFoldScam(true);
      setFoldDefi(true);
      setFoldNft(true);
      setTimeout(() => {
        if (listRef.current) {
          const data = dataList;
          let index = 0;
          if (key === 'defi') {
            index = data.findIndex(item => item.type === 'defi_header') + 1;
          }
          if (key === 'nft') {
            index = data.findIndex(item => item.type === 'nft_header') + 1;
          }
          listRef.current.scrollToIndex({
            index,
            animated: true,
            viewOffset: MIN_HEADER_HEIGHT,
          });
        }
      }, 200);
    },
    [dataList],
  );

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

  const listRef = useRef<FlashList<any>>(null);

  const currentSection = useMemo(() => {
    if (firstRowType.includes('token')) {
      return 'token';
    }
    if (firstRowType.includes('defi')) {
      return 'defi';
    }
    if (firstRowType.includes('nft')) {
      return 'nft';
    }
    return 'token';
  }, [firstRowType]);

  const { balance } = useCurrentBalance(currentAccount?.address, {
    update: true,
    noNeedBalance: false,
  });
  const {
    result: curveData,
    isLoading: isLoadingCurve,
    refresh: refreshCurve,
  } = useCurve(currentAccount?.address, 0, balance);

  const handleRefresh = useCallback(
    (ignoreLoading?: boolean) => {
      refreshPositions(true, ignoreLoading);
      onRefresh?.();
      refreshCurve();
    },
    [onRefresh, refreshCurve, refreshPositions],
  );

  const renderStickHeader = useCallback(
    (type: string) => {
      switch (type) {
        case 'fold_token':
          return (
            <TokenRowSectionHeader
              str={getTotalFoldToken(sortTokens.filter(i => i._isFold))}
              fold={foldHideList}
              style={styles.sectionHeader}
              buttonStyle={StyleSheet.flatten([
                styles.buttonHeader,
                !isLight && styles.bg2,
              ])}
              onPressFold={() => {
                if (!foldHideList) {
                  setFoldScam(true);
                }
                setFoldHideList(pre => !pre);
              }}
            />
          );
        case 'fold_defi':
          return (
            <TokenRowSectionHeader
              str={getAllDefiCount(portfolios.filter(i => i._isFold))}
              fold={foldDefi}
              style={styles.sectionHeader}
              buttonStyle={StyleSheet.flatten([
                styles.buttonHeader,
                !isLight && styles.bg2,
              ])}
              onPressFold={() => setFoldDefi(pre => !pre)}
            />
          );
        case 'fold_nft':
          return (
            <TokenRowSectionHeader
              str={'' + foldNftList.length}
              fold={foldNft}
              style={styles.sectionHeader}
              buttonStyle={StyleSheet.flatten([
                styles.buttonHeader,
                !isLight && styles.bg2,
              ])}
              onPressFold={() => setFoldNft(pre => !pre)}
            />
          );
        default:
          return <View style={styles.sectionHeader} />;
      }
    },
    [
      foldDefi,
      foldHideList,
      foldNft,
      foldNftList.length,
      isLight,
      portfolios,
      sortTokens,
      styles.bg2,
      styles.buttonHeader,
      styles.sectionHeader,
    ],
  );
  const renderHeader = useCallback(() => {
    return (
      <View
        style={{
          height:
            HEADER_TOP_AREA_HEIGHT +
            ASSETS_SECTION_HEADER +
            SPACE_BETWEEN_HEADER_AND_CHART +
            ASSETS_SECTION_HEADER +
            (errorType ? ALERT_HEIGHT : 0),
        }}>
        <HomeTopArea
          currentAccount={currentAccount}
          onUpdateIsDecrease={onUpdateIsDecrease}
          curveData={curveData}
          isLoadingCurve={isLoadingCurve}
          errorType={errorType}
          // TODO: 顶部loading转圈
          onRefresh={() => handleRefresh(true)}
        />
        <View style={{ height: SPACE_BETWEEN_HEADER_AND_CHART }} />
        <AssestAllHeader
          style={[styles.assetHeader]}
          currentSection={currentSection}
          chainLength={chainsInfo.chainLength}
          onChainClick={handleOnChainClick}
          chainServerId={selectChainItem?.chain}
          onPress={handleSwitchTab}
        />
        {renderStickHeader(firstRowType)}
      </View>
    );
  }, [
    chainsInfo.chainLength,
    currentAccount,
    currentSection,
    curveData,
    errorType,
    firstRowType,
    handleOnChainClick,
    handleRefresh,
    handleSwitchTab,
    isLoadingCurve,
    onUpdateIsDecrease,
    renderStickHeader,
    selectChainItem?.chain,
    styles.assetHeader,
  ]);
  const renderTabBar = useCallback(() => {
    return null;
  }, []);

  const hasNotAssets = useMemo(() => {
    return (
      chainsInfo.chainLength === 0 &&
      !loadingPortfolio &&
      !loadingToken &&
      !loadingNft
    );
  }, [chainsInfo.chainLength, loadingNft, loadingPortfolio, loadingToken]);

  if (!currentAccount?.address) {
    return null;
  }
  return (
    <Tabs.Container
      containerStyle={styles.container}
      minHeaderHeight={ASSETS_SECTION_HEADER + ASSETS_SECTION_HEADER}
      headerHeight={
        HEADER_TOP_AREA_HEIGHT +
        ASSETS_SECTION_HEADER +
        ASSETS_SECTION_HEADER +
        (errorType ? ALERT_HEIGHT : 0)
      }
      renderTabBar={renderTabBar}
      tabBarHeight={0}
      renderHeader={renderHeader}
      headerContainerStyle={styles.tabBarWrap}>
      <Tabs.Tab label="Assets" name="assets">
        <AssetList
          ref={listRef}
          dataList={hasNotAssets ? [{ type: 'empty-token' }] : dataList}
          foldNftAmount={foldNftList.length}
          totalFoldTokenValue={getTotalFoldToken(
            sortTokens.filter(i => i._isFold),
          )}
          foldDefiAmount={getAllDefiCount(portfolios.filter(i => i._isFold))}
          foldHideList={foldHideList}
          setFoldHideList={setFoldHideList}
          foldNft={foldNft}
          setFoldNft={setFoldNft}
          foldDefi={foldDefi}
          setFoldDefi={setFoldDefi}
          setFoldScam={setFoldScam}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          setFirstRowType={setFirstRowType}
          onReachTopStatusChange={onReachTopStatusChange}
          account={currentAccount}
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
  defiGroups: {
    flexDirection: 'row',
    height: DEFI_ITEM_HEIGHT,
    gap: 12,
    paddingHorizontal: 16,
  },
  renderDefiItemWrapper: {
    backgroundColor: ctx.colors2024['neutral-bg-1'],
    borderRadius: 16,
    height: DEFI_ITEM_HEIGHT,
    paddingLeft: 12,
    paddingRight: 16,
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
    backgroundColor: 'transparent',
    shadowColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
  globalWarning: {
    marginHorizontal: 16,
    marginBottom: 13,
  },
}));
