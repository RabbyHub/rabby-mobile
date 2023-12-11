import { StyleSheet, Text, View } from 'react-native';
import { TxId } from './TxId';
import { TxInterAddressExplain } from './TxInterAddressExplain';
import { TxChange } from './TokenChange';

export const HistoryItem = () => {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.spam}>Scam tx</Text>
        <View style={styles.cardHeaderInner}>
          <Text style={styles.time}>2021/12/28 07:34</Text>
          <TxId />
        </View>
      </View>
      <View style={styles.cardBody}>
        <TxInterAddressExplain />
        <TxChange />
      </View>
      <View style={styles.dividerContainer}>
        <View style={styles.divider} />
      </View>
      <View style={styles.cardFooter}>
        <Text style={styles.gas}>Gas: 0.0034 AVAX ($0.3653)</Text>
        <Text style={styles.failed}>Failed</Text>
      </View>
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
    flexWrap: 'wrap',
    alignItems: 'center',
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
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
