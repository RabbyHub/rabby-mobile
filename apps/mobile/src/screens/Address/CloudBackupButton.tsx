import { CustomTouchableOpacity } from '@/components/CustomTouchableOpacity';
import { NativeStackHeaderRightProps } from '@react-navigation/native-stack';
import React from 'react';
import { RootNames } from '@/constant/layout';
import { navigateDeprecated } from '@/utils/navigation';
import { IS_IOS } from '@/core/native/utils';
import { Image } from 'react-native';

const hitSlop = {
  top: 10,
  bottom: 10,
  left: 10,
  right: 10,
};

/** @deprecated */
export const CloudBackupButton: React.FC<
  NativeStackHeaderRightProps
> = ({}) => {
  const onPress = React.useCallback(() => {
    navigateDeprecated(RootNames.StackAddress, {
      screen: RootNames.RestoreFromCloud,
    });
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
