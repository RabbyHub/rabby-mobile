import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { Image, Pressable, Text, View } from 'react-native';

interface IProps {
  name: string;
  id: string;
  logo_url: string;
  onPress: () => void;
}
export const CexItem = ({ name, onPress, logo_url }: IProps) => {
  const { styles } = useTheme2024({ getStyle });
  return (
    <Pressable onPress={onPress} style={styles.container}>
      <View>
        <Image
          source={{
            uri: logo_url,
          }}
          style={styles.logo}
        />
      </View>
      <Text style={styles.name}>{name}</Text>
    </Pressable>
  );
};
const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: colors2024['neutral-bg-1'],
    borderRadius: 20,
  },
  logo: { borderRadius: 12, width: 46, height: 46 },
  name: {
    fontSize: 16,
    lineHeight: 20,
    color: colors2024['neutral-title-1'],
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
  },
}));
