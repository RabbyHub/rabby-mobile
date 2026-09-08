import { Text } from '@/components/Typography';
import { HeaderBackPressable } from '@/hooks/navigation';
import { useTheme2024 } from '@/hooks/theme';
import { PERPS_PRO_FONT_FAMILY } from '@/screens/PerpsPro/components/common/perpsProVisual';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const PERPS_PRO_HISTORY_HEADER_CONTENT_HEIGHT = 56;

/** Renders the Pro History header with a platform-independent 56px content area. */
export const PerpsProHistoryHeader: React.FC<{ title: string }> = ({
  title,
}) => {
  const { styles } = useTheme2024({ getStyle });
  const { top } = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.outer,
        {
          height: top + PERPS_PRO_HISTORY_HEADER_CONTENT_HEIGHT,
          paddingTop: top,
        },
      ]}>
      <View style={styles.content}>
        <HeaderBackPressable style={styles.backButton} />
        <View pointerEvents="none" style={styles.titleLayer}>
          <Text numberOfLines={1} style={styles.title}>
            {title}
          </Text>
        </View>
      </View>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  outer: {
    backgroundColor: colors2024['neutral-bg-1'],
  },
  content: {
    height: PERPS_PRO_HISTORY_HEADER_CONTENT_HEIGHT,
    position: 'relative',
  },
  backButton: {
    left: 16,
    marginLeft: 0,
    paddingLeft: 0,
    position: 'absolute',
    top: 16,
    zIndex: 1,
  },
  titleLayer: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 56,
    position: 'absolute',
    right: 56,
    top: 0,
  },
  title: {
    color: colors2024['neutral-title-1'],
    fontFamily: PERPS_PRO_FONT_FAMILY,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
    textAlign: 'center',
  },
}));
