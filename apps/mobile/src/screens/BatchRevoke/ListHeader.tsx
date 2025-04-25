import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

export const ListHeader = () => {
  const { t } = useTranslation();
  const { styles } = useTheme2024({
    getStyle,
  });

  return (
    <View style={styles.root}>
      <View style={styles.asset}>
        <Text style={styles.headerText}>{t('page.approvals.asset')}</Text>
      </View>
      <View>
        <Text style={styles.headerText}>{t('page.approvals.revokeFrom')}</Text>
      </View>
      <View>
        <Text style={styles.headerText}>{t('page.approvals.gasFee')}</Text>
      </View>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  root: {
    backgroundColor: colors2024['neutral-bg-2'],
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 8,
  },
  asset: {
    width: 84,
  },
  revokeFrom: {
    width: 132,
  },
  gasFee: {
    width: 81,
  },
  headerText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 18,
  },
}));
