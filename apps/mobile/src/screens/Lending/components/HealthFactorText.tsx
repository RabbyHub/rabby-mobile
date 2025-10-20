import React from 'react';
import { Text } from 'react-native';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { formatNum } from '@/utils/math';
import { getHealthStatusColor } from '../utils';

const HealthFactorText = ({ healthFactor }: { healthFactor: string }) => {
  const { styles, isLight } = useTheme2024({ getStyle: getStyles });

  return (
    <Text
      style={[
        styles.hfValue,
        {
          color: getHealthStatusColor(isLight, Number(healthFactor || '0'))
            .color,
        },
      ]}>
      {formatNum(healthFactor)}
    </Text>
  );
};

export default HealthFactorText;

const getStyles = createGetStyles2024(() => ({
  hfValue: {
    fontSize: 17,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
}));
