import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useTranslation } from 'react-i18next';
import { Text, View, ViewStyle } from 'react-native';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  root: {
    borderRadius: 6,
    backgroundColor: colors2024['brand-light-1'],
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 1,
    flexWrap: 'nowrap',
  },
  text: {
    fontSize: 14,
    lineHeight: 18,
    color: colors2024['brand-default'],
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
  },
}));

export const TextBadge = ({
  type = 'pin',
  style,
}: {
  type?: 'pin' | 'folded';
  style?: ViewStyle;
}) => {
  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const text = type === 'folded' ? t('global.folded') : t('global.pin');

  return (
    <View style={[styles.root, style]}>
      <Text style={styles.text} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
};
