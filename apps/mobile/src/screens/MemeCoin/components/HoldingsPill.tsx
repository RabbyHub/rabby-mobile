import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import RcIconChevronCC from '@/assets2024/icons/convertDust/right-cc.svg';
import { AssetAvatar } from '@/components/AssetAvatar';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';

const MAX_AVATARS = 8;
const ACCENT_LIGHT = '#9B4626';

export const HoldingsPill = ({
  mode,
  avatars,
  onPress,
}: {
  mode: 'market' | 'holdings';
  avatars: Array<{ key: string; logoUrl: string }>;
  onPress: () => void;
}) => {
  const { t } = useTranslation();
  const { styles, colors2024, isLight } = useTheme2024({ getStyle });
  const accent = isLight ? ACCENT_LIGHT : colors2024['orange-default'];

  return (
    <TouchableOpacity activeOpacity={0.8} onPress={onPress} style={styles.pill}>
      {mode === 'holdings' ? (
        <>
          <View style={styles.backChevron}>
            <RcIconChevronCC width={6} height={12} color={accent} />
          </View>
          <Text style={[styles.text, styles.centerText, { color: accent }]}>
            {t('page.memeCoin.backToMarket')}
          </Text>
        </>
      ) : (
        <>
          <View style={styles.avatars}>
            {avatars.slice(0, MAX_AVATARS).map((avatar, index) => (
              <View
                key={avatar.key}
                style={[styles.avatarRing, index > 0 && styles.avatarOverlap]}>
                <AssetAvatar logo={avatar.logoUrl} size={30} />
              </View>
            ))}
          </View>
          <Text style={[styles.text, { color: accent }]}>
            {t('page.memeCoin.holdingsEntry')}
          </Text>
          <RcIconChevronCC width={6} height={12} color={accent} />
        </>
      )}
    </TouchableOpacity>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  pill: {
    height: 64,
    marginTop: 20,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors2024['orange-disable'],
    backgroundColor: colors2024['neutral-card-1'],
  },
  avatars: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarRing: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors2024['neutral-bg-1'],
    overflow: 'hidden',
  },
  avatarOverlap: {
    marginLeft: -8,
  },
  text: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '900',
  },
  centerText: {
    flex: 1,
    textAlign: 'center',
  },
  backChevron: {
    transform: [{ rotate: '180deg' }],
  },
}));
