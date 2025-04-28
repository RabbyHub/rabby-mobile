import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { CELL_WIDTH } from './Cell';

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
      <View style={styles.revokeFrom}>
        <Text style={styles.headerText}>{t('page.approvals.revokeFrom')}</Text>
      </View>
      <View style={styles.gasFee}>
        <Text style={styles.headerText}>{t('page.approvals.gasFee')}</Text>
      </View>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  root: {
    marginHorizontal: 12,
    backgroundColor: colors2024['neutral-bg-2'],
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  asset: {
    width: CELL_WIDTH.ASSET,
  },
  revokeFrom: {
    width: CELL_WIDTH.REVOKE_FROM,
  },
  gasFee: {
    width: CELL_WIDTH.GAS_FEE,
  },
  headerText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 18,
    color: colors2024['neutral-secondary'],
  },
}));
