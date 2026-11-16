import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

/** Take Profit / Stop Loss section title with its 4x14 color bar
 * (Figma 86937:295410).
 */
export const PerpsProSectionTitle: React.FC<{
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  tone: 'negative' | 'positive';
}> = ({ children, style, testID, tone }) => {
  const { styles } = useTheme2024({ getStyle });
  return (
    <View style={[styles.container, style]} testID={testID}>
      <View
        style={[
          styles.bar,
          tone === 'positive' ? styles.positiveBar : styles.negativeBar,
        ]}
      />
      <Text numberOfLines={1} style={styles.text}>
        {children}
      </Text>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  bar: {
    borderRadius: 2,
    height: 14,
    width: 4,
  },
  positiveBar: { backgroundColor: colors2024['green-default'] },
  negativeBar: { backgroundColor: colors2024['red-default'] },
  text: {
    color: colors2024['neutral-title-1'],
    flexShrink: 1,
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
  },
}));
