import { View } from 'react-native';
import { Text } from '@/components/Typography';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useTranslation } from 'react-i18next';
export const NoOpen = () => {
  const { t } = useTranslation();
  const { styles } = useTheme2024({ getStyle: getStyles });
  return (
    <View style={[styles.noOpenContainer]}>
      <Text ellipsizeMode="tail" numberOfLines={1} style={styles.noOpenText}>
        {t('page.market.noOpen')}
      </Text>
    </View>
  );
};

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  noOpenContainer: {
    borderRadius: 6,
    backgroundColor: colors2024['neutral-bg-5'],
    width: 68,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noOpenText: {
    maxWidth: 68,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    lineHeight: 16,
  },
}));
