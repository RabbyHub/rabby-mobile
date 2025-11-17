import { View } from 'react-native';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { useDappsBadge } from '@/hooks/browser/useBrowserBookmark';
import { DappIcon } from '@/screens/Dapps/components/DappIcon';

export const DappsBadge = () => {
  const badges = useDappsBadge();
  const { styles } = useTheme2024({ getStyle });

  if (!badges.length) {
    return null;
  }
  return (
    <View style={styles.badgeContainer}>
      {badges.map(dapp => (
        <DappIcon
          key={dapp.origin}
          origin={dapp.origin}
          source={
            dapp.icon || dapp.info?.logo_url
              ? { uri: dapp.icon || dapp.info?.logo_url || '' }
              : undefined
          }
          style={styles.badgeImage}
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
    borderRadius: 4,
  },
}));
