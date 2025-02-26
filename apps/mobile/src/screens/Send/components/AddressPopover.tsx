import React, { useMemo } from 'react';
import { View } from 'react-native';

import { Text } from '@/components';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';

interface IProps {
  address: string;
}
const AddressPopover = ({ address }: IProps) => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const addressSplit = useMemo(() => {
    if (!address) {
      return [];
    }
    const prefix = address.slice(0, 10);
    const middle = address.slice(10, -6);
    const suffix = address.slice(-6);

    return [prefix, middle, suffix];
  }, [address]);

  return (
    <View style={styles.container}>
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
    marginBottom: 18,
    width: '100%',
  },
  bubble: {
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    backgroundColor: colors2024['neutral-bg-4'],
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
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
    color: colors2024['neutral-title-1'],
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 20,
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
  },
  arrow: {
    position: 'absolute',
    bottom: -10,
    left: '20%',
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 10,
    borderStyle: 'solid',
    borderColor: colors2024['neutral-bg-4'],
    backgroundColor: 'transparent',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
}));
