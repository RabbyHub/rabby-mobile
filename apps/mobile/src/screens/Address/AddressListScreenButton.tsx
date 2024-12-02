import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { IS_ANDROID } from '@/core/native/utils';
import { useAccounts } from '@/hooks/account';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { Dimensions, Text, TouchableOpacity } from 'react-native';

export interface Props {
  type: 'address' | 'watch-address' | 'safe-address';
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
  const { accounts } = useAccounts({
    disableAutoFetch: true,
  });
  const maxHeight = Dimensions.get('window').height - 104;
  const contentHeight =
    accounts.length * (94 + 12) + (IS_ANDROID ? 60 + 56 : 0);

  const onPress = React.useCallback(() => {
    const id = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.ADDRESS_QUICK_MANAGER,
      bottomSheetModalProps: {
        snapPoints: [Math.min(contentHeight, maxHeight)],
      },
      type,
      onCancel: () => {
        removeGlobalBottomSheetModal2024(id);
      },
    });
  }, [contentHeight, maxHeight, type]);

  return (
    <TouchableOpacity
      style={styles.headerRight}
      hitSlop={hitSlop}
      onPress={onPress}>
      <Text style={styles.headerRightText}>Edit</Text>
    </TouchableOpacity>
  );
};
