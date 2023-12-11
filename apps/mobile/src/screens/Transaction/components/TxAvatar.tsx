import { default as RcIconSend } from '@/assets/icons/history/send.svg';
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';

export const TxAvatar = ({ style }: { style?: StyleProp<ViewStyle> }) => {
  return <RcIconSend style={[styles.image, style]} />;
};

const styles = StyleSheet.create({
  image: {
    width: 28,
    height: 28,
  },
});
