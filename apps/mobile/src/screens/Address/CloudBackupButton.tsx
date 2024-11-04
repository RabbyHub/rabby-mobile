import { CustomTouchableOpacity } from '@/components/CustomTouchableOpacity';
import { HeaderButtonProps } from '@react-navigation/native-stack/lib/typescript/src/types';
import React from 'react';
import { IS_IOS } from '@/core/native/utils';
import { Image, Keyboard } from 'react-native';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';

const hitSlop = {
  top: 10,
  bottom: 10,
  left: 10,
  right: 10,
};

export const CloudBackupButton: React.FC<HeaderButtonProps> = ({}) => {
  const onPress = React.useCallback(() => {
    Keyboard.dismiss();
    const id = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.RESTORE_FROM_CLOUD,
      onDone: () => {
        setTimeout(() => {
          removeGlobalBottomSheetModal2024(id);
        }, 0);
      },
    });
  }, []);
  const CloudImageSrc = React.useMemo(() => {
    if (IS_IOS) {
      return require('@/assets2024/icons/common/icloud.svg');
    }
    return require('@/assets/icons/address/gdrive.png');
  }, []);

  return (
    <CustomTouchableOpacity hitSlop={hitSlop} onPress={onPress}>
      <Image
        // eslint-disable-next-line react-native/no-inline-styles
        style={{
          width: 32,
          height: 32,
        }}
        source={CloudImageSrc}
      />
    </CustomTouchableOpacity>
  );
};
