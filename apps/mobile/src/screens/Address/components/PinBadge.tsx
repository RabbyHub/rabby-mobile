import PinSVG from '@/assets2024/icons/common/pin-cc.svg';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { Text, View } from 'react-native';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  root: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    gap: 4,
    borderRadius: 8,
    backgroundColor: colors2024['brand-light-1'],
    flexDirection: 'row',
    width: 33,
  },
  text: {
    fontSize: 14,
    lineHeight: 18,
    color: colors2024['brand-default'],
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
  },
}));

export const PinBadge = () => {
  const { styles, colors2024 } = useTheme2024({ getStyle });

  return (
    <View style={styles.root}>
      {/* <PinSVG width={15} height={15} color={colors2024['brand-default']} /> */}
      <Text style={styles.text}>Pin</Text>
    </View>
  );
};
