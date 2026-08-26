import RcAccountCaret from '@/assets2024/icons/perps/PerpsHeaderAccountCaret.svg';
import { Text } from '@/components/Typography';
import { FontNames } from '@/core/utils/fonts';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { Pressable, View } from 'react-native';

export const PerpsAccountTrigger: React.FC<{
  expanded: boolean;
  label: string;
  onPress: () => void;
}> = React.memo(({ expanded, label, onPress }) => {
  const { colors2024, styles } = useTheme2024({ getStyle });
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      onPress={onPress}
      style={styles.trigger}
      testID="perps-account-trigger">
      <Text numberOfLines={1} style={styles.label}>
        {label}
      </Text>
      <View style={[styles.caret, expanded ? styles.expandedCaret : null]}>
        <RcAccountCaret color={colors2024['neutral-foot']} />
      </View>
    </Pressable>
  );
});

PerpsAccountTrigger.displayName = 'PerpsAccountTrigger';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  trigger: {
    alignItems: 'center',
    backgroundColor: colors2024['neutral-bg-1'],
    borderColor: colors2024['neutral-line'],
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 2,
    height: 26,
    maxWidth: 108,
    paddingHorizontal: 6,
  },
  label: {
    color: colors2024['neutral-foot'],
    flexShrink: 1,
    fontFamily: FontNames.sf_pro,
    fontSize: 14,
    fontWeight: '400',
    includeFontPadding: false,
    lineHeight: 18,
  },
  caret: {
    alignItems: 'center',
    height: 8,
    justifyContent: 'center',
    transform: [{ rotate: '180deg' }],
    width: 10,
  },
  expandedCaret: {
    transform: [{ rotate: '0deg' }],
  },
}));
