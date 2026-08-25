import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { View } from 'react-native';

import { resolvePerpsProCloseMarketSourceTag } from '../../model/positionAction';
import {
  getPerpsProSemanticTagContainerStyle,
  getPerpsProSemanticTagTextStyle,
} from '../common/perpsProSemanticTagStyles';

export const PerpsProCloseMarketTag: React.FC<{
  sourceTag: string | null | undefined;
}> = React.memo(({ sourceTag }) => {
  const { styles } = useTheme2024({ getStyle });
  const label = resolvePerpsProCloseMarketSourceTag(sourceTag);

  if (!label) {
    return null;
  }

  return (
    <View style={styles.tag} testID="perps-pro-close-market-tag">
      <Text style={styles.text}>{label}</Text>
    </View>
  );
});

PerpsProCloseMarketTag.displayName = 'PerpsProCloseMarketTag';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  tag: getPerpsProSemanticTagContainerStyle(colors2024, 'neutral', {
    backgroundColor: colors2024['neutral-bg-0'],
  }),
  text: getPerpsProSemanticTagTextStyle(colors2024, 'neutral'),
}));
