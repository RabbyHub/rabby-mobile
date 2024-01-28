import { ellipsisAddress } from '@/utils/address';
import { getChain } from '@/utils/chain';
import { useMemo } from 'react';
import { StyleSheet, View, Text } from 'react-native';

export const TxId = ({
  style,
  chain,
  id,
}: {
  style?: React.ComponentProps<typeof View>['style'];
  id: string;
  chain: string;
}) => {
  const info = useMemo(() => getChain(chain), [chain]);
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.chain}>{info?.name || 'Unknown'}</Text>
      <Text style={styles.txId}>{ellipsisAddress(id)}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chain: {
    fontSize: 12,
    lineHeight: 14,
    color: '#3E495E',
  },
  txId: {
    fontSize: 12,
    lineHeight: 14,
    color: '#6A7587',
  },
});
