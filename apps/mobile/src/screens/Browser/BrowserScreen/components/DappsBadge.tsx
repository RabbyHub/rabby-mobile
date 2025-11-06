import { Image, View } from 'react-native';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { useDappsBadge } from '@/hooks/browser/useBrowserBookmark';

export const DappsBadge = () => {
  const badges = useDappsBadge();
  const { styles } = useTheme2024({ getStyle });
  if (!badges.length) {
    return null;
  }
  return (
    <View style={styles.badgeContainer}>
      {badges.map(token => (
        <Image
          key={`${token.origin}`}
          style={styles.badgeImage}
          source={{ uri: token?.info?.logo_url || token.icon }}
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
    alignSelf: 'flex-start',
  },
  badgeImage: {
    width: 16,
    height: 16,
    borderRadius: 4,
  },
}));
