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
import { useSetPasswordFirst } from '@/hooks/useLock';

const hitSlop = {
  top: 10,
  bottom: 10,
  left: 10,
  right: 10,
};

export const CloudBackupButton2024: React.FC<HeaderButtonProps> = ({}) => {
  const { shouldRedirectToSetPasswordBefore2024 } = useSetPasswordFirst();

  const onPress = React.useCallback(() => {
    Keyboard.dismiss();
    const id = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.RESTORE_FROM_CLOUD,
      bottomSheetModalProps: {
        enableContentPanningGesture: true,
        enablePanDownToClose: true,
      },
      shouldRedirect2SetPassword: shouldRedirectToSetPasswordBefore2024,
      onDone: () => {
        setTimeout(() => {
          removeGlobalBottomSheetModal2024(id);
        }, 0);
      },
    });
  }, [shouldRedirectToSetPasswordBefore2024]);
  const CloudImageSrc = React.useMemo(() => {
    if (IS_IOS) {
      return require('@/assets2024/icons/common/icloud2x.png');
    }
    return require('@/assets/icons/address/gdrive-gray.png');
  }, []);

  return (
    <CustomTouchableOpacity hitSlop={hitSlop} onPress={onPress}>
      <Image
        // eslint-disable-next-line react-native/no-inline-styles
        style={{
          width: 28,
          height: 28,
        }}
        source={CloudImageSrc}
      />
    </CustomTouchableOpacity>
  );
};
