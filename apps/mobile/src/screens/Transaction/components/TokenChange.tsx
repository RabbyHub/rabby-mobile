import { default as RcIconSend } from '@/assets/icons/history/send.svg';
import { StyleSheet, Text, View } from 'react-native';

const TxChangeItem = () => {
  return (
    <View style={styles.item}>
      <RcIconSend style={styles.image} width={14} height={14} />
      <Text style={styles.text}>- 0.01 AVAX</Text>
    </View>
  );
};
export const TxChange = () => {
  return (
    <View style={styles.container}>
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((_, i) => (
        <TxChangeItem key={i} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'column',
    gap: 3,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  image: {
    width: 14,
    height: 14,
    borderRadius: 14,
  },
  text: {
    fontSize: 13,
    lineHeight: 15,
    color: '#2ABB7F',
  },
});
