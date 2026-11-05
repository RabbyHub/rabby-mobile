import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Keyboard, KeyboardAvoidingView, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Skeleton } from '@rneui/themed';
import { useMemoizedFn } from 'ahooks';
import { useTranslation } from 'react-i18next';
import {
  AndroidSoftInputModes,
  KeyboardController,
} from 'react-native-keyboard-controller';
import { AccountSwitcherModal } from '@/components/AccountSwitcher/Modal';
import { Text } from '@/components/Typography';
import { toast } from '@/components2024/Toast';
import { IS_IOS } from '@/core/native/utils';
import { useSceneAccountInfo } from '@/hooks/accountsSwitcher';
import { useTheme2024 } from '@/hooks/theme';
import { useSafeSizes } from '@/hooks/useAppLayout';
import type { Account } from '@/types/account';
import { isAccountSupportDirectSign } from '@/utils/account';
import { formatUsdValue } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import { BalanceCard } from '../components/BalanceCard';
import { HoldingsPill } from '../components/HoldingsPill';
import { MemeEmptyState } from '../components/MemeEmptyState';
import { MEME_ROW_HEIGHT, MemeTokenRow } from '../components/MemeTokenRow';
import {
  refreshMemeHoldings,
  useMemeHoldings,
} from '../data/memeHoldingsStore';
import {
  loadMoreMemeMarket,
  refreshMemeMarket,
  useMemeMarketStore,
} from '../data/memeMarketStore';
import { refreshMemePnl, useMemePnl } from '../data/memePnlStore';
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
  parseBuyAmount,
  toSellHoldings,
} from '../ui/helpers';
import { getChainNativeToken } from '../ui/nativeToken';
import {
  dismissKeyboardThen,
  MemeCoinHomeBottomBar,
  useKeyboardVisible,
} from './MemeCoinHomeBottomBar';

type HomeMode = 'market' | 'holdings';

type HomeRow = {
  key: string;
  meme: MemeToken;
  marketCap: number | null;
  /** holdings mode only */
  valueUsd: number | null;
};

const SKELETON_ROWS = 6;

const NO_MARKET_SELECTION: Record<string, MemeMarketItem> = {};
const NO_HOLDING_KEYS: string[] = [];

const keyExtractor = (row: HomeRow) => row.key;

export const MemeCoinHomeScreen = () => {
  const { t } = useTranslation();
  const { styles } = useTheme2024({ getStyle });
  const { safeOffHeader } = useSafeSizes();
  const keyboardVisible = useKeyboardVisible();
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
  const pnl = useMemePnl(address);

  const [mode, setMode] = useState<HomeMode>('market');
  const [keyword, setKeyword] = useState('');
  const [searching, setSearching] = useState(false);
  const [amountText, setAmountText] = useState('');
  const amountUsd = parseBuyAmount(amountText);
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
    setAmountText('');
  }, []);

  const cancelSelection = useCallback(() => {
    dismissKeyboardThen(clearSelection);
  }, [clearSelection]);

  useEffect(() => {
    refreshMemeMarket();
  }, []);

  const refreshHoldings = useCallback(() => {
    if (address) {
      refreshMemeHoldings(address);
      refreshMemePnl(address);
    }
  }, [address]);

  useEffect(() => {
    clearSelection();
    refreshHoldings();
  }, [clearSelection, refreshHoldings]);

  useFocusEffect(
    useCallback(() => {
      if (!consumeMemeCoinHomeReset()) {
        return;
      }
      Keyboard.dismiss();
      setMode('market');
      setKeyword('');
      setSearching(false);
      clearSelection();
      refreshHoldings();
    }, [clearSelection, refreshHoldings]),
  );

  // Android pans the whole window by default (header slides off). The app is
  // edge-to-edge, so the system never resizes: stop the pan and let the
  // padding KeyboardAvoidingView lift the bottom bar instead. Its Android hide
  // event leaves a navigation-bar-high padding, so padding is on only while
  // the keyboard is up.
  useFocusEffect(
    useCallback(() => {
      if (IS_IOS) {
        return;
      }
      KeyboardController.setInputMode(
        AndroidSoftInputModes.SOFT_INPUT_ADJUST_NOTHING,
      );
      return () => KeyboardController.setDefaultMode();
    }, []),
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
            marketCap: meme.marketCap,
            valueUsd: null,
          }))
        : holdings.map(h => ({
            key: tokenKey(h.meme),
            meme: h.meme,
            marketCap: h.marketCap,
            valueUsd: h.valueUsd,
          })),
    [mode, marketList, holdings],
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
    setMode(mode === 'market' ? 'holdings' : 'market');
    setKeyword('');
    setSearching(false);
    clearSelection();
  }, [clearSelection, mode]);

  const startSearch = useCallback(() => setSearching(true), []);

  const cancelSearch = useCallback(() => {
    setKeyword('');
    dismissKeyboardThen(() => setSearching(false));
  }, []);

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
      toast.error(t('page.memeCoin.unsupportedAddressType'));
      return false;
    }
    return true;
  }, [account, t]);

  const getAccountDisabledTips = useCallback(
    (item: Account) =>
      isAccountSupportDirectSign(item.type)
        ? undefined
        : t('page.memeCoin.unsupportedAddressType'),
    [t],
  );

  const handleBuy = useCallback(() => {
    if (amountUsd === null || !account || !isSupportedAccount()) {
      return;
    }
    Keyboard.dismiss();
    pushMemeCoinBuy({
      accountAddress: account.address,
      amountUsd,
      memes: Object.values(selectedMarket).map(m => ({
        id: m.id,
        chain: m.chain,
        symbol: m.symbol,
        marketCap: m.marketCap,
        logoUrl: m.logoUrl,
      })),
    });
  }, [account, amountUsd, isSupportedAccount, selectedMarket]);

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
          item.marketCap === null ? '--' : formatMarketCapUsd(item.marketCap)
        }
        change24h={item.meme.change24h}
        holdingValueText={
          item.valueUsd === null ? undefined : formatUsdValue(item.valueUsd)
        }
        selected={selectedSet.has(item.key)}
        onPress={toggle}
      />
    ),
    [selectedSet, toggle],
  );

  const rightLabel =
    mode === 'holdings'
      ? t('page.memeCoin.marketCapValue')
      : t('page.memeCoin.marketCap');
  // Figma drops the column label when a search finds nothing
  const noSearchMatch =
    hasKeyword && rows.length === 0 && !(mode === 'market' && searchLoading);

  const listHeader = (
    <View style={styles.listHeader}>
      <BalanceCard
        totalUsd={holdingsLoaded ? totalUsd : null}
        loading={!holdingsLoaded && !holdingsLoadFailed}
        pnl={pnl}
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
        {noSearchMatch ? null : (
          <Text style={styles.sectionLabel}>{rightLabel}</Text>
        )}
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
        onPress={refreshHoldings}
      />
    );
  } else {
    listEmpty = (
      <MemeEmptyState
        text={
          mode === 'holdings'
            ? t('page.memeCoin.noHoldings')
            : t('page.memeCoin.noMatch')
        }
      />
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { paddingTop: safeOffHeader }]}
      behavior={IS_IOS || keyboardVisible ? 'padding' : undefined}>
      <FlatList
        data={rows}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        extraData={selectedSet}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        contentContainerStyle={styles.listContent}
        // Search results stay tappable with the keyboard up; with a selection the
        // keyboard belongs to the amount field and a tap on the list only closes it.
        keyboardShouldPersistTaps={selectedCount > 0 ? 'never' : 'handled'}
        keyboardDismissMode="on-drag"
        initialNumToRender={10}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
      />
      <MemeCoinHomeBottomBar
        mode={mode}
        selectedCount={selectedCount}
        searching={searching}
        onStartSearch={startSearch}
        onCancelSearch={cancelSearch}
        keyword={keyword}
        onKeywordChange={setKeyword}
        amountText={amountText}
        onChangeAmount={setAmountText}
        buyDisabled={amountUsd === null}
        maxPriceImpactPct={maxPriceImpactPct}
        onMaxPriceImpactChange={setMaxPriceImpactPct}
        onBuy={handleBuy}
        onSell={handleSell}
        onCancelSelection={cancelSelection}
      />
      <AccountSwitcherModal
        forScene="MakeTransactionAbout"
        inScreen
        getAccountDisabledTips={getAccountDisabledTips}
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
    paddingHorizontal: 12,
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
    paddingLeft: 8,
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
    color: colors2024['neutral-secondary'],
  },
  skeletonRow: {
    width: '100%',
    marginBottom: 8,
    borderRadius: 14,
  },
}));
