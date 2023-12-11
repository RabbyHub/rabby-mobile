import { StyleSheet, View, Text } from 'react-native';

export const TxId = ({
  style,
}: {
  style?: React.ComponentProps<typeof View>['style'];
}) => {
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.chain}>Avalanche</Text>
      <Text style={styles.txId}>0x097a…3e9c</Text>
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
