import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, View } from 'react-native';
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
import { ListHeaderComponent, ListRenderSeparator } from './RenderRow/Common';
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

export const TokenList = () => {
  const { styles, isLight } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();
  const { top10Addresses } = useAccountInfo();
  const selectedChainItem = useSelectedChainItem();
  const chain = useMemo(() => {
    return selectedChainItem?.chain;
  }, [selectedChainItem?.chain]);

  const [foldHideList, setFoldHideList] = useState(true);
  const [foldScam, setFoldScam] = useState(true);
  const [isLpTokenEnabled, setIsLpTokenEnabled] = useState(false);

  const { currency } = useCurrency();

  const getAccountByAddress = useFindAccountByAddress();
  const { isFocused, isFocusing } = useIsFocusedCurrentTab(TabName.token);

  // const { tokens: _rawTokens } = useAssetsTokens({
  //   hideCombined: false,
  // });

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
    () => getMultiAssetsCacheKey(top10Addresses, chain, isLpTokenEnabled),
    [top10Addresses, chain, isLpTokenEnabled],
  );

  useEffect(() => {
    registerMultiAssets(top10Addresses, chain, isLpTokenEnabled);
  }, [top10Addresses, chain, isLpTokenEnabled, registerMultiAssets]);

  const {
    unFoldTokens: tokens,
    foldTokens,
    scamTokens,
  } = useTokenListComputedStore(
    useShallow(state => state.multiAssetsCache[multiAssetsKey] || emptyResult),
  );

  const { isLoading } = useTokenList();

  const foldTokenUsdValue = useMemo(() => {
    const usdValue = foldTokens
      .filter(item => item.is_core)
      .reduce((total, item) => {
        return total + item.usd_value;
      }, 0);
    return formatNetworth(usdValue * currency.usd_rate, false, currency.symbol);
  }, [foldTokens, currency]);

  const { batchGetTokenList } = useTokenList();

  useEffect(() => {
    batchGetTokenList(top10Addresses);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [top10Addresses]);

  const hasNoAssets =
    tokens.length + foldTokens.length + scamTokens.length === 0 &&
    !isLoading &&
    isFocused;

  const scamTokenDisplaySummary = useMemo(() => {
    return {
      logos: scamTokens.slice(0, 3).map(i => i.logo_url),
      total: scamTokens.length,
    };
  }, [scamTokens]);

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
    }
    setFoldHideList(pre => !pre);
  }, [foldHideList]);

  const onRefresh = useCallback(async () => {
    try {
      batchGetTokenList(top10Addresses, true);
    } catch (error) {
      console.error('Refresh failed:', error);
    }
  }, [batchGetTokenList, top10Addresses]);

  if (hasNoAssets) {
    return (
      <Tabs.ScrollView
        tvParallaxProperties={null}
        style={styles.container}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            style={styles.bgContainer}
            onRefresh={onRefresh}
            refreshing={false}
          />
        }>
        <EmptyAssets
          style={styles.emptyAssets}
          desc={t('page.singleHome.sectionHeader.NoData', {
            name: t('page.singleHome.sectionHeader.Token'),
          })}
          type={'empty-assets'}
        />
      </Tabs.ScrollView>
    );
  }

  return (
    <Tabs.ScrollView
      tvParallaxProperties={null}
      style={styles.container}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl
          style={styles.bgContainer}
          onRefresh={onRefresh}
          refreshing={false}
        />
      }>
      {tokens.map((token, index) => (
        <View
          style={[
            styles.rowWrap,
            index === tokens.length - 1 ? styles.lastRowWrap : null,
          ]}
          key={`${token.owner_addr}-${token.chain}-${token.id}`}>
          <MemoizedTokenRow
            data={token}
            onTokenPress={data =>
              handleOpenTokenDetail(data, getAccountByAddress(token.owner_addr))
            }
            logoSize={46}
            style={styles.renderItemWrapper}
            chainLogoSize={18}
            account={getAccountByAddress(token.owner_addr)}
            scene="portfolio"
          />
        </View>
      ))}
      <MemoizedTokenRowSectionHeader
        style={styles.tokenSectionHeader}
        fold={foldHideList}
        onPressFold={handleToggleTokenFold}
        isEnabled={isLpTokenEnabled}
        onValueChange={setIsLpTokenEnabled}
      />
      {!foldHideList && (
        <FlatList
          data={foldTokens}
          keyExtractor={item => `${item.owner_addr}-${item.chain}-${item.id}`}
          renderItem={({ item, index }) => (
            <View
              style={[
                styles.foldRowWrap,
                index === foldTokens.length - 1 ? styles.lastFoldRowWrap : null,
              ]}>
              <MemoizedTokenRow
                data={item}
                onTokenPress={data =>
                  handleOpenTokenDetail(
                    data,
                    getAccountByAddress(item.owner_addr),
                  )
                }
                logoSize={46}
                style={styles.renderItemWrapper}
                chainLogoSize={18}
                account={getAccountByAddress(item.owner_addr)}
                scene="portfolio"
              />
            </View>
          )}
          initialNumToRender={20}
          windowSize={5}
          maxToRenderPerBatch={20}
          style={{
            flexGrow: 0,
          }}
          ListHeaderComponent={ListHeaderComponent}
          ItemSeparatorComponent={ListRenderSeparator}
          // ListFooterComponent={ListRenderFooter}
          scrollEnabled={false}
        />
      )}
      {scamTokens.length > 0 && !foldHideList && (
        <>
          {foldScam && (
            <MemoizedScamTokenHeader
              total={scamTokenDisplaySummary.total}
              logoUrls={scamTokenDisplaySummary.logos}
              style={{ ...styles.renderItemWrapper, flexGrow: 0 }}
              onPress={handleOpenScamToken}
            />
          )}
          {!foldScam && (
            <FlatList
              data={scamTokens}
              initialNumToRender={20}
              windowSize={5}
              maxToRenderPerBatch={20}
              keyExtractor={item =>
                `${item.owner_addr}-${item.chain}-${item.id}`
              }
              renderItem={({ item }) => (
                <View style={styles.foldRowWrap}>
                  <MemoizedTokenRow
                    data={item}
                    onTokenPress={data =>
                      handleOpenTokenDetail(
                        data,
                        getAccountByAddress(item.owner_addr),
                      )
                    }
                    logoSize={46}
                    style={styles.renderItemWrapper}
                    chainLogoSize={18}
                    account={getAccountByAddress(item.owner_addr)}
                    scene="portfolio"
                  />
                </View>
              )}
              ListHeaderComponent={ListHeaderComponent}
              ItemSeparatorComponent={ListRenderSeparator}
              // ListFooterComponent={ListRenderFooter}
              scrollEnabled={false}
            />
          )}
        </>
      )}
    </Tabs.ScrollView>
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
  },
  lastFoldRowWrap: {
    marginBottom: 8,
  },
  renderItemWrapper: {
    height: ASSETS_ITEM_HEIGHT_NEW,
  },
}));
