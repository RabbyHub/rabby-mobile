import { getChain } from '@/utils/chain';
import { numberWithCommasIsLtOne } from '@/utils/number';
import { sinceTime } from '@/utils/time';
import { TxDisplayItem } from '@rabby-wallet/rabby-api/dist/types';
import { HistoryDisplayItem } from '../MultiAddressHistory';
import { StyleProp, Text, View, ViewStyle } from 'react-native';
import { TxChange } from './TokenChange';
import { TxId } from './TxId';
import { TxInterAddressExplain } from './TxInterAddressExplain';
import React from 'react';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';

type HistoryItemProps = {
  style?: StyleProp<ViewStyle>;
  data: HistoryDisplayItem;
  isForMultipleAdderss?: boolean;
} & Pick<TxDisplayItem, 'cateDict' | 'projectDict' | 'tokenDict'>;

export const HistoryItem = React.memo(
  ({
    data,
    cateDict,
    projectDict,
    tokenDict,
    style,
    isForMultipleAdderss,
  }: HistoryItemProps) => {
    const isFailed = data.tx?.status === 0;
    const isScam = data.is_scam;
    const chainItem = getChain(data.chain);
    const { styles } = useTheme2024({ getStyle });

    return (
      <View
        style={[
          styles.card,
          style,
          isFailed || isScam ? styles.cardGray : null,
        ]}>
        <View style={styles.cardHeader}>
          {isScam ? (
            <View style={styles.scamContainer}>
              <Text style={styles.scam}>Scam tx</Text>
            </View>
          ) : null}
          <View style={styles.cardHeaderInner}>
            <Text style={styles.time} numberOfLines={1}>
              {sinceTime(data.time_at)}
            </Text>
            <TxId chain={data.chain} id={data.id} />
          </View>
        </View>
        <View style={styles.cardBody}>
          <TxInterAddressExplain
            style={[
              styles.txInterAddressExplain,
              data?.cate_id === 'approve' &&
                styles.txInterAddressExplainApprove,
            ]}
            data={data}
            projectDict={projectDict}
            tokenDict={tokenDict}
            cateDict={cateDict}
            isScam={isScam}
          />
          <TxChange
            isForMultipleAdderss={isForMultipleAdderss}
            style={styles.txChange}
            data={data}
            tokenDict={tokenDict}
            canClickToken
          />
        </View>

        {(data.tx && data.tx?.eth_gas_fee) || isFailed ? (
          <>
            <View style={styles.divider} />
            <View style={styles.cardFooter}>
              {data.tx && data.tx?.eth_gas_fee ? (
                <Text style={styles.gas}>
                  Gas: {numberWithCommasIsLtOne(data.tx?.eth_gas_fee, 2)}{' '}
                  {chainItem?.nativeTokenSymbol} ($
                  {numberWithCommasIsLtOne(data.tx?.usd_gas_fee ?? 0, 2)})
                </Text>
              ) : null}
              {isFailed ? <Text style={styles.failed}>Failed</Text> : null}
            </View>
          </>
        ) : null}
      </View>
    );
  },
);

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  card: {
    borderRadius: 20,
    backgroundColor: colors2024['neutral-bg-1'],
    marginBottom: 12,
    borderColor: colors2024['neutral-line'],
    borderWidth: 1,
  },
  cardGray: {
    opacity: 0.5,
  },
  cardHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  scamContainer: {
    borderRadius: 2,
    backgroundColor: colors2024['neutral-line'],
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  scam: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 14,
    color: colors2024['neutral-foot'],
  },
  cardHeaderInner: {
    flexGrow: 1,
    flexShrink: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 6,
  },
  cardBody: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  cardFooter: {
    padding: 16,
    paddingTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gas: {
    fontSize: 12,
    lineHeight: 14,
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-foot'],
  },
  failed: {
    fontSize: 12,
    lineHeight: 14,
    fontFamily: 'SF Pro Rounded',
    color: colors2024['red-default'],
  },
  time: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 14,
    color: colors2024['neutral-foot'],
    minWidth: 0,
  },
  txInterAddressExplain: { flexShrink: 1, width: '60%' },
  txInterAddressExplainApprove: { width: '100%' },
  txChange: { flexShrink: 0, maxWidth: '70%' },
  divider: {
    height: 0.5,
    backgroundColor: colors2024['neutral-line'],
    opacity: 0.5,
    marginHorizontal: 12,
  },
}));
