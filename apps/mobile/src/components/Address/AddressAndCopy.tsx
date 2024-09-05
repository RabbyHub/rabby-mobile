import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import React from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  TextStyle,
} from 'react-native';
import { RcIconCopyCC } from '@/assets/icons/common';
import { formatAddressToShow } from '@/utils/address';
import Clipboard from '@react-native-clipboard/clipboard';
import { toastCopyAddressSuccess } from '@/components/AddressViewer/CopyAddress';

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    itemAddress: {
      color: colors['neutral-title-1'],
      fontSize: 16,
      fontWeight: '500',
    },

    itemAddressWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      columnGap: 4,
    },
  });

interface Props {
  address: string;
  style?: StyleProp<TextStyle>;
}

export const AddressAndCopy: React.FC<Props> = ({ address, style }) => {
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  const onCopy = React.useCallback((_address: string) => {
    Clipboard.setString(_address);
    toastCopyAddressSuccess(_address);
  }, []);

  return (
    <View style={styles.itemAddressWrap}>
      <Text style={StyleSheet.flatten([styles.itemAddress, style])}>
        {formatAddressToShow(address, {
          ellipsis: true,
        })}
      </Text>
      <TouchableOpacity
        hitSlop={10}
        onPress={e => {
          e.stopPropagation();
          onCopy(address);
        }}>
        <RcIconCopyCC color={colors['neutral-foot']} width={14} height={14} />
      </TouchableOpacity>
    </View>
  );
};
