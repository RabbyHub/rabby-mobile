import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { View } from 'react-native';

import { resolvePerpsProCloseMarketSourceTag } from '../../model/positionAction';

export const PerpsProCloseMarketTag: React.FC<{
  sourceTag: string | null | undefined;
}> = React.memo(({ sourceTag }) => {
  const { styles } = useTheme2024({ getStyle });

  return (
    <View style={styles.tag} testID="perps-pro-close-market-tag">
      <Text style={styles.text}>
        {resolvePerpsProCloseMarketSourceTag(sourceTag)}
      </Text>
    </View>
  );
});

PerpsProCloseMarketTag.displayName = 'PerpsProCloseMarketTag';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  tag: {
    backgroundColor: colors2024['neutral-bg-0'],
    borderColor: colors2024['neutral-line'],
    borderRadius: 2,
    borderWidth: 0.5,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  text: {
    color: colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 10,
    fontWeight: '500',
    lineHeight: 12,
  },
}));
