import { CustomTouchableOpacity } from '@/components/CustomTouchableOpacity';
import { HeaderButtonProps } from '@react-navigation/native-stack/lib/typescript/src/types';
import React from 'react';
import { RootNames } from '@/constant/layout';
import { navigate } from '@/utils/navigation';
import { IS_IOS } from '@/core/native/utils';
import { Image } from 'react-native';

const hitSlop = {
  top: 10,
  bottom: 10,
  left: 10,
  right: 10,
};

export const CloudBackupButton: React.FC<HeaderButtonProps> = ({}) => {
  const onPress = React.useCallback(() => {
    navigate(RootNames.RestoreFromCloud);
  }, []);
  const CloudImageSrc = React.useMemo(() => {
    if (IS_IOS) {
      return require('@/assets/icons/address/icloud.png');
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
