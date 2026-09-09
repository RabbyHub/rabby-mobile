import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { View } from 'react-native';
import { PerpsProEmptyIllustration } from './PerpsProEmptyIllustration';

export const PerpsProEmptyState: React.FC<{
  message: string;
  testID: string;
}> = React.memo(({ message, testID }) => {
  const { isLight, styles } = useTheme2024({ getStyle });

  return (
    <View style={styles.container} testID={testID}>
      <PerpsProEmptyIllustration
        isLight={isLight}
        testID={`${testID}-illustration`}
      />
      <Text style={styles.message}>{message}</Text>
    </View>
  );
});

PerpsProEmptyState.displayName = 'PerpsProEmptyState';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    alignItems: 'center',
    flex: 1,
    paddingTop: 80,
  },
  message: {
    color: colors2024['neutral-info'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 18,
    marginTop: 12,
    textAlign: 'center',
  },
}));
