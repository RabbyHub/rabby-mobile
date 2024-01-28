import { StyleSheet, Text, View } from 'react-native';
import { TxId } from './TxId';
import { TxInterAddressExplain } from './TxInterAddressExplain';
import { TxChange } from './TokenChange';
import {
  TxDisplayItem,
  TxHistoryItem,
} from '@rabby-wallet/rabby-api/dist/types';
import { sinceTime } from '@/utils/time';
import { getChain } from '@/utils/chain';
import { numberWithCommasIsLtOne } from '@/utils/number';

type HistoryItemProps = {
  data: TxDisplayItem;
} & Pick<TxDisplayItem, 'cateDict' | 'projectDict' | 'tokenDict'>;

export const HistoryItem = ({
  data,
  cateDict,
  projectDict,
  tokenDict,
}: HistoryItemProps) => {
  const isFailed = data.tx?.status === 0;
  const isScam = data.is_scam;
  const chainItem = getChain(data.chain);
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        {isScam ? <Text style={styles.spam}>Scam tx</Text> : null}
        <View style={styles.cardHeaderInner}>
          <Text style={styles.time} numberOfLines={1}>
            {sinceTime(data.time_at)}
          </Text>
          <TxId chain={data.chain} id={data.id} />
        </View>
      </View>
      <View style={styles.cardBody}>
        <TxInterAddressExplain
          data={data}
          projectDict={projectDict}
          tokenDict={tokenDict}
          cateDict={cateDict}
        />
        <TxChange data={data} tokenDict={tokenDict} />
      </View>
      <View style={styles.dividerContainer}>
        <View style={styles.divider} />
      </View>
      {(data.tx && data.tx?.eth_gas_fee) || isFailed ? (
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
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    marginBottom: 12,
  },
  cardHeader: {
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  spam: {
    borderRadius: 2,
    backgroundColor: '#D3D8E0',
    paddingHorizontal: 6,
    paddingVertical: 3,

    fontSize: 12,
    lineHeight: 14,
    color: '#6A7587',
  },
  cardHeaderInner: {
    // width: '100%',
    flex: 1,
    flexShrink: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minWidth: 0,
    flexWrap: 'wrap',
    gap: 6,
  },
  cardBody: {
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardFooter: {
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gas: {
    fontSize: 12,
    lineHeight: 14,
    color: '#6A7587',
  },
  failed: {
    fontSize: 12,
    lineHeight: 14,
    color: '#f24822',
  },
  time: {
    fontSize: 12,
    lineHeight: 14,
    color: '#6A7587',
    minWidth: 0,
  },
  dividerContainer: {
    paddingHorizontal: 12,
  },
  divider: {
    borderStyle: 'solid',
    borderWidth: 0.5,
    borderColor: 'rgba(211, 216, 224, 0.5)',
  },
});
