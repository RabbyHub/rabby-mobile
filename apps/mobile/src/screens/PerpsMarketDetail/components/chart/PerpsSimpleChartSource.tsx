import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';

export const PerpsSimpleChartSource = React.memo(
  function PerpsSimpleChartSource() {
    const { t } = useTranslation();
    const { styles } = useTheme2024({ getStyle });
    return (
      <Text style={styles.source}>
        {t('page.perpsDetail.simpleChart.source')}
      </Text>
    );
  },
);
const getStyle = createGetStyles2024(({ colors2024 }) => ({
  source: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    color: colors2024['neutral-secondary'],
    textAlign: 'center',
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
}));
