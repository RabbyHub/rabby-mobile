import React from 'react';
import type { StyleProp, TextStyle } from 'react-native';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';

const ADDRESS_HALF_LENGTH = 21;

/**
 * Splits a 42-char EVM address into two 21-char halves, so wide glyphs
 * (digits) can't push the second half onto a third line.
 */
export const splitAddressInTwoLines = (address: string) =>
  address.length === ADDRESS_HALF_LENGTH * 2
    ? `${address.slice(0, ADDRESS_HALF_LENGTH)}\n${address.slice(
        ADDRESS_HALF_LENGTH,
      )}`
    : address;

export function DetailAddressText({
  address,
  style,
}: {
  address?: string;
  style?: StyleProp<TextStyle>;
}) {
  const { styles } = useTheme2024({ getStyle });

  return (
    <Text style={[styles.address, style]}>
      {splitAddressInTwoLines(address || '')}
    </Text>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  address: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    textAlign: 'right',
    // the widest possible half ("0" x 21) is ~178pt at 14pt SF Pro Rounded
    width: 182,
    maxWidth: '100%',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '400',
  },
}));
