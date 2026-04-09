/* eslint-disable react-native/no-inline-styles */
import React, { useEffect, useMemo, useRef } from 'react';
import { SelectedBridgeQuote, useSetRefreshId } from '../hooks';
import BigNumber from 'bignumber.js';
import { useTranslation } from 'react-i18next';
import { useTheme2024 } from '@/hooks/theme';
import { TouchableOpacity, View } from 'react-native';
import { BottomSheetModalMethods } from '@gorhom/bottom-sheet/src/types';
import { AppBottomSheetModal } from '@/components';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { createGetStyles2024 } from '@/utils/styles';
import { RcIconEmptyCC } from '@/assets/icons/gnosis';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { RcIconRefreshCC } from '@/assets2024/icons/browser';
import { BridgeQuoteItem, bridgeQuoteScore } from './BridgeQuoteItem';
import { QuoteLoading } from './loading';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { Text } from '@/components/Typography';

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
    marginTop: 20,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
    textAlign: 'center',
  },
  subtitleText: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-foot'],
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  refreshIconBtn: {
    position: 'absolute',
    top: -10,
    right: 20,
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
  currentSelectedQuote?: SelectedBridgeQuote;
}

export const Quotes = ({
  list,
  activeName,
  inSufficient,
  ...other
}: QuotesProps) => {
  const { styles, colors2024, colors } = useTheme2024({ getStyle });

  const { t } = useTranslation();

  const sortedList = useMemo(() => {
    return list?.sort((b, a) => {
      return new BigNumber(a.to_token_amount)
        .times(other.receiveToken.price || 1)
        .minus(a.gas_fee.usd_value)
        .minus(
          new BigNumber(b.to_token_amount)
            .times(other.receiveToken.price || 1)
            .minus(b.gas_fee.usd_value),
        )
        .toNumber();
    });
  }, [list, other.receiveToken]);

  const bestIndex = useMemo(() => {
    if (!sortedList?.length) {
      return 0;
    }
    let bestIdx = 0;
    let bestScore = bridgeQuoteScore(sortedList[0]!, other.receiveToken);
    for (let i = 1; i < sortedList.length; i++) {
      const score = bridgeQuoteScore(sortedList[i]!, other.receiveToken);
      if (score.gt(bestScore)) {
        bestScore = score;
        bestIdx = i;
      }
    }
    return bestIdx;
  }, [sortedList, other.receiveToken]);

  const bestAmountUsd = useMemo(() => {
    const first = sortedList?.[0];
    if (!first) {
      return '0';
    }
    return new BigNumber(first.to_token_amount)
      .times(other.receiveToken.price || 1)
      .minus(first.gas_fee.usd_value)
      .toString();
  }, [sortedList, other.receiveToken]);

  return (
    <BottomSheetScrollView contentContainerStyle={styles.container}>
      <View style={styles.content}>
        {sortedList?.map((item, idx) => (
          <BridgeQuoteItem
            key={item.aggregator.id + item.bridge_id}
            {...item}
            isBestQuote={idx === bestIndex}
            isTopAmount={idx === 0}
            bestQuoteUsd={bestAmountUsd}
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

export const QuoteList = (props: QuotesProps) => {
  const { visible, onClose } = props;
  const refresh = useSetRefreshId();

  const { styles, colors2024, colors, isLight } = useTheme2024({ getStyle });

  const bottomRef = useRef<BottomSheetModalMethods>(null);

  const refreshQuote = React.useCallback(() => {
    refresh(e => e + 1);
  }, [refresh]);

  const { t } = useTranslation();

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
      <View style={{ flex: 1, position: 'relative' }}>
        <TouchableOpacity onPress={refreshQuote} style={styles.refreshIconBtn}>
          <RcIconRefreshCC color={colors2024['neutral-body']} />
        </TouchableOpacity>
        <Text style={styles.headerText}>
          {t('page.bridge.the-following-bridge-route-are-found')}
        </Text>
        <Text style={styles.subtitleText}>
          {t('page.bridge.best-subtitle')}
        </Text>
        <View style={{ flex: 1 }}>
          <Quotes {...props} loading={props.loading} />
          <View style={{ height: 20 }} />
        </View>
      </View>
    </AppBottomSheetModal>
  );
};
