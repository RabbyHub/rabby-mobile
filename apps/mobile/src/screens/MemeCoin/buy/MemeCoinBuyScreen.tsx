import React, { useCallback, useMemo, useState } from 'react';
import { Keyboard, ScrollView, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
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
import { useMemeHoldings } from '../data/memeHoldingsStore';
import { toBuyExecLegs } from '../engine/execLegs';
import { tokenKey } from '../engine/keys';
import type { AllocationMode } from '../engine/types';
import { usePaymentAssets } from '../hooks/usePaymentAssets';
import { pushMemeCoinExecute } from '../navigation';
import {
  canConfirmBuy,
  DEFAULT_MAX_PRICE_IMPACT_PCT,
  getBuySummary,
  type MaxPriceImpactPct,
  parseBuyAmount,
  pickTokenLogos,
} from '../ui/helpers';
import { useMemeCoinAccount } from '../ui/useMemeCoinAccount';
import { BuyAmountCard } from './BuyAmountCard';
import { BuyPreviewBar } from './BuyPreviewBar';
import { PaymentTokenSelectSheet } from './PaymentTokenSelectSheet';
import { PaymentTokensSection } from './PaymentTokensSection';

type BuyMemes = TransactionNavigatorParamList['MemeCoinBuy']['memes'];

const MemeCoinBuyContent = ({
  account,
  memes,
  amountUsd,
}: {
  account: Account;
  memes: BuyMemes;
  amountUsd: number;
}) => {
  const { t } = useTranslation();
  const { styles } = useTheme2024({ getStyle });
  const { safeOffHeader } = useSafeSizes();

  const [amountText, setAmountText] = useState(amountUsd.toFixed(2));
  const [maxPriceImpactPct, setMaxPriceImpactPct] = useState<MaxPriceImpactPct>(
    DEFAULT_MAX_PRICE_IMPACT_PCT,
  );
  const [allocationMode, setAllocationMode] =
    useState<AllocationMode>('marketCap');
  const toggleAllocationMode = useCallback(
    () =>
      setAllocationMode(mode => (mode === 'marketCap' ? 'equal' : 'marketCap')),
    [],
  );
  // the page opens on the token picker
  const [sheetVisible, setSheetVisible] = useState(true);
  const closeSheet = useCallback(() => setSheetVisible(false), []);
  const openSheet = useCallback(() => {
    Keyboard.dismiss();
    setSheetVisible(true);
  }, []);
  const parsedAmountUsd = parseBuyAmount(amountText);

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

  const { assets, selectedAssets, selectedKeys, toggle, plan, listReady } =
    usePaymentAssets({
      account,
      memes: memeTargets,
      memeTokenKeys,
      amountUsd: parsedAmountUsd ?? 0,
      allocationMode,
    });

  const logoByKey = useMemo(() => {
    const map = new Map<string, string>();
    (tokens || []).forEach(token => map.set(tokenKey(token), token.logo_url));
    memes.forEach(meme => map.set(tokenKey(meme), meme.logoUrl));
    return map;
  }, [tokens, memes]);

  const summary = getBuySummary({
    amountUsd: parsedAmountUsd ?? 0,
    selectedCount: selectedKeys.length,
    plan,
  });
  const previewDisabled = !canConfirmBuy({
    amountUsd: parsedAmountUsd,
    plan,
  });

  const handlePreview = useCallback(() => {
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

  return (
    <View style={[styles.screen, { paddingTop: safeOffHeader }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag">
        <Text style={styles.amountTitle}>{t('page.memeCoin.buy.amount')}</Text>
        <BuyAmountCard
          amountText={amountText}
          amountUsd={parsedAmountUsd}
          onChangeAmount={setAmountText}
          memes={memes}
          allocationMode={allocationMode}
          onToggleAllocationMode={toggleAllocationMode}
        />
        <PaymentTokensSection
          selectedAssets={selectedAssets}
          paymentBySource={plan.paymentBySource}
          logoByKey={logoByKey}
          onSelectTokens={openSheet}
        />
      </ScrollView>
      <BuyPreviewBar
        summary={summary}
        maxPriceImpactPct={maxPriceImpactPct}
        onMaxPriceImpactChange={setMaxPriceImpactPct}
        disabled={previewDisabled}
        onPreview={handlePreview}
      />
      <PaymentTokenSelectSheet
        visible={sheetVisible}
        onClose={closeSheet}
        assets={assets}
        selectedKeys={selectedKeys}
        onToggle={toggle}
        listReady={listReady}
        paymentBySource={plan.paymentBySource}
        summary={summary}
        logoByKey={logoByKey}
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
  const { accountAddress, memes, amountUsd } = route.params;
  const account = useMemeCoinAccount(accountAddress, () => navigation.goBack());

  if (!account) {
    return <View style={styles.screen} />;
  }
  return (
    <MemeCoinBuyContent account={account} memes={memes} amountUsd={amountUsd} />
  );
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
    paddingHorizontal: 12,
    paddingBottom: 16,
  },
  amountTitle: {
    marginBottom: 8,
    paddingHorizontal: 8,
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '900',
    color: colors2024['neutral-title-1'],
  },
}));
