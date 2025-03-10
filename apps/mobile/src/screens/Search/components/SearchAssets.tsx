import { NFTItem } from '@rabby-wallet/rabby-api/dist/types';
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Dimensions, Keyboard, Text, View } from 'react-native';
import { RefreshControl } from 'react-native-gesture-handler';

import {
  ASSETS_ITEM_HEIGHT_NEW,
  ASSETS_SECTION_HEADER,
  ASSETS_SEPARATOR_HEIGHT,
  RootNames,
} from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import {
  DefiRow,
  NftRow,
  TokenRow,
  TokenRowSectionHeader,
} from '@/screens/Home/components/AssetRenderItems';
import {
  AbstractPortfolio,
  AbstractPortfolioToken,
  AbstractProject,
} from '@/screens/Home/types';
import { getTotalFoldToken } from '@/screens/Home/utils/converAssets';
import { navigate } from '@/utils/navigation';
import { createGetStyles2024 } from '@/utils/styles';
import { useAssets } from '../useAssets';
import { PositionLoader } from './Skeleton';
import SearchOnTheChain from './SearchOnTheChain';
import { ExternalTokenRow } from '@/screens/Home/components/AssetRenderItems';
import { useSearchTokens } from '../useSearch';
import { ICombineItem } from '@/screens/Home/hooks/store';
import {
  RecyclerListView,
  DataProvider,
  LayoutProvider,
} from 'recyclerlistview';

const SCREEN_WIDTH = Dimensions.get('window').width - 32;

interface Props {
  resultTokens: AbstractPortfolioToken[];
}

const ViewTypes = {
  HEADER: 0,
  BODY: 1,
  OVERVIEW: 2,
};

const getItemId = item => {
  return `${item.type}/${item.data?.chain || ''}/${item.data?.symbol || ''}/${
    item.data?._tokenId || ''
  }/${item.data?.id || ''}/${item.data?.price_24h_change || ''}/${
    item.data?.price || ''
  }/${item.data?.time_at || ''}/${item.data?._isFold ? 'fold' : 'unfold'}/${
    item.data?._isPined ? 'pin' : 'unpin'
  }`;
};

export const SearchAssets: React.FC<Props> = ({ resultTokens }) => {
  const { styles } = useTheme2024({ getStyle: getStyles });

  const {
    tokens,
    portfolios,
    nftList,
    getCacheTop10Assets,
    checkIsExpireAndUpdate,
    refreshing,
    isLoading,
  } = useAssets('');

  // const { resultTokens, searched, loading, handleSearch } =
  //   useSearchTokens(filterText);
  const { t } = useTranslation();
  const [firstRowType, setFirstRowType] = useState('');
  const dataProvider = useMemo(
    () =>
      new DataProvider((r1, r2) => {
        return getItemId(r1) !== getItemId(r2);
      }),
    [],
  );

  const [foldHideList, setFoldHideList] = useState(true);
  const [listData, setListData] = useState(() =>
    dataProvider.cloneWithRows([]),
  );

  const dataList = useMemo(() => {
    // const unFoldList = tokens
    //   .filter(i => filterText || !i._isFold)
    //   .map(item => ({
    //     type: 'unfold_token',
    //     data: item,
    //   }));
    // const foldList = tokens
    //   .filter(i => i._isFold)
    //   .map(item => ({
    //     type: 'fold_token',
    //     data: item,
    //   }));
    const itemData: Array<{
      show: boolean;
      data: ICombineItem[];
    }> = [
      // {
      //   show: !!unFoldList.length,
      //   data: [
      //     {
      //       type: 'asset_header',
      //     },
      //     ...unFoldList,
      //   ],
      // },
      // {
      //   show: !!(filterText ? [] : foldList).length,
      //   data: [
      //     { type: 'toggle_token_fold' },
      //     ...(foldHideList ? [] : foldList),
      //   ],
      // },
      // {
      //   show: !!portfolios.length,
      //   data: [
      //     { type: 'defi_header' },
      //     ...portfolios.map(item => ({
      //       type: 'defi',
      //       data: item,
      //     })),
      //   ],
      // },
      // {
      //   show: !!(filterText ? nftList : []).length,
      //   data: [
      //     { type: 'nft_header' },
      //     ...nftList.map(item => ({
      //       type: 'nft',
      //       data: item,
      //     })),
      //   ],
      // },
      {
        show: true,
        data: [
          { type: 'search_token_header' },
          ...resultTokens.map(item => ({
            type: 'search-token',
            data: item,
          })),
        ],
      },
    ];
    return itemData
      .filter(item => item.show)
      .map(item => item.data)
      .flat();
  }, [resultTokens]);

  // const dataList = useMemo(() => resultTokens, [resultTokens]);
  useEffect(() => {
    setListData(dataProvider.cloneWithRows(dataList));
  }, [dataList, dataProvider]);

  const handleOpenTokenDetail = React.useCallback(
    (token: AbstractPortfolioToken) => {
      navigate(RootNames.TokenDetail, {
        token: token,
        unHold: token._unHold,
        needUseCacheToken: true,
      });
    },
    [],
  );

  const handleOpenDefiDetail = useCallback(
    (data: AbstractProject, itemList: AbstractPortfolio[]) => {
      navigate(RootNames.DeFiDetail, {
        data,
        portfolioList: itemList,
        cache: true,
      });
    },
    [],
  );

  const handlePressNft = (item: NFTItem) => {
    navigate(RootNames.NftDetail, { token: item });
  };

  const renderItem = useCallback(
    ({ item }: { item: AbstractPortfolioToken }) => {
      return (
        item && (
          <ExternalTokenRow
            data={item}
            style={styles.renderItemWrapper}
            filterText={''}
            onTokenPress={handleOpenTokenDetail}
            logoSize={40}
          />
        )
      );

      // switch (type) {
      //   case 'unfold_token':
      //   case 'fold_token':
      //     return (
      //       <TokenRow
      //         data={data}
      //         onTokenPress={handleOpenTokenDetail}
      //         filterText={filterText}
      //         logoSize={46}
      //         style={styles.renderItemWrapper}
      //         chainLogoSize={18}
      //         hideFoldTag
      //         disableMenu
      //       />
      //     );
      //   case 'nft':
      //     return (
      //       <NftRow
      //         filterText={filterText}
      //         item={data}
      //         disableMenu
      //         hideFoldTag
      //         onPress={() => handlePressNft(data)}
      //         logoSize={46}
      //         chainLogoSize={18}
      //       />
      //     );
      //   case 'defi':
      //     return (
      //       <DefiRow
      //         data={data}
      //         filterText={filterText}
      //         disableMenu
      //         hideFoldTag
      //         onPress={() =>
      //           handleOpenDefiDetail(data, [...(data._portfolios || [])])
      //         }
      //         logoSize={46}
      //         chainLogoSize={18}
      //       />
      //     );
      //   case 'search-token':
      //     return (
      //       <ExternalTokenRow
      //         data={data}
      //         style={styles.renderItemWrapper}
      //         filterText={filterText}
      //         onTokenPress={handleOpenTokenDetail}
      //         logoSize={40}
      //       />
      //     );
      //   case 'asset_header':
      //     return (
      //       <Text style={styles.sectionHeader}>
      //         {t('page.search.sectionHeader.token')}
      //       </Text>
      //     );
      //   case 'toggle_token_fold':
      //     return (
      //       <TokenRowSectionHeader
      //         str={getTotalFoldToken(tokens.filter(i => i._isFold))}
      //         fold={foldHideList}
      //         onPressFold={() => setFoldHideList(pre => !pre)}
      //       />
      //     );
      //   case 'defi_header':
      //     return (
      //       <Text style={styles.sectionHeader}>
      //         {t('page.search.sectionHeader.Defi')}
      //       </Text>
      //     );
      //   case 'nft_header':
      //     return (
      //       <Text style={styles.sectionHeader}>
      //         {t('page.search.sectionHeader.NFT')}
      //       </Text>
      //     );
      //   case 'search_token_header':
      //     return resultTokens.length ? (
      //       <Text style={styles.sectionHeader}>
      //         {t('page.search.searchWeb.title')}
      //       </Text>
      //     ) : null;
      //   default:
      //     return null;
      // }
    },
    [handleOpenTokenDetail, styles],
  );

  const renderStickHeader = (type: string) => {
    switch (type) {
      // /** header */
      // case 'unfold_token':
      //   return (
      //     <Text style={styles.sectionHeader}>
      //       {t('page.search.sectionHeader.token')}
      //     </Text>
      //   );
      // case 'fold_token':
      //   return (
      //     <TokenRowSectionHeader
      //       str={getTotalFoldToken(tokens.filter(i => i._isFold))}
      //       fold={foldHideList}
      //       onPressFold={() => setFoldHideList(pre => !pre)}
      //     />
      //   );
      // case 'nft':
      //   return (
      //     <Text style={styles.sectionHeader}>
      //       {t('page.search.sectionHeader.NFT')}
      //     </Text>
      //   );
      // case 'defi':
      //   return (
      //     <Text style={styles.sectionHeader}>
      //       {t('page.search.sectionHeader.Defi')}
      //     </Text>
      //   );
      case 'search-token':
        return (
          <Text style={styles.sectionHeader}>
            {t('page.search.searchWeb.title')}
          </Text>
        );
      default:
        return null;
    }
  };

  const layoutProvider = useMemo(() => {
    return new LayoutProvider(
      index => {
        const item = listData.getDataForIndex(index);
        if (
          item?.type?.includes('_header') ||
          item?.type?.includes('toggle_')
        ) {
          return ViewTypes.HEADER;
        }
        return ViewTypes.BODY;
      },
      (type, dim) => {
        switch (type) {
          case ViewTypes.HEADER:
            dim.width = SCREEN_WIDTH;
            dim.height = ASSETS_SECTION_HEADER + ASSETS_SEPARATOR_HEIGHT;
            break;

          case ViewTypes.BODY:
            dim.width = SCREEN_WIDTH;
            dim.height = ASSETS_ITEM_HEIGHT_NEW + ASSETS_SEPARATOR_HEIGHT;
            break;
          default:
            dim.width = 0;
            dim.height = 0;
        }
      },
    );
  }, [listData]);

  useLayoutEffect(() => {
    getCacheTop10Assets().then(() => {
      checkIsExpireAndUpdate();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoading && !listData.getSize()) {
    return (
      <View style={styles.bgContainer}>
        <PositionLoader />
      </View>
    );
  }
  if (!listData.getSize()) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Animated.FlatList
        data={resultTokens}
        renderItem={({ item }) => renderItem({ item })}
        style={styles.list}
      />

      {/* {firstRowType?.includes('_header') ||
      firstRowType?.includes('toggle_') ? null : (
        <Animated.View style={[styles.bgContainer, styles.stickyHeader]}>
          {renderStickHeader(firstRowType)}
        </Animated.View>
      )}
      <RecyclerListView
        style={styles.list}
        dataProvider={listData}
        layoutProvider={layoutProvider}
        rowRenderer={renderItem}
        onVisibleIndicesChanged={indexes => {
          if (listData.getDataForIndex(indexes[0])?.type) {
            setFirstRowType(listData.getDataForIndex(indexes[0]).type);
          }
        }}
        // renderFooter={() => (
        //   <SearchOnTheChain
        //     filterText={filterText}
        //     loading={loading}
        //     searched={searched}
        //     hasTokens={!!resultTokens.length}
        //     handleSearch={() => handleSearch(filterText)}
        //   />
        // )}
        onScroll={() => {
          Keyboard.dismiss();
        }}
        scrollViewProps={{
          refreshControl: (
            <RefreshControl
              style={styles.bgContainer}
              onRefresh={() => {
                checkIsExpireAndUpdate(true);
              }}
              refreshing={refreshing}
            />
          ),
        }}
      /> */}
    </View>
  );
};

const getStyles = createGetStyles2024(ctx => ({
  container: {
    flex: 1,
  },
  list: {
    flex: 1,
    backgroundColor: ctx.isLight
      ? ctx.colors2024['neutral-bg-0']
      : ctx.colors2024['neutral-bg-1'],
    paddingHorizontal: 16,
  },
  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: ASSETS_SECTION_HEADER,
    zIndex: 1,
  },
  bgContainer: {
    backgroundColor: ctx.isLight
      ? ctx.colors2024['neutral-bg-0']
      : ctx.colors2024['neutral-bg-1'],
    paddingHorizontal: 16,
  },
  emptyHolder: {
    marginTop: 65,
  },
  emptyImg: {
    width: 160,
    height: 117,
  },
  emptyText: {
    marginTop: 21,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '400',
    fontFamily: 'SF Pro Rounded',
    color: ctx.colors2024['neutral-info'],
  },
  sectionHeader: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    fontWeight: '500',
    lineHeight: 22,
    height: ASSETS_SECTION_HEADER,
    color: ctx.colors2024['neutral-secondary'],
    backgroundColor: ctx.isLight
      ? ctx.colors2024['neutral-bg-0']
      : ctx.colors2024['neutral-bg-1'],
  },
  renderItemWrapper: {
    height: ASSETS_ITEM_HEIGHT_NEW,
    marginBottom: 8,
  },
  footer: {
    height: 200,
  },
}));
