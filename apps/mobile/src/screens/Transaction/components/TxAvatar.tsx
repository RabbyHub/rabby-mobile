import RcIconSend from '@/assets/icons/history/send.svg';
import RcIconContract from '@/assets/icons/history/contract.svg';
import RcIconApproval from '@/assets/icons/history/approval.svg';
import RcIconCancel from '@/assets/icons/history/cancel.svg';
import {
  Image,
  ImageStyle,
  StyleProp,
  StyleSheet,
  ViewStyle,
} from 'react-native';
interface TxAvatarProps {
  className?: string;
  src?: string | null;
  cateId?: string | null;
  style?: StyleProp<ImageStyle>;
}

export const TxAvatar = ({ style, src, cateId }: TxAvatarProps) => {
  if (!src) {
    switch (cateId) {
      case 'receive':
      case 'send':
        return <RcIconSend style={[styles.image, style]} />;
      case 'cancel':
        return <RcIconCancel style={[styles.image, style]} />;
      case 'approve':
        return <RcIconApproval style={[styles.image, style]} />;
      default:
        return <RcIconContract style={[styles.image, style]} />;
    }
  }
  return (
    <Image
      style={[styles.image, style]}
      source={{
        uri: src,
      }}
    />
  );
};

const styles = StyleSheet.create({
  image: {
    width: 32,
    height: 32,
    borderRadius: 2,
  },
});
