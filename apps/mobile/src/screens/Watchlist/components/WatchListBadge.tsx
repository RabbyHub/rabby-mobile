import { Image, View } from 'react-native';
import { useWatchListTokenBadge } from '../hooks/useWatchlistTokens';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';

export const WatchListBadge = () => {
  const last3Token = useWatchListTokenBadge();
  const { styles, isLight } = useTheme2024({ getStyle });
  if (!last3Token.length) {
    return null;
  }
  return (
    <View style={styles.badgeContainer}>
      {last3Token.map(token => (
        <Image
          key={`${token.id}${token.chain}`}
          style={styles.badgeImage}
          source={
            token.logo_url
              ? { uri: token.logo_url }
              : isLight
              ? require('@/assets/icons/token/default-token.png')
              : require('@/assets/icons/token/default-token-dark.png')
          }
        />
      ))}
    </View>
  );
};

const getStyle = createGetStyles2024(({ isLight, colors2024 }) => ({
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
