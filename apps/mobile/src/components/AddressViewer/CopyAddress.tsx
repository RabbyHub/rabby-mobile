import React, { useCallback, useImperativeHandle } from 'react';
import { TouchableOpacity } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { SvgProps } from 'react-native-svg';

import { RcIconCopyCC } from '@/assets/icons/common';
import { useThemeStyles } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import { toast } from '../Toast';

type ContainerOnPressProp = React.ComponentProps<
  typeof TouchableOpacity
>['onPress'] &
  object;
type CopyHandler = (evt?: Parameters<ContainerOnPressProp>[0]) => void;

type Props = {
  address?: string | null;
  style?: SvgProps['style'];
  color?: string;
  onToastSucess?: (ctx: { address: string }) => void;
};
export type CopyAddressIconType = {
  doCopy: CopyHandler;
};
export const CopyAddressIcon = React.forwardRef<CopyAddressIconType, Props>(
  function (
    {
      onToastSucess: propOnToastSucess,
      style,
      // containerStyle,
      address,
      color,
    },
    ref,
  ) {
    const { colors } = useThemeStyles(getStyles);

    const onToastSucess = useCallback<Props['onToastSucess'] & object>(
      ({ address }) => {
        if (propOnToastSucess) propOnToastSucess({ address });
        else {
          toast.success('Copied');
        }
      },
      [propOnToastSucess],
    );

    const handleCopyAddress = useCallback<CopyHandler>(
      (evt?) => {
        if (!address) return null;

        evt?.stopPropagation();
        Clipboard.setString(address);
        onToastSucess({ address });
      },
      [address, onToastSucess],
    );

    useImperativeHandle(ref, () => ({
      doCopy: handleCopyAddress,
    }));

    return (
      <TouchableOpacity style={style} onPress={handleCopyAddress}>
        <RcIconCopyCC color={color || colors['neutral-foot']} style={style} />
      </TouchableOpacity>
    );
  },
);

const getStyles = createGetStyles(colors => {
  return {
    container: {},
  };
});
