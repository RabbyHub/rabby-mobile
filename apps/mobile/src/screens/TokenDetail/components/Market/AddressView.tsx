import React, { useCallback } from 'react';
import { Pressable, Text } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { trigger } from 'react-native-haptic-feedback';

import { toastCopyAddressSuccess } from '@/components/AddressViewer/CopyAddress';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { shortEllipsisAddress } from '@/utils/address';

import RcIconCopy from '@/assets2024/singleHome/copy.svg';

interface IProps {
  address: string;
}
const AddressView = ({ address }: IProps) => {
  const { styles } = useTheme2024({ getStyle: getStyles });

  const handleCopyAddress = useCallback(
    evt => {
      evt.stopPropagation();
      if (!address) {
        return;
      }
      trigger('impactLight', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
      Clipboard.setString(address);
      toastCopyAddressSuccess(address);
    },
    [address],
  );

  return (
    <Pressable style={styles.container} onPress={handleCopyAddress}>
      <Text style={styles.addressItem} ellipsizeMode="tail" numberOfLines={1}>
        {address ? shortEllipsisAddress(address, 4) : '-'}
      </Text>
      <RcIconCopy width={10} height={10} style={styles.copy} />
    </Pressable>
  );
};

export default AddressView;

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  container: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    justifyContent: 'flex-end',
  },
  addressItem: {
    fontSize: 12,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
  },
  copy: {
    width: 10,
    height: 10,
  },
}));
