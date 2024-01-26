import { RcIconMobileWallet } from '@/assets/icons/address';
import { Text } from '@/components/Text';
import { useThemeColors } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import { useMemo } from 'react';
import { View } from 'react-native';

export const EmptyMobileWallet = () => {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyle(colors), [colors]);
  return (
    <View style={styles.wrapper}>
      <RcIconMobileWallet />
      <Text style={styles.text}>No mobile wallet found</Text>
    </View>
  );
};

const getStyle = createGetStyles(colors => ({
  wrapper: {
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors['neutral-card1'],
    borderRadius: 8,
  },
  text: {
    fontSize: 13,
    color: colors['neutral-body'],
  },
}));
