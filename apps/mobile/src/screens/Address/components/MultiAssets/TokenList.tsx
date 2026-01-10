import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ListRenderItem, View } from 'react-native';
import { Tabs } from 'react-native-collapsible-tab-view';
import { useShallow } from 'zustand/shallow';

import { ASSETS_ITEM_HEIGHT_NEW, RootNames } from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import {
  TokenRowSectionLpTokenHeader,
  TokenRowV2,
} from '@/screens/Home/components/AssetRenderItems';
import { navigateDeprecated } from '@/utils/navigation';
import { createGetStyles2024 } from '@/utils/styles';
import { ItemLoader } from '@/screens/Search/components/Skeleton';
import { ScamTokenHeader } from '@/screens/Home/components/AssetRenderItems/ScamTokenHeader';
import { RefreshControl } from 'react-native-gesture-handler';
import { isTabsSwiping, useAccountInfo } from './hooks';
import { useCurrency } from '@/hooks/useCurrency';
import { KeyringAccountWithAlias } from '@/hooks/account';
import { EmptyAssets } from '@/screens/Home/components/AssetRenderItems/EmptyAssets';
import { TAB_HEADER_FULL_HEIGHT, TabName } from './TabsMultiAssets';
import useTokenList, {
  getMultiAssetsCacheKey,
  ITokenItem,
  useTokenListComputedStore,
} from '@/store/tokens';
import { formatNetworth } from '@/utils/math';
import { useFindAccountByAddress, useIsFocusedCurrentTab } from './hooks/share';
import { useSelectedChainItem } from '@/screens/Home/useChainInfo';

const MemoizedTokenRow = React.memo(TokenRowV2);
const MemoizedScamTokenHeader = React.memo(ScamTokenHeader);
const MemoizedTokenRowSectionHeader = React.memo(TokenRowSectionLpTokenHeader);

const MemoizedItemLoader = React.memo(ItemLoader);
export const MemoizedTokenItemLoader = React.memo((props: RNViewProps) => {
  return (
    <View {...props} style={[{ paddingHorizontal: 16 }, props.style]}>
      <MemoizedItemLoader />
    </View>
  );
});

type TokenListItem =
  | {
      type: 'unfold_token' | 'fold_token';
      data: ITokenItem;
      isLast?: boolean;
    }
  | {
      type: 'toggle_token_fold';
    }
  | {
      type: 'scam_header';
      data: {
        total: number;
        logoUrls: string[];
      };
    }
  | {
      type: 'empty-assets';
      data: string;
    };

const { batchGetTokenList } = useTokenList.getState();

export const TokenList = () => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();
  const { myTop10Addresses } = useAccountInfo();
  const selectedChainItem = useSelectedChainItem();
  const chain = useMemo(() => {
    return selectedChainItem?.chain;
  }, [selectedChainItem?.chain]);

  const [foldHideList, setFoldHideList] = useState(true);
  const [foldScam, setFoldScam] = useState(true);
  const [isLpTokenEnabled, setIsLpTokenEnabled] = useState(false);

  const { currency } = useCurrency();

  const getAccountByAddress = useFindAccountByAddress();
  const { isFocused } = useIsFocusedCurrentTab(TabName.token);

  const emptyResult = useMemo(
    () => ({
      unFoldTokens: [] as ITokenItem[],
      foldTokens: [] as ITokenItem[],
      scamTokens: [] as ITokenItem[],
    }),
    [],
  );

  const registerMultiAssets = useTokenListComputedStore(
    state => state.registerMultiAssets,
  );

  const multiAssetsKey = useMemo(
    () => getMultiAssetsCacheKey(myTop10Addresses, chain, isLpTokenEnabled),
    [myTop10Addresses, chain, isLpTokenEnabled],
  );

  useEffect(() => {
    registerMultiAssets(myTop10Addresses, chain, isLpTokenEnabled);
  }, [myTop10Addresses, chain, isLpTokenEnabled, registerMultiAssets]);

  const {
    unFoldTokens: tokens,
    foldTokens,
    scamTokens,
  } = useTokenListComputedStore(
    useShallow(state => state.multiAssetsCache[multiAssetsKey] || emptyResult),
  );

  const isLoading = useTokenList(s => s.isLoading);

  const foldTokenUsdValue = useMemo(() => {
    const usdValue = foldTokens
      .filter(item => item.is_core)
      .reduce((total, item) => {
        return total + item.usd_value;
      }, 0);
    return formatNetworth(usdValue * currency.usd_rate, false, currency.symbol);
  }, [foldTokens, currency]);

  useEffect(() => {
    batchGetTokenList(myTop10Addresses);
  }, [myTop10Addresses]);

  const hasNoAssets =
    tokens.length + foldTokens.length + scamTokens.length === 0 &&
    !isLoading &&
    isFocused;

  const handleOpenTokenDetail = useCallback(
    (token: ITokenItem, account?: KeyringAccountWithAlias) => {
      if (isTabsSwiping.value) {
        return;
      }
      navigateDeprecated(RootNames.TokenDetail, {
        token: token,
        unHold: false,
        needUseCacheToken: true,
        account,
      });
    },
    [],
  );

  const handleOpenScamToken = useCallback(() => {
    setFoldScam(false);
  }, []);

  const handleToggleTokenFold = useCallback(() => {
    if (!foldHideList) {
      setFoldScam(true);
      setIsLpTokenEnabled(false);
    }
    setFoldHideList(pre => !pre);
  }, [foldHideList]);

  const onRefresh = useCallback(async () => {
    try {
      batchGetTokenList(myTop10Addresses, true);
    } catch (error) {
      console.error('Refresh failed:', error);
    }
  }, [myTop10Addresses]);

  const dataList = useMemo(() => {
    const items: TokenListItem[] = [];

    if (hasNoAssets) {
      items.push({
        type: 'empty-assets',
        data: t('page.singleHome.sectionHeader.NoData', {
          name: t('page.singleHome.sectionHeader.Token'),
        }),
      });
      return items;
    }

    tokens.forEach((token, index) => {
      items.push({
        type: 'unfold_token',
        data: token,
        isLast: index === tokens.length - 1,
      });
    });

    items.push({ type: 'toggle_token_fold' });

    if (!foldHideList) {
      foldTokens.forEach(token => {
        items.push({ type: 'fold_token', data: token });
      });

      if (scamTokens.length > 0) {
        if (foldScam) {
          items.push({
            type: 'scam_header',
            data: {
              total: scamTokens.length,
              logoUrls: scamTokens.slice(0, 3).map(i => i.logo_url),
            },
          });
        } else {
          scamTokens.forEach(token => {
            items.push({ type: 'fold_token', data: token });
          });
        }
      }
    }

    return items;
  }, [foldHideList, foldScam, hasNoAssets, scamTokens, t, tokens, foldTokens]);

  const renderItem = useCallback<ListRenderItem<TokenListItem>>(
    ({ item }) => {
      switch (item.type) {
        case 'unfold_token':
          return (
            <View
              style={[styles.rowWrap, item.isLast ? styles.lastRowWrap : null]}>
              <MemoizedTokenRow
                data={item.data}
                onTokenPress={data =>
                  handleOpenTokenDetail(
                    data,
                    getAccountByAddress(item.data.owner_addr),
                  )
                }
                logoSize={46}
                style={styles.renderItemWrapper}
                chainLogoSize={18}
                account={getAccountByAddress(item.data.owner_addr)}
                scene="portfolio"
              />
            </View>
          );
        case 'fold_token':
          return (
            <View style={styles.foldRowWrap}>
              <MemoizedTokenRow
                data={item.data}
                onTokenPress={data =>
                  handleOpenTokenDetail(
                    data,
                    getAccountByAddress(item.data.owner_addr),
                  )
                }
                logoSize={46}
                style={styles.renderItemWrapper}
                chainLogoSize={18}
                account={getAccountByAddress(item.data.owner_addr)}
                scene="portfolio"
              />
            </View>
          );
        case 'toggle_token_fold':
          return (
            <MemoizedTokenRowSectionHeader
              style={styles.tokenSectionHeader}
              fold={foldHideList}
              str={foldTokenUsdValue}
              onPressFold={handleToggleTokenFold}
              isEnabled={isLpTokenEnabled}
              onValueChange={setIsLpTokenEnabled}
            />
          );
        case 'scam_header':
          return (
            <View style={styles.foldRowWrap}>
              <MemoizedScamTokenHeader
                total={item.data.total}
                logoUrls={item.data.logoUrls}
                style={{ ...styles.renderItemWrapper, flexGrow: 0 }}
                onPress={handleOpenScamToken}
              />
            </View>
          );
        case 'empty-assets':
          return (
            <EmptyAssets
              style={styles.emptyAssets}
              desc={item.data}
              type={'empty-assets'}
            />
          );
        default:
          return null;
      }
    },
    [
      foldHideList,
      foldTokenUsdValue,
      getAccountByAddress,
      handleOpenScamToken,
      handleOpenTokenDetail,
      handleToggleTokenFold,
      isLpTokenEnabled,
      styles,
    ],
  );

  const keyExtractor = useCallback((item: TokenListItem) => {
    if (item.type === 'unfold_token' || item.type === 'fold_token') {
      return `${item.type}-${item.data.owner_addr}-${item.data.chain}-${item.data.id}`;
    }
    if (item.type === 'scam_header') {
      return `scam-header-${item.data.total}`;
    }
    if (item.type === 'empty-assets') {
      return `empty-assets-${item.data}`;
    }
    return item.type;
  }, []);

  return (
    <Tabs.FlatList
      style={styles.container}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl
          style={styles.bgContainer}
          onRefresh={onRefresh}
          refreshing={false}
        />
      }
      data={dataList}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
    />
  );
};

const getStyles = createGetStyles2024(() => ({
  container: {
    flex: 1,
    marginTop: TAB_HEADER_FULL_HEIGHT,
  },
  list: {
    marginTop: -TAB_HEADER_FULL_HEIGHT,
    paddingHorizontal: 16,
  },
  bgContainer: {
    paddingHorizontal: 16,
  },
  tokenSectionHeader: {
    paddingLeft: 0,
    paddingRight: 0,
    backgroundColor: 'transparent',
    marginBottom: 12,
  },
  emptyAssets: {
    marginHorizontal: 0,
  },
  loadingItem: {
    height: ASSETS_ITEM_HEIGHT_NEW,
  },
  rowWrap: {
    height: ASSETS_ITEM_HEIGHT_NEW,
    marginBottom: 8,
  },
  lastRowWrap: {
    marginBottom: 12,
  },
  foldRowWrap: {
    height: ASSETS_ITEM_HEIGHT_NEW,
    marginBottom: 8,
  },
  renderItemWrapper: {
    height: ASSETS_ITEM_HEIGHT_NEW,
  },
}));
