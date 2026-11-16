import React from 'react';
import { TouchableOpacity } from 'react-native';
import RcEmptyMemeDark from '@/assets2024/memecoin/empty-meme-dark.svg';
import RcEmptyMeme from '@/assets2024/memecoin/empty-meme-light.svg';
import RcEmptyPaymentDark from '@/assets2024/memecoin/empty-payment-dark.svg';
import RcEmptyPayment from '@/assets2024/memecoin/empty-payment-light.svg';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';

const ILLUSTRATIONS = {
  meme: { light: RcEmptyMeme, dark: RcEmptyMemeDark },
  payment: { light: RcEmptyPayment, dark: RcEmptyPaymentDark },
};

/** Centred in whatever space is left when its container lets it grow. */
export const MemeEmptyState = ({
  text,
  onPress,
  illustration = 'meme',
}: {
  text: string;
  onPress?: () => void;
  illustration?: keyof typeof ILLUSTRATIONS;
}) => {
  const { styles, isLight } = useTheme2024({ getStyle });
  const RcEmpty = ILLUSTRATIONS[illustration][isLight ? 'light' : 'dark'];
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      disabled={!onPress}
      onPress={onPress}
      style={styles.container}>
      <RcEmpty width={163} height={126} />
      <Text style={styles.text}>{text}</Text>
    </TouchableOpacity>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
    gap: 4,
  },
  text: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '400',
    color: colors2024['neutral-info'],
    textAlign: 'center',
  },
}));
