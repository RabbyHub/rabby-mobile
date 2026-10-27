import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { type LayoutChangeEvent, ScrollView, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Skeleton } from '@rneui/themed';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/Typography';
import type { Account } from '@/core/startupServices/preference';
import { useTheme2024 } from '@/hooks/theme';
import { useSafeSizes } from '@/hooks/useAppLayout';
import type {
  GetNestedScreenRouteProp,
  TransactionNavigatorParamList,
} from '@/navigation-type';
import useTokenList from '@/store/tokens';
import { createGetStyles2024 } from '@/utils/styles';
import { MemeEmptyState } from '../components/MemeEmptyState';
import { useMemeHoldings } from '../data/memeHoldingsStore';
import { toBuyExecLegs } from '../engine/execLegs';
import { tokenKey } from '../engine/keys';
import { usePaymentAssets } from '../hooks/usePaymentAssets';
import { pushMemeCoinExecute } from '../navigation';
import {
  canConfirmBuy,
  DEFAULT_BUY_AMOUNT_USD,
  DEFAULT_MAX_PRICE_IMPACT_PCT,
  getBuySummary,
  type MaxPriceImpactPct,
  parseBuyAmount,
  pickTokenLogos,
} from '../ui/helpers';
import { useMemeCoinAccount } from '../ui/useMemeCoinAccount';
import { BuyAmountCard } from './BuyAmountCard';
import { BuySummaryBar } from './BuySummaryBar';
import {
  PAYMENT_ROW_GAP,
  PAYMENT_ROW_HEIGHT,
  PaymentAssetRow,
} from './PaymentAssetRow';

type BuyMemes = TransactionNavigatorParamList['MemeCoinBuy']['memes'];

const SKELETON_ROWS = 3;
const SCROLL_MARGIN = 16;

const MemeCoinBuyContent = ({
  account,
  memes,
}: {
  account: Account;
  memes: BuyMemes;
}) => {
  const { t } = useTranslation();
  const { styles } = useTheme2024({ getStyle });
  const { safeOffHeader } = useSafeSizes();

  const [amountText, setAmountText] = useState(
    DEFAULT_BUY_AMOUNT_USD.toFixed(2),
  );
  const [maxPriceImpactPct, setMaxPriceImpactPct] = useState<MaxPriceImpactPct>(
    DEFAULT_MAX_PRICE_IMPACT_PCT,
  );
  const amountUsd = parseBuyAmount(amountText);

  const { holdings } = useMemeHoldings(account.address);
  const tokens = useTokenList(
    s => s.tokenListMap[account.address.toLowerCase()],
  );

  // The engine hook takes MemeTarget[]; memoized so its input stays stable.
  const memeTargets = useMemo(
    () =>
      memes.map(({ id, chain, symbol, marketCap }) => ({
        id,
        chain,
        symbol,
        marketCap,
      })),
    [memes],
  );
  const memeTokenKeys = useMemo(
    () =>
      new Set([
        ...holdings.map(h => tokenKey(h.meme)),
        ...memes.map(m => tokenKey(m)),
      ]),
    [holdings, memes],
  );

  const { assets, selectedKeys, toggle, plan, ready } = usePaymentAssets({
    account,
    memes: memeTargets,
    memeTokenKeys,
    amountUsd: amountUsd ?? 0,
  });

  const logoByKey = useMemo(() => {
    const map = new Map<string, string>();
    (tokens || []).forEach(token => map.set(tokenKey(token), token.logo_url));
    memes.forEach(meme => map.set(tokenKey(meme), meme.logoUrl));
    return map;
  }, [tokens, memes]);

  const selectedTotalUsd = useMemo(
    () =>
      assets
        .filter(a => selectedKeys.includes(tokenKey(a)))
        .reduce((sum, a) => sum + a.usdValue, 0),
    [assets, selectedKeys],
  );

  const summary = getBuySummary({
    amountUsd: amountUsd ?? 0,
    selectedCount: selectedKeys.length,
    plan,
  });
  const confirmDisabled = !canConfirmBuy({ ready, amountUsd, plan });

  // The default picks can sit below the fold (a cross-chain asset ranks after
  // same-chain dust), so bring the first hidden one into view; a manual pick
  // never scrolls.
  const scrollRef = useRef<ScrollView>(null);
  const scrollYRef = useRef(0);
  const viewportHeightRef = useRef(0);
  const listYRef = useRef<number | null>(null);
  const pendingScrollKeysRef = useRef<string[] | null>(null);
  const lastAutoPickRef = useRef('');
  const manualPickRef = useRef(false);

  const handleToggle = useCallback(
    (key: string) => {
      manualPickRef.current = true;
      toggle(key);
    },
    [toggle],
  );

  const flushAutoScroll = useCallback(() => {
    const keys = pendingScrollKeysRef.current;
    const listY = listYRef.current;
    const viewportHeight = viewportHeightRef.current;
    if (!keys || listY === null || !viewportHeight) {
      return;
    }
    pendingScrollKeysRef.current = null;
    const viewTop = scrollYRef.current;
    const viewBottom = viewTop + viewportHeight;
    for (const [index, asset] of assets.entries()) {
      if (!keys.includes(tokenKey(asset))) {
        continue;
      }
      const top = listY + index * (PAYMENT_ROW_HEIGHT + PAYMENT_ROW_GAP);
      const bottom = top + PAYMENT_ROW_HEIGHT;
      if (bottom > viewBottom) {
        scrollRef.current?.scrollTo({
          y: bottom - viewportHeight + SCROLL_MARGIN,
        });
        return;
      }
      if (top < viewTop) {
        scrollRef.current?.scrollTo({ y: Math.max(0, top - SCROLL_MARGIN) });
        return;
      }
    }
  }, [assets]);

  useEffect(() => {
    if (!ready || manualPickRef.current) {
      return;
    }
    const pick = selectedKeys.join('|');
    if (pick === lastAutoPickRef.current) {
      return;
    }
    lastAutoPickRef.current = pick;
    if (!selectedKeys.length) {
      return;
    }
    pendingScrollKeysRef.current = selectedKeys;
    // wait a frame so the rows just rendered are laid out
    const frame = requestAnimationFrame(flushAutoScroll);
    return () => cancelAnimationFrame(frame);
  }, [ready, selectedKeys, flushAutoScroll]);

  const handleListLayout = useCallback(
    (e: LayoutChangeEvent) => {
      listYRef.current = e.nativeEvent.layout.y;
      flushAutoScroll();
    },
    [flushAutoScroll],
  );

  const handleConfirm = useCallback(() => {
    const legs = toBuyExecLegs(plan.legs);
    pushMemeCoinExecute({
      accountAddress: account.address,
      mode: 'buy',
      legs,
      maxPriceImpactPct,
      tokenLogos: pickTokenLogos(
        legs.flatMap(leg => [leg.pay, leg.receive]),
        logoByKey,
      ),
    });
  }, [account.address, logoByKey, maxPriceImpactPct, plan.legs]);

  let paymentList: React.ReactNode;
  if (!ready) {
    paymentList = Array.from({ length: SKELETON_ROWS }).map((_, index) => (
      <Skeleton
        key={index}
        height={PAYMENT_ROW_HEIGHT}
        style={styles.skeletonRow}
      />
    ));
  } else if (!assets.length) {
    paymentList = <MemeEmptyState text={t('page.memeCoin.buy.noAssets')} />;
  } else {
    paymentList = assets.map(asset => {
      const key = tokenKey(asset);
      const selected = selectedKeys.includes(key);
      return (
        <PaymentAssetRow
          key={key}
          itemKey={key}
          logoUrl={logoByKey.get(key) || ''}
          chain={asset.chain}
          symbol={asset.symbol}
          usdValue={asset.usdValue}
          estPaymentUsd={selected ? plan.paymentBySource[key] ?? 0 : undefined}
          selected={selected}
          onPress={handleToggle}
        />
      );
    });
  }

  return (
    <View style={[styles.screen, { paddingTop: safeOffHeader }]}>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        scrollEventThrottle={16}
        onScroll={e => {
          scrollYRef.current = e.nativeEvent.contentOffset.y;
        }}
        onLayout={e => {
          viewportHeightRef.current = e.nativeEvent.layout.height;
        }}>
        <BuyAmountCard
          amountText={amountText}
          amountUsd={amountUsd}
          onChangeAmount={setAmountText}
          memes={memes}
        />
        <Text style={styles.sectionTitle}>
          {t('page.memeCoin.buy.selectAssets')}
        </Text>
        <View onLayout={handleListLayout}>{paymentList}</View>
      </ScrollView>
      <BuySummaryBar
        selectedTotalUsd={selectedTotalUsd}
        summary={summary}
        maxPriceImpactPct={maxPriceImpactPct}
        onMaxPriceImpactChange={setMaxPriceImpactPct}
        confirmDisabled={confirmDisabled}
        onConfirm={handleConfirm}
      />
    </View>
  );
};

export const MemeCoinBuyScreen = () => {
  const { styles } = useTheme2024({ getStyle });
  const navigation = useNavigation();
  const route =
    useRoute<
      GetNestedScreenRouteProp<'TransactionNavigatorParamList', 'MemeCoinBuy'>
    >();
  const { accountAddress, memes } = route.params;
  const account = useMemeCoinAccount(accountAddress, () => navigation.goBack());

  if (!account) {
    return <View style={styles.screen} />;
  }
  return <MemeCoinBuyContent account={account} memes={memes} />;
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  screen: {
    flex: 1,
    backgroundColor: colors2024['neutral-bg-0'],
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  sectionTitle: {
    marginTop: 20,
    marginBottom: 8,
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '900',
    color: colors2024['neutral-title-1'],
  },
  skeletonRow: {
    width: '100%',
    marginBottom: 8,
    borderRadius: 14,
  },
}));
