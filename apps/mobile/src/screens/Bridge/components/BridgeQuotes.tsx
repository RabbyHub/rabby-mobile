/* eslint-disable react-native/no-inline-styles */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SelectedBridgeQuote, useSetRefreshId } from '../hooks';
import BigNumber from 'bignumber.js';
import { useTranslation } from 'react-i18next';
import { useTheme2024, useThemeColors } from '@/hooks/theme';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { BottomSheetModalMethods } from '@gorhom/bottom-sheet/src/types';
import { AppBottomSheetModal } from '@/components';
import { BottomSheetScrollView, BottomSheetView } from '@gorhom/bottom-sheet';
import { RcIconSwapChecked, RcIconSwapUnchecked } from '@/assets/icons/swap';
import { createGetStyles, createGetStyles2024 } from '@/utils/styles';
import { Radio } from '@/components/Radio';
import { SwapRefreshBtn } from '@/screens/Swap/components/SwapRefreshBtn';
import { RcIconEmptyCC } from '@/assets/icons/gnosis';
import { CHAINS_ENUM } from '@/constant/chains';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import RcIconLoading from '@/assets2024/icons/bridge/IconLoading.svg';
import { BridgeQuoteItem } from './BridgeQuoteItem';
import { QuoteLoading } from './loading';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';

const getStyle = createGetStyles2024(({ colors, colors2024 }) => ({
  bottomBg: {
    backgroundColor: colors2024['neutral-bg-0'],
  },
  refreshBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    paddingHorizontal: 20,
    alignSelf: 'stretch',
  },

  headerText: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
    textAlign: 'center',
  },
  refreshText: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 20,
  },
  refreshContent: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontStyle: 'normal',
    fontWeight: '700',
    color: colors2024['brand-default'],
  },
  radioContainer: {
    margin: 0,
    padding: 0,
  },

  container: {
    flexGrow: 1,
    padding: 12,
  },
  content: {
    flex: 1,
    flexDirection: 'column',
    gap: 12,
    paddingBottom: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
    height: '100%',
    marginTop: 120,
  },
  emptyText: {
    fontSize: 14,
    color: colors['neutral-foot'],
  },
}));

interface QuotesProps {
  userAddress: string;
  loading: boolean;
  inSufficient: boolean;
  payToken: TokenItem;
  receiveToken: TokenItem;
  list?: SelectedBridgeQuote[];
  activeName?: string;
  visible: boolean;
  onClose: () => void;
  payAmount: string;
  setSelectedBridgeQuote: (quote?: SelectedBridgeQuote) => void;
  sortIncludeGasFee: boolean;
  currentSelectedQuote?: SelectedBridgeQuote;
}

export const Quotes = ({
  list,
  activeName,
  inSufficient,
  sortIncludeGasFee,
  ...other
}: QuotesProps) => {
  const { styles, colors2024, colors } = useTheme2024({ getStyle });

  const { t } = useTranslation();

  const sortedList = useMemo(() => {
    return list?.sort((b, a) => {
      return new BigNumber(a.to_token_amount)
        .times(other.receiveToken.price || 1)
        .minus(sortIncludeGasFee ? a.gas_fee.usd_value : 0)
        .minus(
          new BigNumber(b.to_token_amount)
            .times(other.receiveToken.price || 1)
            .minus(sortIncludeGasFee ? b.gas_fee.usd_value : 0),
        )
        .toNumber();
    });
  }, [list, sortIncludeGasFee, other.receiveToken]);

  const bestQuoteUsd = useMemo(() => {
    const bestQuote = sortedList?.[0];
    if (!bestQuote) {
      return '0';
    }
    return new BigNumber(bestQuote.to_token_amount)
      .times(other.receiveToken.price || 1)
      .minus(sortIncludeGasFee ? bestQuote.gas_fee.usd_value : 0)
      .toString();
  }, [sortedList, other.receiveToken, sortIncludeGasFee]);

  return (
    <BottomSheetScrollView contentContainerStyle={styles.container}>
      <View style={styles.content}>
        {sortedList?.map((item, idx) => (
          <BridgeQuoteItem
            key={item.aggregator.id + item.bridge_id}
            {...item}
            sortIncludeGasFee={!!sortIncludeGasFee}
            isBestQuote={idx === 0}
            bestQuoteUsd={bestQuoteUsd}
            payToken={other.payToken}
            receiveToken={other.receiveToken}
            setSelectedBridgeQuote={other.setSelectedBridgeQuote}
            currentSelectedQuote={other.currentSelectedQuote}
            payAmount={other.payAmount}
            inSufficient={inSufficient}
          />
        ))}

        {other.loading &&
          !sortedList?.length &&
          Array.from({ length: 4 }).map((_, idx) => <QuoteLoading key={idx} />)}
        {!other.loading && !sortedList?.length && (
          <View style={styles.emptyContainer}>
            <RcIconEmptyCC
              width={40}
              height={40}
              color={colors['neutral-foot']}
            />
            <Text style={styles.emptyText}>
              {t('page.bridge.no-route-found')}
            </Text>
          </View>
        )}
      </View>
    </BottomSheetScrollView>
  );
};

export const QuoteList = (props: Omit<QuotesProps, 'sortIncludeGasFee'>) => {
  const { visible, onClose, loading } = props;
  const refresh = useSetRefreshId();

  const { styles, colors2024, colors, isLight } = useTheme2024({ getStyle });

  const bottomRef = useRef<BottomSheetModalMethods>(null);
  // const [loading, setLoading] = useState(false);

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

  const refreshQuote = React.useCallback(() => {
    refresh(e => e + 1);
  }, [refresh]);

  const { t } = useTranslation();

  const [sortIncludeGasFee, setSortIncludeGasFee] = useState(true);

  useEffect(() => {
    if (!visible) {
      setSortIncludeGasFee(true);
    }
  }, [visible]);

  useEffect(() => {
    if (visible) {
      bottomRef.current?.present();
    } else {
      bottomRef.current?.dismiss();
    }
  }, [visible]);

  return (
    <AppBottomSheetModal
      ref={bottomRef}
      snapPoints={['78%']}
      onDismiss={onClose}
      enableDismissOnClose
      {...makeBottomSheetProps({
        colors: colors2024,
        linearGradientType: isLight ? 'bg0' : 'bg1',
      })}>
      <BottomSheetView style={{ flex: 1 }}>
        <Text style={styles.headerText}>
          {t('page.bridge.the-following-bridge-route-are-found')}
        </Text>
        <View style={styles.headerContainer}>
          <View>
            <Radio
              checked={!!sortIncludeGasFee}
              onPress={() => setSortIncludeGasFee(e => !e)}
              title={t('page.swap.sort-with-gas')}
              checkedIcon={<RcIconSwapChecked width={24} height={24} />}
              uncheckedIcon={<RcIconSwapUnchecked width={24} height={24} />}
              textStyle={styles.refreshText}
              right={true}
              containerStyle={styles.radioContainer}
            />
          </View>
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
          {/* <SwapRefreshBtn onPress={refreshQuote} /> */}
        </View>
        <BottomSheetScrollView style={{ flex: 1 }}>
          <Quotes
            {...props}
            loading={props.loading}
            sortIncludeGasFee={sortIncludeGasFee}
          />
          <View style={{ height: 120 }} />
        </BottomSheetScrollView>
      </BottomSheetView>
    </AppBottomSheetModal>
  );
};
