import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ListRenderItem, StyleSheet, View } from 'react-native';
import { RefreshControl } from 'react-native-gesture-handler';
import { useTranslation } from 'react-i18next';
import {
  Tabs,
  useCurrentTabScrollY,
  useFocusedTab,
} from 'react-native-collapsible-tab-view';
import { runOnJS, useAnimatedReaction } from 'react-native-reanimated';
import { useShallow } from 'zustand/shallow';

import { navigateDeprecated } from '@/utils/navigation';
import { createGetStyles2024 } from '@/utils/styles';
import {
  ASSETS_ITEM_HEIGHT_NEW,
  ASSETS_SECTION_HEADER,
  RootNames,
} from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import { EmptyTokenRow } from './components/AssetRenderItems/EmptyToken';
import { EmptyAssets } from './components/AssetRenderItems/EmptyAssets';
import { ItemLoader } from './components/Skeleton';
import { ScamTokenHeader } from './components/AssetRenderItems/ScamTokenHeader';
import {
  TokenRowSectionLpTokenHeader,
  TokenRowV2,
} from './components/AssetRenderItems';
import { useCurrency } from '@/hooks/useCurrency';
import {
  useSingleHomeAccount,
  useSingleHomeChain,
  useSingleHomeSelectData,
} from './hooks/singleHome';
import useTokenList, {
  getSingleAssetsCacheKey,
  ITokenItem,
  useTokenListComputedStore,
} from '@/store/tokens';
import { formatNetworth } from '@/utils/math';

type TokenListItem =
  | {
      type: 'unfold_token' | 'fold_token';
      data: ITokenItem;
    }
  | {
      type: 'toggle_token_fold';
    }
  | {
      type: 'scam_token';
      data: {
        total: number;
        logoUrls: string[];
      };
    }
  | {
      type: 'empty-token';
    }
  | {
      type: 'empty-assets';
      data: string;
    }
  | {
      type: 'loading-skeleton';
      data: string;
    };

interface Props {
  noAssetsOnAnyChain: boolean;
  onRefresh?: () => void;
  onReachTopStatusChange?: (status: boolean) => void;
}
const FOOTER_HEIGHT = 220;
const SPACING_HEIGHT = 8;

export const TokenList = ({
  noAssetsOnAnyChain,
  onRefresh,
  onReachTopStatusChange,
}: Props) => {
  const { styles, isLight } = useTheme2024({
    getStyle: getStyles,
  });
  const { t } = useTranslation();
  const { currentAccount } = useSingleHomeAccount();
  const { selectedChain } = useSingleHomeChain();
  const { currency } = useCurrency();

  const [foldHideList, setFoldHideList] = useState(true);
  const [foldScam, setFoldScam] = useState(true);
  const [isLpTokenEnabled, setIsLpTokenEnabled] = useState(false);

  const focusedTab = useFocusedTab();
  const isFocused = useMemo(() => {
    return focusedTab === 'tokens';
  }, [focusedTab]);

  const currentAddress = currentAccount?.address;
  const lowerAddress = currentAddress?.toLowerCase();

  const emptyResult = useMemo(
    () => ({
      unFoldTokens: [] as ITokenItem[],
      foldTokens: [] as ITokenItem[],
      scamTokens: [] as ITokenItem[],
    }),
    [],
  );

  const registerSingleAssets = useTokenListComputedStore(
    state => state.registerSingleAssets,
  );

  const singleAssetsKey = useMemo(() => {
    if (!currentAddress) {
      return null;
    }
    return getSingleAssetsCacheKey(
      currentAddress,
      selectedChain,
      isLpTokenEnabled,
    );
  }, [currentAddress, selectedChain, isLpTokenEnabled]);

  useEffect(() => {
    if (!currentAddress) {
      return;
    }
    registerSingleAssets(currentAddress, selectedChain, isLpTokenEnabled);
  }, [currentAddress, selectedChain, isLpTokenEnabled, registerSingleAssets]);

  const { unFoldTokens, foldTokens, scamTokens } = useTokenListComputedStore(
    useShallow(state =>
      singleAssetsKey
        ? state.singleAssetsCache[singleAssetsKey] || emptyResult
        : emptyResult,
    ),
  );

  const isLoading = useTokenList(state => {
    if (!lowerAddress) return false;
    return !!state.isLoadingByAddress[lowerAddress]?.loading;
  });
  const isAllLoading = useTokenList(state => {
    if (!lowerAddress) return false;
    return !!state.isLoadingByAddress[lowerAddress]?.allLoading;
  });
  const getTokenList = useTokenList(s => s.getTokenList);

  useEffect(() => {
    if (!isFocused || !currentAddress) {
      return;
    }
    getTokenList(currentAddress);
  }, [currentAddress, getTokenList, isFocused]);

  const { selectData } = useSingleHomeSelectData();
  const noAnyAssets = !selectData.rawNetWorth || noAssetsOnAnyChain;

  const foldTokenUsdValue = useMemo(() => {
    const usdValue = foldTokens
      .filter(item => item.is_core)
      .reduce((total, item) => total + item.usd_value, 0);
    return formatNetworth(usdValue * currency.usd_rate, false, currency.symbol);
  }, [currency.symbol, currency.usd_rate, foldTokens]);

  const dataList = useMemo(() => {
    const items: TokenListItem[] = [];

    unFoldTokens.forEach(token => {
      items.push({ type: 'unfold_token', data: token });
    });

    const hasFoldSection = foldTokens.length > 0 || scamTokens.length > 0;
    if (hasFoldSection || isLpTokenEnabled) {
      items.push({ type: 'toggle_token_fold' });
      if (!foldHideList) {
        foldTokens.forEach(token => {
          items.push({ type: 'fold_token', data: token });
        });
        if (scamTokens.length > 0) {
          if (foldScam) {
            items.push({
              type: 'scam_token',
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
    }

    if (
      (isLoading && items.length === 0) ||
      (isAllLoading && isLpTokenEnabled)
    ) {
      items.push(
        ...Array.from({ length: 5 }, (_, index) => ({
          type: 'loading-skeleton' as const,
          data: `index-token-${index.toString()}`,
        })),
      );
    }

    if (!isLoading && items.length === 0) {
      if (noAnyAssets) {
        // items.push({ type: 'empty-token' });
        items.push({
          type: 'empty-assets',
          data: t('page.singleHome.sectionHeader.NoData', {
            name: t('page.singleHome.sectionHeader.Token'),
          }),
        });
      } else {
        items.push({
          type: 'empty-assets',
          data: t('page.singleHome.sectionHeader.NoData', {
            name: t('page.singleHome.sectionHeader.Token'),
          }),
        });
      }
    }

    return items;
  }, [
    foldHideList,
    foldScam,
    foldTokens,
    isAllLoading,
    isLoading,
    isLpTokenEnabled,
    noAnyAssets,
    scamTokens,
    t,
    unFoldTokens,
  ]);

  const [showScrollIndicator, setShowScrollIndicator] = useState(false);

  const handleOpenTokenDetail = useCallback(
    (token: ITokenItem) => {
      console.log(currentAccount);
      navigateDeprecated(RootNames.TokenDetail, {
        token,
        isSingleAddress: true,
        account: currentAccount as any,
      });
    },
    [currentAccount],
  );

  const handleRefresh = useCallback(() => {
    if (!currentAddress) {
      return;
    }
    getTokenList(currentAddress, true);
    onRefresh?.();
  }, [currentAddress, getTokenList, onRefresh]);

  const renderItem = useCallback<ListRenderItem<TokenListItem>>(
    ({ item }) => {
      const { type } = item;
      switch (type) {
        case 'unfold_token':
        case 'fold_token':
          return (
            <View style={styles.rowWrap}>
              <TokenRowV2
                data={item.data}
                style={StyleSheet.flatten([
                  styles.renderItemWrapper,
                  !isLight && styles.bg2,
                ])}
                onTokenPress={handleOpenTokenDetail}
                logoSize={46}
                chainLogoSize={18}
                scene="portfolio"
              />
            </View>
          );
        case 'scam_token':
          return (
            <View style={styles.rowWrap}>
              <ScamTokenHeader
                total={item.data.total}
                logoUrls={item.data.logoUrls}
                style={StyleSheet.flatten([
                  styles.renderItemWrapper,
                  !isLight && styles.bg2,
                ])}
                onPress={() => {
                  setFoldScam(false);
                }}
              />
            </View>
          );
        case 'toggle_token_fold':
          return (
            <TokenRowSectionLpTokenHeader
              isEnabled={isLpTokenEnabled}
              onValueChange={setIsLpTokenEnabled}
              fold={foldHideList}
              style={styles.sectionHeader}
              buttonStyle={StyleSheet.flatten([
                styles.buttonHeader,
                !isLight && styles.bg2,
              ])}
              str={foldTokenUsdValue}
              onPressFold={() => {
                if (!foldHideList) {
                  setFoldScam(true);
                  setIsLpTokenEnabled(false);
                }
                setFoldHideList(pre => !pre);
              }}
            />
          );
        case 'empty-token':
          return (
            <EmptyTokenRow
              currentAccount={currentAccount}
              // onReceive={handleOnReceive}
            />
          );
        case 'empty-assets':
          return (
            <EmptyAssets
              style={styles.emptyAssets}
              desc={item.data ?? undefined}
              type={type}
            />
          );
        case 'loading-skeleton':
          return (
            <View style={styles.rowWrap}>
              <ItemLoader style={styles.removeLeft} />
            </View>
          );
        default:
          return null;
      }
    },
    [
      currentAccount,
      foldHideList,
      foldTokenUsdValue,
      handleOpenTokenDetail,
      isLight,
      isLpTokenEnabled,
      styles,
    ],
  );

  const keyExtractor = useCallback((item: TokenListItem) => {
    if (item.type === 'unfold_token' || item.type === 'fold_token') {
      return `${item.type}-${item.data.owner_addr}-${item.data.chain}-${item.data.id}`;
    }
    if (item.type === 'scam_token') {
      return `scam-token-${item.data.total}`;
    }
    if (item.type === 'loading-skeleton') {
      return `loading-${item.data}`;
    }
    if (item.type === 'empty-assets') {
      return `empty-assets-${item.data}`;
    }
    return item.type;
  }, []);

  const ListRenderSeparator = useCallback(() => {
    return <View style={{ height: SPACING_HEIGHT }} />;
  }, []);

  const ListRenderFooter = useCallback(() => {
    return <View style={{ height: FOOTER_HEIGHT }} />;
  }, []);

  const scrollY = useCurrentTabScrollY();
  const handleScroll = useCallback(
    (currentScrollY: number) => {
      if (currentScrollY <= 0) {
        onReachTopStatusChange?.(true);
      } else {
        onReachTopStatusChange?.(false);
      }
      setShowScrollIndicator(currentScrollY >= 89);
    },
    [onReachTopStatusChange, setShowScrollIndicator],
  );

  useAnimatedReaction(
    () => scrollY.value,
    currentScrollY => {
      runOnJS(handleScroll)(currentScrollY);
    },
  );

  return (
    <View style={styles.container}>
      <Tabs.FlatList
        data={dataList}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ItemSeparatorComponent={ListRenderSeparator}
        ListFooterComponent={ListRenderFooter}
        showsVerticalScrollIndicator={showScrollIndicator}
        showsHorizontalScrollIndicator={false}
        style={[styles.bgContainer, styles.list]}
        refreshControl={
          <RefreshControl
            style={styles.bgContainer}
            onRefresh={handleRefresh}
            refreshing={false}
          />
        }
      />
    </View>
  );
};

const getStyles = createGetStyles2024(ctx => ({
  container: {
    flex: 1,
    paddingTop: 10,
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
    backgroundColor: ctx.colors2024['neutral-bg-gray'],
    // paddingRight: 8,
    height: ASSETS_SECTION_HEADER,
  },
  buttonHeader: {
    backgroundColor: ctx.colors2024['neutral-bg-1'],
  },
  assetHeader: {
    backgroundColor: ctx.colors2024['neutral-bg-gray'],
    height: ASSETS_SECTION_HEADER,
    paddingBottom: 8,
    paddingLeft: 12 + 16,
    paddingRight: 16,
    width: '100%',
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
  emptyAssets: {
    //backgroundColor: 'transparent',
    //height: '100%',
    //marginTop: -100,
  },
}));
