import { RcIconGlobeCC, RcIconJumpCC } from '@/assets/icons/dapp';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { StyleProp, Text, ViewStyle } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';

export const LinkCard = ({
  url,
  onPress,
  style,
}: {
  url: string;
  style?: StyleProp<ViewStyle>;
  onPress?: (origin: string) => void;
}) => {
  const { styles, colors2024 } = useTheme2024({
    getStyle,
  });

  if (url) {
    return (
      <TouchableOpacity
        onPress={() => onPress?.(url)}
        style={[styles.card, style]}>
        <RcIconGlobeCC color={colors2024['neutral-info']} />
        <Text style={styles.text} numberOfLines={1}>
          {url}
        </Text>
        <RcIconJumpCC color={colors2024['neutral-body']} />
      </TouchableOpacity>
    );
  }

  return null;
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors2024['neutral-bg-1'],
    padding: 24,
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
    gap: 8,
    borderRadius: 30,
  },
  text: {
    flex: 1,
    color: colors2024['brand-default'],
    fontSize: 17,
    lineHeight: 22,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
  },
}));
