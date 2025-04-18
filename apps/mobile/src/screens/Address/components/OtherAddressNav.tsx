import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import ArrowRightSVG from '@/assets2024/icons/common/arrow-right-cc.svg';

export const OtherAddressNav = ({ onPress, text }) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });

  return (
    <TouchableOpacity onPress={onPress} style={styles.sectionFooter}>
      <Text style={styles.headlineText}>{text}</Text>
      <ArrowRightSVG
        style={styles.arrow}
        width={14}
        height={14}
        color={colors2024['neutral-secondary']}
      />
    </TouchableOpacity>
  );
};
const getStyle = createGetStyles2024(({ colors2024 }) => ({
  headlineText: {
    fontSize: 16,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '500',
    lineHeight: 20,
    color: colors2024['neutral-secondary'],
  },
  sectionFooter: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    flexDirection: 'row',
    gap: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrow: {
    marginTop: 2,
  },
}));
