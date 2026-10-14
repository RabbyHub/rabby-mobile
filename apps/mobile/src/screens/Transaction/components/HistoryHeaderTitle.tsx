import React from 'react';
import { Platform } from 'react-native';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';

export function HistoryHeaderTitle({ children }: React.PropsWithChildren) {
  const { styles } = useTheme2024({ getStyle });
  return (
    <Text style={styles.title} numberOfLines={1}>
      {children}
    </Text>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  title: {
    color: colors2024['neutral-title-1'],
    fontWeight: '900',
    fontSize: 20,
    fontFamily: 'SF Pro Rounded',
    // Android's explicit LineHeightSpan clamps the first/last line to the
    // rounded Latin font's metrics, clipping taller fallback CJK glyphs.
    lineHeight: Platform.OS === 'android' ? undefined : 24,
  },
}));
