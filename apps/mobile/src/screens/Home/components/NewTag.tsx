import React from 'react';
import { Text, View } from 'react-native';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';

export const NewTag: React.FC = () => {
  const { styles, colors2024 } = useTheme2024({ getStyle });

  return (
    <View style={styles.container}>
      <Text
        style={[
          styles.text,
          {
            color: colors2024['red-default'],
          },
        ]}>
        NEW
      </Text>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: colors2024['red-light-1'],
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '600',
    fontFamily: 'SF Pro Rounded',
  },
}));
