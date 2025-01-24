import { NFTItem } from '@rabby-wallet/rabby-api/dist/types';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Keyboard, SectionList, Text, View } from 'react-native';
import { RefreshControl } from 'react-native-gesture-handler';

import {
  ASSETS_ITEM_HEIGHT,
  ASSETS_ITEM_HEIGHT_NEW,
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

interface Props {
  filterText?: string;
}

export const SearchAssets: React.FC<Props> = ({ filterText }) => {
  const { styles } = useTheme2024({ getStyle: getStyles });

  const {
    tokens,
    portfolios,
    nftList,
    getCacheTop10Assets,
    refreshing,
    isLoading,
  } = useAssets(filterText);
  const { t } = useTranslation();

  const [foldHideList, setFoldHideList] = useState(true);

  const sections = useMemo(() => {
    const unFoldList = tokens.filter(i => filterText || !i._isFold);
    const foldList = tokens.filter(i => i._isFold);
    return [
      {
        type: 'unfold_token',
        originData: unFoldList,
        data: unFoldList,
      },
      {
        type: 'fold_token',
        originData: filterText ? [] : foldList,
        data: foldHideList ? [] : foldList,
      },
      {
        type: 'defi',
        originData: portfolios,
        data: portfolios,
      },
      {
        type: 'nft',
        originData: filterText ? nftList : [],
        data: nftList,
      },
    ];
  }, [filterText, foldHideList, nftList, portfolios, tokens]);

  const handleOpenTokenDetail = React.useCallback(
    (token: AbstractPortfolioToken) => {
      navigate(RootNames.TokenDetail, {
        token: token,
        unHold: token._unHold,
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

  const renderItem = ({ item, section }) => {
    switch (section.type) {
      case 'unfold_token':
        return (
          <TokenRow
            data={item}
            onTokenPress={handleOpenTokenDetail}
            filterText={filterText}
            logoSize={46}
            chainLogoSize={18}
            hideFoldTag
            disableMenu
          />
        );
      case 'fold_token':
        return (
          <TokenRow
            data={item}
            filterText={filterText}
            onTokenPress={handleOpenTokenDetail}
            logoSize={46}
            chainLogoSize={18}
            hideFoldTag
            disableMenu
          />
        );
      case 'nft':
        return (
          <NftRow
            filterText={filterText}
            item={item}
            disableMenu
            hideFoldTag
            onPress={() => handlePressNft(item)}
            logoSize={46}
            chainLogoSize={18}
          />
        );
      case 'defi':
        return (
          <DefiRow
            data={item}
            filterText={filterText}
            disableMenu
            hideFoldTag
            onPress={() =>
              handleOpenDefiDetail(item, [...(item._portfolios || [])])
            }
            logoSize={46}
            chainLogoSize={18}
          />
        );
      default:
        return null;
    }
  };

  const renderSectionHeader = ({ section }) => {
    switch (section.type) {
      case 'unfold_token':
        return (
          <Text style={styles.sectionHeader}>
            {t('page.search.sectionHeader.token')}
          </Text>
        );
      case 'fold_token':
        return (
          <TokenRowSectionHeader
            str={getTotalFoldToken(tokens.filter(i => i._isFold))}
            fold={foldHideList}
            onPressFold={() => setFoldHideList(pre => !pre)}
          />
        );
      case 'defi':
        return (
          <Text style={styles.sectionHeader}>
            {t('page.search.sectionHeader.Defi')}
          </Text>
        );
      case 'nft':
        return (
          <Text style={styles.sectionHeader}>
            {t('page.search.sectionHeader.NFT')}
          </Text>
        );
      default:
        return <View style={{ height: 0 }} />;
    }
  };

  const getItemLayout = useCallback(
    (_data: any, index: number) => ({
      length: ASSETS_ITEM_HEIGHT,
      offset: ASSETS_ITEM_HEIGHT * index,
      index,
    }),
    [],
  );
  useEffect(() => {
    getCacheTop10Assets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ListEmptyComponent = useMemo(() => {
    return isLoading ? <PositionLoader /> : null;
  }, [isLoading]);

  const ListFooterComponent = useMemo(() => {
    return <SearchOnTheChain filterText={filterText} />;
  }, [filterText]);

  return (
    <SectionList
      contentInset={{ bottom: 56 }}
      sections={sections.filter(i => !!i.originData?.length)}
      renderItem={renderItem}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.bgContainer}
      keyExtractor={item => `${item.chain}/${item.symbol || ''}/${item.id}`}
      windowSize={10}
      stickySectionHeadersEnabled
      ListEmptyComponent={ListEmptyComponent}
      onScroll={() => {
        Keyboard.dismiss();
      }}
      ListFooterComponent={ListFooterComponent}
      renderSectionHeader={renderSectionHeader}
      refreshControl={
        <RefreshControl
          style={styles.bgContainer}
          onRefresh={() => {
            getCacheTop10Assets(true);
          }}
          refreshing={refreshing}
        />
      }
    />
  );
};

const getStyles = createGetStyles2024(ctx => ({
  bgContainer: {
    backgroundColor: ctx.isLight
      ? ctx.colors2024['neutral-bg-0']
      : ctx.colors2024['neutral-bg-1'],
    paddingHorizontal: 16,
    gap: 8,
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
    color: ctx.colors2024['neutral-secondary'],
    backgroundColor: ctx.isLight
      ? ctx.colors2024['neutral-bg-0']
      : ctx.colors2024['neutral-bg-1'],
    paddingBottom: 8,
  },
}));
