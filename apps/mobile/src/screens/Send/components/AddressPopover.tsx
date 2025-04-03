import React, { useMemo } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';

import { Text } from '@/components';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';

interface IProps {
  address: string;
  style?: StyleProp<ViewStyle>;
}
const AddressPopover = ({ address, style }: IProps) => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const addressSplit = useMemo(() => {
    if (!address) {
      return [];
    }
    const prefix = address.slice(0, 6);
    const middle = address.slice(6, -4);
    const suffix = address.slice(-4);

    return [prefix, middle, suffix];
  }, [address]);

  return (
    <View style={[styles.container, style]}>
      <View style={[styles.bubble]}>
        <Text style={styles.qrCardAddress}>
          <Text style={styles.highlightAddrPart}>{addressSplit[0]}</Text>
          {addressSplit[1]}
          <Text style={styles.highlightAddrPart}>{addressSplit[2]}</Text>
        </Text>
      </View>
      <View style={[styles.arrow]} />
    </View>
  );
};

export default AddressPopover;

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  container: {
    position: 'relative',
    alignSelf: 'flex-start',
    marginBottom: 10,
    width: '100%',
  },
  bubble: {
    borderRadius: 12,
    backgroundColor: colors2024['neutral-bg-4'],
    paddingHorizontal: 15.5,
    paddingVertical: 15,
    elevation: 5,
  },
  qrCardAddress: {
    width: '100%',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-secondary'],
    textAlign: 'center',
  },
  highlightAddrPart: {
    color: colors2024['neutral-foot'],
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 20,
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
  },
  arrow: {
    position: 'absolute',
    left: '20%',
    bottom: -6,
    width: 12,
    height: 12,
    borderWidth: 1,
    borderColor: colors2024['neutral-bg-4'],
    transform: [{ rotate: '45deg' }],
    borderBottomWidth: 0,
    borderRightWidth: 0,
    backgroundColor: colors2024['neutral-bg-4'],
    borderRadius: 0,
  },
}));
