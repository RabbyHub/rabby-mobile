import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { Text, TouchableOpacity } from 'react-native';

export interface Props {
  type: 'address' | 'watch-address';
}

const hitSlop = {
  top: 10,
  bottom: 10,
  left: 10,
  right: 10,
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  headerRight: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  headerRightText: {
    color: colors2024['brand-default'],
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
  },
}));

export const AddressListScreenButton: React.FC<Props> = ({
  type = 'address',
}) => {
  const { styles } = useTheme2024({ getStyle });
  const onPress = React.useCallback(() => {
    const id = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.ADDRESS_QUICK_MANAGER,
      type,
      bottomSheetModalProps: {
        enableDynamicSizing: true,
      },
      onCancel: () => {
        removeGlobalBottomSheetModal2024(id);
      },
    });
  }, [type]);

  return (
    <TouchableOpacity
      style={styles.headerRight}
      hitSlop={hitSlop}
      onPress={onPress}>
      <Text style={styles.headerRightText}>Edit</Text>
    </TouchableOpacity>
  );
};
