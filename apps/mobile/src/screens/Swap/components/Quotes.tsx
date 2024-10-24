import {
  RcIconSwapChecked,
  RcIconSwapHiddenArrow,
  RcIconSwapUnchecked,
} from '@/assets/icons/swap';
import { AppBottomSheetModal } from '@/components';
import { Radio } from '@/components/Radio';
import { DEX_WITH_WRAP } from '@/constant/swap';
import { useThemeColors } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import { getTokenSymbol } from '@/utils/token';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { BottomSheetModalMethods } from '@gorhom/bottom-sheet/src/types';
import BigNumber from 'bignumber.js';
import { useSetAtom } from 'jotai';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  TDexQuoteData,
  useSwapSettings,
  useSwapSupportedDexList,
  useSwapViewDexIdList,
} from '../hooks';
import { refreshIdAtom } from '../hooks/atom';
import { isSwapWrapToken } from '../utils';
import { QuoteListLoading, QuoteLoading } from './loading';
import { DexQuoteItem, QuoteItemProps } from './QuoteItem';
import { SwapRefreshBtn } from './SwapRefreshBtn';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  list?: TDexQuoteData[];
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

  const { t } = useTranslation();
  const { sortIncludeGasFee } = useSwapSettings();

  const sortedList = useMemo(
    () => [
      ...(list?.sort((a, b) => {
        const getNumber = (quote: typeof a) => {
          const price = other.receiveToken.price ? other.receiveToken.price : 0;
          if (inSufficient) {
            return new BigNumber(quote.data?.toTokenAmount || 0)
              .div(
                10 **
                  (quote.data?.toTokenDecimals || other.receiveToken.decimals),
              )
              .times(price);
          }
          if (!quote.preExecResult) {
            return new BigNumber(Number.MIN_SAFE_INTEGER);
          }
          const receiveTokenAmount =
            quote?.preExecResult.swapPreExecTx.balance_change.receive_token_list.find(
              item => isSameAddress(item.id, other.receiveToken.id),
            )?.amount || 0;
          if (sortIncludeGasFee) {
            return new BigNumber(receiveTokenAmount)
              .times(price)
              .minus(quote?.preExecResult?.gasUsdValue || 0);
          }

          return new BigNumber(receiveTokenAmount).times(price);
        };
        return getNumber(b).minus(getNumber(a)).toNumber();
      }) || []),
    ],
    [inSufficient, list, other.receiveToken, sortIncludeGasFee],
  );

  const [hiddenError, setHiddenError] = useState(true);
  const [errorQuoteDEXs, setErrorQuoteDEXs] = useState<string[]>([]);
  const ViewDexIdList = useSwapViewDexIdList();

  const [bestQuoteAmount, bestQuoteGasUsd] = useMemo(() => {
    const bestQuote = sortedList?.[0];
    const receiveTokenAmount = bestQuote?.preExecResult
      ? bestQuote.preExecResult.swapPreExecTx.balance_change.receive_token_list.find(
          item => isSameAddress(item.id, other.receiveToken.id),
        )?.amount || 0
      : 0;

    return [
      inSufficient
        ? new BigNumber(bestQuote.data?.toTokenAmount || 0)
            .div(
              10 **
                (bestQuote?.data?.toTokenDecimals ||
                  other.receiveToken.decimals ||
                  1),
            )
            .toString(10)
        : receiveTokenAmount,
      bestQuote?.isDex ? bestQuote.preExecResult?.gasUsdValue || '0' : '0',
    ];
  }, [inSufficient, other?.receiveToken, sortedList]);

  const fetchedList = useMemo(() => list?.map(e => e.name) || [], [list]);

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
              onErrQuote={setErrorQuoteDEXs}
              key={name}
              inSufficient={inSufficient}
              preExecResult={params.preExecResult}
              quote={data as unknown as any}
              name={name}
              isBestQuote={idx === 0}
              bestQuoteAmount={`${bestQuoteAmount}`}
              bestQuoteGasUsd={bestQuoteGasUsd}
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
      <View>
        <TouchableOpacity
          style={[
            {
              width: 'auto',
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              marginTop: 24,
              gap: 4,
            },
            errorQuoteDEXs.length === 0 ||
            errorQuoteDEXs?.length === ViewDexIdList?.length
              ? { display: 'none' }
              : { marginBottom: 12 },
          ]}
          onPress={() => {
            setHiddenError(e => !e);
          }}>
          <View
            style={{
              width: 'auto',
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
            }}>
            <Text
              style={{
                fontSize: 13,
                color: colors['neutral-foot'],
              }}>
              {t('page.swap.hidden-no-quote-rates', {
                count: errorQuoteDEXs.length,
              })}
            </Text>
            <RcIconSwapHiddenArrow
              width={14}
              height={14}
              viewBox="0 0 14 14"
              style={{
                position: 'relative',
                top: 2,
                transform: [{ rotate: hiddenError ? '0deg' : '180deg' }],
              }}
            />
          </View>
        </TouchableOpacity>
      </View>
      <View
        style={[
          { gap: 12, overflow: 'hidden' },
          hiddenError && errorQuoteDEXs?.length !== ViewDexIdList?.length
            ? {
                maxHeight: 0,
                height: 0,
              }
            : {},
          errorQuoteDEXs.length === 0 ? { display: 'none' } : {},
        ]}>
        {sortedList.map((params, idx) => {
          const { name, data, isDex } = params;
          if (!isDex) {
            return null;
          }
          return (
            <DexQuoteItem
              key={name}
              onErrQuote={setErrorQuoteDEXs}
              onlyShowErrorQuote
              inSufficient={inSufficient}
              preExecResult={params.preExecResult}
              quote={data as unknown as any}
              name={name}
              isBestQuote={idx === 0}
              bestQuoteAmount={`${bestQuoteAmount}`}
              bestQuoteGasUsd={bestQuoteGasUsd}
              isLoading={params.loading}
              quoteProviderInfo={
                DEX_WITH_WRAP[name as keyof typeof DEX_WITH_WRAP]
              }
              {...other}
            />
          );
        })}
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

  const [supportDexList] = useSwapSupportedDexList();
  const supportDexListLength = supportDexList.length;

  const { height: screenHeight } = useWindowDimensions();
  const { bottom } = useSafeAreaInsets();

  const height = useMemo(() => {
    return Math.min(
      screenHeight * 0.8,
      80 + bottom + 100 * supportDexListLength,
    );
  }, [screenHeight, supportDexListLength, bottom]);

  const snapPoints = useMemo(() => [height], [height]);

  return (
    <AppBottomSheetModal
      snapPoints={snapPoints}
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
    marginLeft: 4,
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
