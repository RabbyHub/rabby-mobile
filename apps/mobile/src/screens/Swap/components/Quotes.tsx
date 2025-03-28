import {
  RcIconSwapChecked,
  RcIconSwapHiddenArrow,
  RcIconSwapUnchecked,
} from '@/assets/icons/swap';
import { AppBottomSheetModal } from '@/components';
import { Radio } from '@/components/Radio';
import { DEX_WITH_WRAP } from '@/constant/swap';
import { useTheme2024, useThemeColors } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { getTokenSymbol } from '@/utils/token';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { BottomSheetModalMethods } from '@gorhom/bottom-sheet/src/types';
import BigNumber from 'bignumber.js';
import { useSetAtom } from 'jotai';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Easing, Text, TouchableOpacity, View } from 'react-native';
import { TDexQuoteData, useSwapSettings, useSwapViewDexIdList } from '../hooks';
import { refreshIdAtom } from '../hooks/atom';
import { isSwapWrapToken } from '../utils';
import { QuoteListLoading, QuoteLoading } from './loading';
import {
  DexQuoteItem as DexQuoteItemOld,
  QuoteItemProps as QuoteItemPropsOld,
} from './QuoteItem';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import LinearGradient from 'react-native-linear-gradient';
import RcIconLoading from '@/assets2024/icons/bridge/IconLoading.svg';
import { IS_ANDROID } from '@/core/native/utils';

interface QuotesProps
  extends Omit<
    QuoteItemPropsOld,
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
            new BigNumber(quote?.data?.toTokenAmount || 0)
              .div(
                10 **
                  (quote?.data?.toTokenDecimals || other.receiveToken.decimals),
              )
              .toString() || 0;
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
    const receiveTokenAmount =
      new BigNumber(bestQuote?.data?.toTokenAmount || 0)
        .div(
          10 **
            (bestQuote?.data?.toTokenDecimals || other.receiveToken.decimals),
        )
        .toString() || '0';

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
          <DexQuoteItemOld
            inSufficient={inSufficient}
            preExecResult={dex?.preExecResult}
            quote={dex?.data}
            name={dex?.name}
            isBestQuote
            bestQuoteAmount={`${
              new BigNumber(dex?.data?.toTokenAmount || 0)
                .div(
                  10 **
                    (dex?.data?.toTokenDecimals || other.receiveToken.decimals),
                )
                .toString() || '0'
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
            <DexQuoteItemOld
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
            <DexQuoteItemOld
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
  const { visible, onClose, loading } = props;
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

  const {
    styles,
    colors2024, // colors
    isLight,
  } = useTheme2024({ getStyle });

  const spinValue = useRef(new Animated.Value(0)).current;
  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  useEffect(() => {
    if (loading) {
      Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 1600,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ).start();
    } else {
      spinValue.resetAnimation();
    }
  }, [loading, spinValue]);

  return (
    <AppBottomSheetModal
      snapPoints={['90%']}
      ref={bottomRef}
      onDismiss={onClose}
      enableDismissOnClose
      {...makeBottomSheetProps({
        linearGradientType: 'linear',
        colors: colors2024,
      })}
      handleStyle={styles.bottomBg}
      backgroundStyle={styles.bottomBg}>
      <LinearGradient
        colors={[colors2024['neutral-bg-1'], colors2024['neutral-bg-3']]}
        locations={[0.0745, 0.2242]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{ flex: 1 }}>
        <View style={styles.headerContainer}>
          <Text style={styles.headerText}>
            {t('page.bridge.the-following-bridge-route-are-found')}
          </Text>
          <TouchableOpacity onPress={refreshQuote} style={styles.refreshBox}>
            <Animated.View
              style={{
                transform: [{ rotate: spin }],
                marginRight: 4,
              }}>
              <RcIconLoading />
            </Animated.View>
            <Text style={styles.refreshContent}>{t('global.refresh')}</Text>
          </TouchableOpacity>
        </View>

        <BottomSheetScrollView style={styles.flex1}>
          <Quotes {...props} />
          <View style={{ height: IS_ANDROID ? 140 : 120 }} />
        </BottomSheetScrollView>

        <LinearGradient
          colors={
            isLight
              ? ['#FFF', 'rgba(249, 249, 249, 0.30)']
              : [colors2024['neutral-bg-1'], colors2024['neutral-bg-3']]
          }
          locations={[0.6393, 1]}
          start={{ x: 0, y: 1 }}
          end={{ x: 0, y: 0 }}
          style={styles.floatBottom}>
          <Radio
            checked={!!sortIncludeGasFee}
            onPress={() => setSwapSortIncludeGasFee(!sortIncludeGasFee)}
            title={t('page.swap.sort-with-gas')}
            checkedIcon={<RcIconSwapChecked width={24} height={24} />}
            uncheckedIcon={<RcIconSwapUnchecked width={24} height={24} />}
            textStyle={styles.refreshText}
            right={true}
            containerStyle={styles.radioContainer}
          />
        </LinearGradient>
      </LinearGradient>
    </AppBottomSheetModal>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  bottomBg: {
    backgroundColor: colors2024['neutral-bg-1'],
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 20,
    paddingHorizontal: 20,
    marginBottom: 12,
    alignSelf: 'stretch',
    gap: 3,
  },

  refreshBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  refreshContent: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['brand-default'],
  },

  headerText: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
  },
  refreshText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    marginLeft: 8,
  },

  foot: {
    paddingTop: 16,
    flexDirection: 'row',
    paddingBottom: 20,
    justifyContent: 'center',
  },

  flex1: {
    flex: 1,
  },
  radioContainer: {
    margin: 0,
    padding: 0,
  },

  floatBottom: {
    width: '100%',
    height: 130,
    paddingTop: 40,
    position: 'absolute',
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
