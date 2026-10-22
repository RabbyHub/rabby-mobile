import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Skeleton } from '@rneui/themed';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/Typography';
import type { Account } from '@/core/startupServices/preference';
import { useTheme2024 } from '@/hooks/theme';
import type {
  GetNestedScreenRouteProp,
  TransactionNavigatorParamList,
} from '@/navigation-type';
import useTokenList from '@/store/tokens';
import { createGetStyles2024 } from '@/utils/styles';
import { MemeEmptyState } from '../components/MemeEmptyState';
import { useMemeMarketStore } from '../data/memeMarketStore';
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
import { PaymentAssetRow } from './PaymentAssetRow';

type BuyMemes = TransactionNavigatorParamList['MemeCoinBuy']['memes'];

const SKELETON_ROWS = 3;

const MemeCoinBuyContent = ({
  account,
  memes,
}: {
  account: Account;
  memes: BuyMemes;
}) => {
  const { t } = useTranslation();
  const { styles } = useTheme2024({ getStyle });

  const [amountText, setAmountText] = useState(
    DEFAULT_BUY_AMOUNT_USD.toFixed(2),
  );
  const [maxPriceImpactPct, setMaxPriceImpactPct] = useState<MaxPriceImpactPct>(
    DEFAULT_MAX_PRICE_IMPACT_PCT,
  );
  const amountUsd = parseBuyAmount(amountText);

  const market = useMemeMarketStore(s => s.list);
  const tokens = useTokenList(
    s => s.tokenListMap[account.address.toLowerCase()],
  );

  // Strip logoUrl so planned legs (and the execute params) carry plain TokenRefs.
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
        ...market.map(m => tokenKey(m)),
        ...memes.map(m => tokenKey(m)),
      ]),
    [market, memes],
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
      <Skeleton key={index} height={70} style={styles.skeletonRow} />
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
          onPress={toggle}
        />
      );
    });
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag">
        <BuyAmountCard
          amountText={amountText}
          invalid={amountUsd === null}
          onChangeAmount={setAmountText}
          memes={memes}
        />
        <Text style={styles.sectionTitle}>
          {t('page.memeCoin.buy.selectAssets')}
        </Text>
        {paymentList}
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
