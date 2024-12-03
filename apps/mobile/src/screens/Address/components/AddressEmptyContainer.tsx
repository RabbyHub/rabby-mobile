import { Card } from '@/components2024/Card';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { Text, View } from 'react-native';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  root: {
    paddingVertical: 26,
  },
  empty: {
    borderRadius: 12,
    borderColor: colors2024['brand-light-1'],
    borderWidth: 1,
    paddingVertical: 5,
    width: 112,
    paddingLeft: 5,
    flexDirection: 'row',
    gap: 6,
  },
  emptyCircle: {
    width: 22,
    height: 22,
    borderRadius: 17,
    backgroundColor: colors2024['brand-disable'],
  },
  emptyLine1: {
    marginTop: 4,
    width: 25,
    height: 5,
    backgroundColor: colors2024['brand-light-2'],
    borderRadius: 5,
  },
  emptyLine2: {
    marginTop: 5,
    width: 38,
    height: 5,
    backgroundColor: colors2024['brand-light-1'],
    borderRadius: 5,
  },
  text: {
    marginTop: 12,
    fontSize: 16,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '400',
    color: colors2024['neutral-info'],
    textAlign: 'center',
    lineHeight: 20,
  },
}));

export const AddressEmptyContainer = () => {
  const { styles } = useTheme2024({ getStyle });

  return (
    <Card style={styles.root}>
      <View style={styles.empty}>
        <View style={styles.emptyCircle} />
        <View>
          <View style={styles.emptyLine1} />
          <View style={styles.emptyLine2} />
        </View>
      </View>
      <Text style={styles.text}>No Address Now</Text>
    </Card>
  );
};
