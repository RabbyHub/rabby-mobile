import { StyleSheet, Text, View } from 'react-native';
import { TxAvatar } from './TxAvatar';

export const TxInterAddressExplain = () => {
  return (
    <View style={styles.container}>
      <TxAvatar />
      <View>
        <Text style={styles.action}>Send</Text>
        <Text style={styles.text}>0xef3c…e5d4</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  action: {
    fontSize: 15,
    lineHeight: 18,
    color: '#192945',
  },
  text: {
    fontSize: 12,
    lineHeight: 14,
    color: '#6A7587',
  },
});
