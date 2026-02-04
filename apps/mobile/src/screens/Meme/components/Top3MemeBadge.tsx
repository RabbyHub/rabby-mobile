import { Image, View } from 'react-native';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { useMemeTokenList } from '../hooks/useMemeTokenList';

export const Top3MemeBadge = () => {
  const { styles } = useTheme2024({ getStyle });
  const { memeTokenList: tokenList } = useMemeTokenList(true);
  if (!tokenList.length) {
    return null;
  }
  return (
    <View style={styles.badgeContainer}>
      {tokenList.slice(0, 3).map(token => (
        <Image
          key={`${token.id}${token.chain}`}
          style={styles.badgeImage}
          source={{ uri: token.logo_url }}
        />
      ))}
    </View>
  );
};

const getStyle = createGetStyles2024(() => ({
  badgeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  badgeImage: {
    width: 16,
    height: 16,
    borderRadius: 16,
  },
}));
