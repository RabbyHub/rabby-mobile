import React, { useEffect, useMemo, useRef } from 'react';
import { DexQuoteItem, QuoteItemProps } from './QuoteItem';
import {
  TCexQuoteData,
  TDexQuoteData,
  useSwapSettings,
  useSwapSettingsVisible,
} from '../hooks';
import BigNumber from 'bignumber.js';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { CEX, DEX, DEX_WITH_WRAP } from '@/constant/swap';
import { useSetAtom } from 'jotai';
import { refreshIdAtom } from '../hooks/atom';
import { AppBottomSheetModal } from '@/components';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { BottomSheetModalMethods } from '@gorhom/bottom-sheet/src/types';
import { Radio } from '@/components/Radio';
import { RcIconSwapChecked, RcIconSwapUnchecked } from '@/assets/icons/swap';
import { createGetStyles } from '@/utils/styles';
import { useThemeColors } from '@/hooks/theme';
import TouchableItem from '@/components/Touchable/TouchableItem';
import { isSwapWrapToken } from '../utils';
import { QuoteListLoading, QuoteLoading } from './loading';
import { getTokenSymbol } from '@/utils/token';
import { CexQuoteItem } from './CexQuoteItem';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SwapRefreshBtn } from './SwapRefreshBtn';

const exchangeCount = Object.keys(DEX).length + Object.keys(CEX).length;

interface QuotesProps
  extends Omit<
    QuoteItemProps,
    | 'bestQuoteAmount'
    | 'bestQuoteGasUsd'
    | 'name'
    | 'quote'
    | 'active'
    | 'isBestQuote'
    | 'quoteProviderInfo'
  > {
  list?: (TCexQuoteData | TDexQuoteData)[];
  activeName?: string;
  visible: boolean;
  onClose: () => void;
}

export const Quotes = ({
  list,
  activeName,
  inSufficient,
  ...other
}: QuotesProps) => {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const { t } = useTranslation();
  const { swapViewList, swapTradeList, sortIncludeGasFee } = useSwapSettings();

  const viewCount = useMemo(() => {
    if (swapViewList) {
      const DexList = Object.keys(DEX);
      const CEXList = Object.keys(CEX);

      const availableList = [...DexList, ...CEXList];

      return (
        exchangeCount -
        Object.entries(swapViewList).filter(
          ([name, e]) => e === false && availableList.includes(name),
        ).length
      );
    }
    return exchangeCount;
  }, [swapViewList]);

  const tradeCount = useMemo(() => {
    if (swapTradeList) {
      const TradeDexList = Object.keys(DEX);
      return Object.entries(swapTradeList).filter(
        ([name, enable]) => enable === true && TradeDexList.includes(name),
      ).length;
    }
    return 0;
  }, [swapTradeList]);

  const { setVisible: setSettings } = useSwapSettingsVisible();
  const openSettings = React.useCallback(() => {
    setSettings(true);
  }, [setSettings]);
  const sortedList = useMemo(
    () => [
      ...(list?.sort((a, b) => {
        const getNumber = (quote: typeof a) => {
          const price = other.receiveToken.price ? other.receiveToken.price : 1;
          if (quote.isDex) {
            if (inSufficient) {
              return new BigNumber(quote.data?.toTokenAmount || 0)
                .div(
                  10 **
                    (quote.data?.toTokenDecimals ||
                      other.receiveToken.decimals),
                )
                .times(price);
            }
            if (!quote.preExecResult) {
              return new BigNumber(Number.MIN_SAFE_INTEGER);
            }

            if (sortIncludeGasFee) {
              return new BigNumber(
                quote?.preExecResult.swapPreExecTx.balance_change
                  .receive_token_list?.[0]?.amount || 0,
              )
                .times(price)
                .minus(quote?.preExecResult?.gasUsdValue || 0);
            }

            return new BigNumber(
              quote?.preExecResult.swapPreExecTx.balance_change
                .receive_token_list?.[0]?.amount || 0,
            ).times(price);
          }

          return quote?.data?.receive_token
            ? new BigNumber(quote?.data?.receive_token?.amount).times(price)
            : new BigNumber(Number.MIN_SAFE_INTEGER);
        };
        return getNumber(b).minus(getNumber(a)).toNumber();
      }) || []),
    ],
    [
      inSufficient,
      list,
      other.receiveToken.decimals,
      other?.receiveToken?.price,
      sortIncludeGasFee,
    ],
  );

  const [bestQuoteAmount, bestQuoteGasUsd] = useMemo(() => {
    const bestQuote = sortedList?.[0];

    return [
      (bestQuote?.isDex
        ? inSufficient
          ? new BigNumber(bestQuote.data?.toTokenAmount || 0)
              .div(
                10 **
                  (bestQuote?.data?.toTokenDecimals ||
                    other.receiveToken.decimals ||
                    1),
              )
              .toString(10)
          : bestQuote?.preExecResult?.swapPreExecTx.balance_change
              .receive_token_list[0]?.amount
        : new BigNumber(bestQuote?.data?.receive_token.amount || '0').toString(
            10,
          )) || '0',
      bestQuote?.isDex ? bestQuote.preExecResult?.gasUsdValue || '0' : '0',
    ];
  }, [inSufficient, other?.receiveToken?.decimals, sortedList]);

  const fetchedList = useMemo(() => list?.map(e => e.name) || [], [list]);

  const noCex = useMemo(() => {
    return Object.keys(CEX).every(e => swapViewList?.[e] === false);
  }, [swapViewList]);

  if (isSwapWrapToken(other.payToken.id, other.receiveToken.id, other.chain)) {
    const dex = sortedList.find(e => e.isDex) as TDexQuoteData | undefined;

    return (
      <View style={{ paddingHorizontal: 20 }}>
        {dex ? (
          <DexQuoteItem
            inSufficient={inSufficient}
            preExecResult={dex?.preExecResult}
            quote={dex?.data}
            name={dex?.name}
            isBestQuote
            bestQuoteAmount={`${
              dex?.preExecResult?.swapPreExecTx.balance_change
                .receive_token_list[0]?.amount || '0'
            }`}
            bestQuoteGasUsd={bestQuoteGasUsd}
            active={activeName === dex?.name}
            isLoading={dex.loading}
            quoteProviderInfo={{
              name: t('page.swap.wrap-contract'),
              logo: other?.receiveToken?.logo_url,
            }}
            {...other}
          />
        ) : (
          <QuoteLoading
            name={t('page.swap.wrap-contract')}
            logo={other?.receiveToken?.logo_url}
          />
        )}

        <Text
          style={{
            fontSize: 13,
            fontWeight: '400',
            color: colors['neutral-body'],
            paddingTop: 20,
          }}>
          {t('page.swap.directlySwap', {
            symbol: getTokenSymbol(other.payToken),
          })}
        </Text>
      </View>
    );
  }
  return (
    <View style={{ paddingHorizontal: 20 }}>
      <View style={{ gap: 12 }}>
        {sortedList.map((params, idx) => {
          const { name, data, isDex } = params;
          if (!isDex) {
            return null;
          }
          return (
            <DexQuoteItem
              key={name}
              inSufficient={inSufficient}
              preExecResult={params.preExecResult}
              quote={data as unknown as any}
              name={name}
              isBestQuote={idx === 0}
              bestQuoteAmount={`${bestQuoteAmount}`}
              bestQuoteGasUsd={bestQuoteGasUsd}
              active={activeName === name}
              isLoading={params.loading}
              quoteProviderInfo={
                DEX_WITH_WRAP[name as keyof typeof DEX_WITH_WRAP]
              }
              {...other}
            />
          );
        })}
        <QuoteListLoading fetchedList={fetchedList} />
      </View>
      {!noCex && (
        <>
          <Text style={styles.cexTip}>{t('page.swap.rates-from-cex')}</Text>

          <View style={styles.cexList}>
            {sortedList.map((params, idx) => {
              const { name, data, isDex } = params;
              if (isDex) {
                return null;
              }
              return (
                <>
                  <CexQuoteItem
                    key={name}
                    name={name}
                    data={data as unknown as any}
                    bestQuoteAmount={`${bestQuoteAmount}`}
                    bestQuoteGasUsd={bestQuoteGasUsd}
                    isBestQuote={idx === 0}
                    isLoading={params.loading}
                    inSufficient={inSufficient}
                  />
                </>
              );
            })}
            <QuoteListLoading fetchedList={fetchedList} isCex />
          </View>
        </>
      )}

      <View style={styles.foot}>
        <Text style={styles.footText}>
          {t('page.swap.tradingSettingTips', { viewCount, tradeCount })}
        </Text>

        <TouchableItem onPress={openSettings}>
          <Text style={styles.edit}>{t('page.swap.edit')}</Text>
        </TouchableItem>
      </View>
    </View>
  );
};

export const QuoteList = (props: QuotesProps) => {
  const { visible, onClose } = props;
  const bottomRef = useRef<BottomSheetModalMethods>(null);

  const refresh = useSetAtom(refreshIdAtom);

  const refreshQuote = React.useCallback(() => {
    refresh(e => e + 1);
  }, [refresh]);

  const { t } = useTranslation();

  const { sortIncludeGasFee, setSwapSortIncludeGasFee } = useSwapSettings();

  useEffect(() => {
    if (visible) {
      bottomRef.current?.present();
    } else {
      bottomRef.current?.dismiss();
    }
  }, [visible]);

  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  return (
    <AppBottomSheetModal
      snapPoints={[580]}
      ref={bottomRef}
      onDismiss={onClose}
      enableDismissOnClose
      handleStyle={styles.bottomBg}
      backgroundStyle={styles.bottomBg}>
      <BottomSheetScrollView style={styles.flex1}>
        <View style={styles.headerContainer}>
          <Text style={styles.headerText}>
            {t('page.swap.the-following-swap-rates-are-found')}
          </Text>
          <SwapRefreshBtn onPress={refreshQuote} />

          <Radio
            checked={!!sortIncludeGasFee}
            onPress={() => setSwapSortIncludeGasFee(!sortIncludeGasFee)}
            title={t('page.swap.sort-with-gas')}
            checkedIcon={<RcIconSwapChecked width={16} height={16} />}
            uncheckedIcon={<RcIconSwapUnchecked width={16} height={16} />}
            textStyle={styles.refreshText}
            right={true}
            containerStyle={styles.radioContainer}
          />
        </View>
        <Quotes {...props} />
      </BottomSheetScrollView>
    </AppBottomSheetModal>
  );
};

const getStyles = createGetStyles(colors => ({
  bottomBg: {
    backgroundColor: colors['neutral-bg-2'],
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 20,
    paddingLeft: 20,
    alignSelf: 'stretch',
    gap: 3,
  },

  headerText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors['neutral-title-1'],
  },
  refreshText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors['neutral-body'],
  },
  edit: {
    color: colors['blue-default'],
    fontSize: 13,
    paddingLeft: 4,
    textDecorationLine: 'underline',
  },
  cexTip: {
    color: colors['neutral-foot'],
    fontSize: 12,
    marginTop: 20,
    marginBottom: 8,
  },
  cexList: {
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors['neutral-line'],
    paddingHorizontal: 12,
  },

  foot: {
    paddingTop: 16,
    flexDirection: 'row',
    paddingBottom: 20,
    justifyContent: 'center',
  },

  footText: { color: colors['neutral-foot'], fontSize: 13 },

  flex1: {
    flex: 1,
  },
  radioContainer: {
    margin: 0,
    padding: 0,
  },
}));
