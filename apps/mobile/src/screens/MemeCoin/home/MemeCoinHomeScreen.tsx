import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Skeleton } from '@rneui/themed';
import { useMemoizedFn } from 'ahooks';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/Typography';
import { toast } from '@/components2024/Toast';
import { IS_IOS } from '@/core/native/utils';
import { useSceneAccountInfo } from '@/hooks/accountsSwitcher';
import { useTheme2024 } from '@/hooks/theme';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { isAccountSupportDirectSign } from '@/utils/account';
import { formatUsdValue } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import { BalanceCard } from '../components/BalanceCard';
import { HoldingsPill } from '../components/HoldingsPill';
import { MemeEmptyState } from '../components/MemeEmptyState';
import { MEME_ROW_HEIGHT, MemeTokenRow } from '../components/MemeTokenRow';
import { filterBySymbolPrefix } from '../data/market';
import {
  refreshMemeHoldings,
  useMemeHoldings,
} from '../data/memeHoldingsStore';
import {
  loadMoreMemeMarket,
  refreshMemeMarket,
  useMemeMarketStore,
} from '../data/memeMarketStore';
import type { MemeMarketItem, MemeToken } from '../data/types';
import { useMemeSearch } from '../data/useMemeSearch';
import { toSellExecLegs } from '../engine/execLegs';
import { tokenKey } from '../engine/keys';
import {
  consumeMemeCoinHomeReset,
  pushMemeCoinBuy,
  pushMemeCoinExecute,
} from '../navigation';
import {
  DEFAULT_MAX_PRICE_IMPACT_PCT,
  formatMarketCapUsd,
  type MaxPriceImpactPct,
  toSellHoldings,
} from '../ui/helpers';
import { getChainNativeToken } from '../ui/nativeToken';
import { MemeCoinHomeBottomBar } from './MemeCoinHomeBottomBar';

type HomeMode = 'market' | 'holdings';

/** valueUsd is null in market mode (the row shows market cap instead) */
type HomeRow =
  | { key: string; meme: MemeMarketItem; valueUsd: null }
  | { key: string; meme: MemeToken; valueUsd: number };

const SKELETON_ROWS = 6;

const NO_MARKET_SELECTION: Record<string, MemeMarketItem> = {};
const NO_HOLDING_KEYS: string[] = [];

const keyExtractor = (row: HomeRow) => row.key;

export const MemeCoinHomeScreen = () => {
  const { t } = useTranslation();
  const { styles } = useTheme2024({ getStyle });
  const { safeOffHeader } = useSafeSizes();
  const { finalSceneCurrentAccount: account } = useSceneAccountInfo({
    forScene: 'MakeTransactionAbout',
  });
  const address = account?.address;

  const marketItems = useMemeMarketStore(s => s.items);
  const marketLoading = useMemeMarketStore(s => s.loading);
  const marketError = useMemeMarketStore(s => s.error);
  const {
    holdings,
    totalUsd,
    loaded: holdingsLoaded,
    loadFailed: holdingsLoadFailed,
  } = useMemeHoldings(address);

  const [mode, setMode] = useState<HomeMode>('market');
  const [keyword, setKeyword] = useState('');
  // market picks are snapshots: search results are not in the paged list
  const [selectedMarket, setSelectedMarket] =
    useState<Record<string, MemeMarketItem>>(NO_MARKET_SELECTION);
  const [selectedHoldingKeys, setSelectedHoldingKeys] =
    useState<string[]>(NO_HOLDING_KEYS);
  const [maxPriceImpactPct, setMaxPriceImpactPct] = useState<MaxPriceImpactPct>(
    DEFAULT_MAX_PRICE_IMPACT_PCT,
  );

  const hasKeyword = !!keyword.trim();
  const {
    items: searchItems,
    loading: searchLoading,
    loadMore: loadMoreSearch,
  } = useMemeSearch(keyword, mode === 'market');
  const marketList = hasKeyword ? searchItems : marketItems;

  const clearSelection = useCallback(() => {
    setSelectedMarket(NO_MARKET_SELECTION);
    setSelectedHoldingKeys(NO_HOLDING_KEYS);
  }, []);

  useEffect(() => {
    refreshMemeMarket();
  }, []);

  useEffect(() => {
    clearSelection();
    if (address) {
      refreshMemeHoldings(address);
    }
  }, [address, clearSelection]);

  const retryHoldings = useCallback(() => {
    if (address) {
      refreshMemeHoldings(address);
    }
  }, [address]);

  useFocusEffect(
    useCallback(() => {
      if (!consumeMemeCoinHomeReset()) {
        return;
      }
      Keyboard.dismiss();
      setMode('market');
      setKeyword('');
      clearSelection();
      if (address) {
        refreshMemeHoldings(address);
      }
    }, [address, clearSelection]),
  );

  const selectedSet = useMemo(
    () =>
      new Set(
        mode === 'market' ? Object.keys(selectedMarket) : selectedHoldingKeys,
      ),
    [mode, selectedMarket, selectedHoldingKeys],
  );

  const rows = useMemo<HomeRow[]>(
    () =>
      mode === 'market'
        ? marketList.map(meme => ({
            key: tokenKey(meme),
            meme,
            valueUsd: null,
          }))
        : filterBySymbolPrefix(holdings, keyword, h => h.meme.symbol).map(
            h => ({
              key: tokenKey(h.meme),
              meme: h.meme,
              valueUsd: h.valueUsd,
            }),
          ),
    [mode, marketList, holdings, keyword],
  );

  const selectedHoldings = useMemo(() => {
    const keys = new Set(selectedHoldingKeys);
    return holdings.filter(h => keys.has(tokenKey(h.meme)));
  }, [holdings, selectedHoldingKeys]);
  const selectedCount =
    mode === 'market'
      ? Object.keys(selectedMarket).length
      : selectedHoldings.length;

  const holdingAvatars = useMemo(
    () =>
      holdings.map(h => ({ key: tokenKey(h.meme), logoUrl: h.meme.logoUrl })),
    [holdings],
  );

  const toggle = useMemoizedFn((key: string) => {
    if (mode === 'holdings') {
      setSelectedHoldingKeys(prev =>
        prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key],
      );
      return;
    }
    setSelectedMarket(prev => {
      if (prev[key]) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      const meme = marketList.find(m => tokenKey(m) === key);
      return meme ? { ...prev, [key]: meme } : prev;
    });
  });

  const switchMode = useCallback(() => {
    setMode(prev => (prev === 'market' ? 'holdings' : 'market'));
    setKeyword('');
    clearSelection();
  }, [clearSelection]);

  const handleEndReached = useCallback(() => {
    if (mode !== 'market') {
      return;
    }
    if (hasKeyword) {
      loadMoreSearch();
    } else {
      loadMoreMemeMarket();
    }
  }, [hasKeyword, loadMoreSearch, mode]);

  const isSupportedAccount = useCallback(() => {
    if (!account) {
      return false;
    }
    if (!isAccountSupportDirectSign(account.type)) {
      toast.error(t('page.memeCoin.unsupportedAccount'));
      return false;
    }
    return true;
  }, [account, t]);

  const handleBuy = useCallback(() => {
    if (!account || !isSupportedAccount()) {
      return;
    }
    pushMemeCoinBuy({
      accountAddress: account.address,
      memes: Object.values(selectedMarket).map(m => ({
        id: m.id,
        chain: m.chain,
        symbol: m.symbol,
        marketCap: m.marketCap,
        logoUrl: m.logoUrl,
      })),
    });
  }, [account, isSupportedAccount, selectedMarket]);

  const handleSell = useCallback(() => {
    if (!account || !isSupportedAccount()) {
      return;
    }
    const legs = toSellExecLegs(
      toSellHoldings(selectedHoldings, getChainNativeToken),
    );
    if (!legs.length) {
      return;
    }
    const tokenLogos: Record<string, string> = {};
    selectedHoldings.forEach(({ meme }) => {
      tokenLogos[tokenKey(meme)] = meme.logoUrl;
      const native = getChainNativeToken(meme.chain);
      if (native) {
        tokenLogos[tokenKey(native)] = native.logoUrl;
      }
    });
    pushMemeCoinExecute({
      accountAddress: account.address,
      mode: 'sell',
      legs,
      maxPriceImpactPct,
      tokenLogos,
    });
  }, [account, isSupportedAccount, maxPriceImpactPct, selectedHoldings]);

  const renderItem = useCallback(
    ({ item }: { item: HomeRow }) => (
      <MemeTokenRow
        itemKey={item.key}
        logoUrl={item.meme.logoUrl}
        chain={item.meme.chain}
        symbol={item.meme.symbol}
        address={item.meme.id}
        valueText={
          item.valueUsd === null
            ? formatMarketCapUsd(item.meme.marketCap)
            : formatUsdValue(item.valueUsd)
        }
        change24h={item.meme.change24h}
        selected={selectedSet.has(item.key)}
        onPress={toggle}
      />
    ),
    [selectedSet, toggle],
  );

  const rightLabel =
    selectedCount > 0
      ? t('page.memeCoin.clear')
      : mode === 'holdings'
      ? t('page.memeCoin.value')
      : t('page.memeCoin.marketCap');

  const listHeader = (
    <View style={styles.listHeader}>
      <BalanceCard
        totalUsd={holdingsLoaded ? totalUsd : null}
        loading={!holdingsLoaded && !holdingsLoadFailed}
      />
      {/* holdings mode keeps the pill: it is the way back to the market */}
      {mode === 'holdings' || holdings.length > 0 ? (
        <HoldingsPill
          mode={mode}
          avatars={holdingAvatars}
          onPress={switchMode}
        />
      ) : null}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          {mode === 'market'
            ? t('page.memeCoin.marketTitle')
            : t('page.memeCoin.holdingsTitle')}
        </Text>
        <TouchableOpacity
          disabled={selectedCount === 0}
          onPress={clearSelection}
          hitSlop={8}>
          <Text
            style={
              selectedCount > 0 ? styles.sectionAction : styles.sectionLabel
            }>
            {rightLabel}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const marketEmpty =
    mode === 'market' && !hasKeyword && marketItems.length === 0;
  let listEmpty: React.ReactElement;
  if (
    mode === 'market'
      ? hasKeyword
        ? searchLoading
        : marketEmpty && marketLoading
      : !holdingsLoaded && !holdingsLoadFailed
  ) {
    listEmpty = (
      <View>
        {Array.from({ length: SKELETON_ROWS }).map((_, index) => (
          <Skeleton
            key={index}
            height={MEME_ROW_HEIGHT}
            style={styles.skeletonRow}
          />
        ))}
      </View>
    );
  } else if (marketEmpty && marketError) {
    listEmpty = (
      <MemeEmptyState
        text={t('page.memeCoin.loadFailed')}
        onPress={refreshMemeMarket}
      />
    );
  } else if (mode === 'holdings' && holdingsLoadFailed) {
    listEmpty = (
      <MemeEmptyState
        text={t('page.memeCoin.loadFailed')}
        onPress={retryHoldings}
      />
    );
  } else {
    listEmpty = (
      <MemeEmptyState
        text={
          mode === 'holdings' && !hasKeyword
            ? t('page.memeCoin.noHoldings')
            : t('page.memeCoin.noMatch')
        }
      />
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { paddingTop: safeOffHeader }]}
      behavior={IS_IOS ? 'padding' : undefined}>
      <FlatList
        data={rows}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        extraData={selectedSet}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={10}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
      />
      <MemeCoinHomeBottomBar
        mode={mode}
        selectedCount={selectedCount}
        keyword={keyword}
        onKeywordChange={setKeyword}
        maxPriceImpactPct={maxPriceImpactPct}
        onMaxPriceImpactChange={setMaxPriceImpactPct}
        onBuy={handleBuy}
        onSell={handleSell}
      />
    </KeyboardAvoidingView>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  screen: {
    flex: 1,
    backgroundColor: colors2024['neutral-bg-0'],
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  listHeader: {
    paddingTop: 12,
  },
  sectionHeader: {
    marginTop: 20,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '900',
    color: colors2024['neutral-title-1'],
  },
  sectionLabel: {
    paddingRight: 8,
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '400',
    color: colors2024['neutral-body'],
  },
  sectionAction: {
    paddingRight: 8,
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '400',
    color: colors2024['neutral-body'],
  },
  skeletonRow: {
    width: '100%',
    marginBottom: 8,
    borderRadius: 14,
  },
}));
