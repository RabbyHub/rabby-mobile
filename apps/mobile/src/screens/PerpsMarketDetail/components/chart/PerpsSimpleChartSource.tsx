import React from 'react';
import { Pressable } from 'react-native';
import { Trans } from 'react-i18next';
import { openExternalUrl } from '@/core/utils/linking';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';

export const PerpsSimpleChartSource = React.memo(
  function PerpsSimpleChartSource() {
    const { styles } = useTheme2024({ getStyle });
    return (
      <Pressable
        accessibilityRole="link"
        accessibilityLabel="TradingView"
        onPress={() => openExternalUrl('https://www.tradingview.com')}>
        <Text style={styles.source}>
          <Trans
            i18nKey="page.perpsDetail.simpleChart.source"
            components={{
              tradingview: <Text style={styles.link} />,
            }}
          />
        </Text>
      </Pressable>
    );
  },
);
const getStyle = createGetStyles2024(({ colors2024 }) => ({
  link: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    color: colors2024['neutral-secondary'],
  },
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
