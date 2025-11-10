import React from 'react';
import { Text } from 'react-native';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { formatNum } from '@/utils/math';
import { getHealthStatusColor } from '../utils';

const HealthFactorText = ({
  healthFactor,
  limitless,
}: {
  healthFactor: string;
  limitless?: boolean;
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });

  return (
    <Text
      style={[
        styles.hfValue,
        {
          color: limitless
            ? colors2024['green-default']
            : getHealthStatusColor(Number(healthFactor || '0')).color,
        },
      ]}>
      {limitless ? ' ∞' : getHealthFactorText(healthFactor)}
    </Text>
  );
};

export const getHealthFactorText = (healthFactor: string) => {
  if (Number(healthFactor) > 100) {
    return '100+';
  }
  return formatNum(healthFactor);
};

export default HealthFactorText;

const getStyles = createGetStyles2024(() => ({
  hfValue: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
}));
