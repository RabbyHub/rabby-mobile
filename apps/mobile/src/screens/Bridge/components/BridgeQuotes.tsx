import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SelectedBridgeQuote, useSetRefreshId } from '../hooks';
import BigNumber from 'bignumber.js';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '@/hooks/theme';
import { StyleSheet, Text, View } from 'react-native';
import { BottomSheetModalMethods } from '@gorhom/bottom-sheet/src/types';
import { AppBottomSheetModal } from '@/components';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { RcIconSwapChecked, RcIconSwapUnchecked } from '@/assets/icons/swap';
import { createGetStyles } from '@/utils/styles';
import { Radio } from '@/components/Radio';
import { SwapRefreshBtn } from '@/screens/Swap/components/SwapRefreshBtn';
import { RcIconEmptyCC } from '@/assets/icons/gnosis';
import { CHAINS_ENUM } from '@/constant/chains';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { BridgeQuoteItem } from './BridgeQuoteItem';
import { QuoteLoading } from './loading';

const getStyles = createGetStyles(colors => ({
  bottomBg: {
    backgroundColor: colors['neutral-bg-2'],
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 20,
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
  chain: CHAINS_ENUM;
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
  setSelectedBridgeQuote: React.Dispatch<
    React.SetStateAction<SelectedBridgeQuote | undefined>
  >;
  sortIncludeGasFee: boolean;
}

export const Quotes = ({
  list,
  activeName,
  inSufficient,
  sortIncludeGasFee,
  ...other
}: QuotesProps) => {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

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
  const { visible, onClose } = props;
  const refresh = useSetRefreshId();

  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const bottomRef = useRef<BottomSheetModalMethods>(null);

  const snapPoints = useMemo(() => [520], []);

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
      snapPoints={snapPoints}
      ref={bottomRef}
      onDismiss={onClose}
      enableDismissOnClose
      handleStyle={styles.bottomBg}
      backgroundStyle={styles.bottomBg}>
      <BottomSheetScrollView style={{ flex: 1 }}>
        <View style={styles.headerContainer}>
          <Text style={styles.headerText}>
            {t('page.bridge.the-following-bridge-route-are-found')}
          </Text>
          <SwapRefreshBtn onPress={refreshQuote} />

          <Radio
            checked={!!sortIncludeGasFee}
            onPress={() => setSortIncludeGasFee(e => !e)}
            title={t('page.swap.sort-with-gas')}
            checkedIcon={<RcIconSwapChecked width={16} height={16} />}
            uncheckedIcon={<RcIconSwapUnchecked width={16} height={16} />}
            textStyle={styles.refreshText}
            right={true}
            containerStyle={styles.radioContainer}
          />
        </View>
        <Quotes
          {...props}
          loading={props.loading}
          sortIncludeGasFee={sortIncludeGasFee}
        />
      </BottomSheetScrollView>
    </AppBottomSheetModal>
  );
};
