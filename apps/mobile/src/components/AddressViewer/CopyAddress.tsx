import React, { useCallback, useImperativeHandle } from 'react';
import {
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  StyleProp,
  TextStyle,
} from 'react-native';
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
  title?: string;
  titleStyle?: StyleProp<TextStyle>;
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
      title,
      titleStyle,
    },
    ref,
  ) {
    const { colors } = useThemeStyles(getStyles);

    const onToastSucess = useCallback<Props['onToastSucess'] & object>(
      ({ address }) => {
        if (propOnToastSucess) propOnToastSucess({ address });
        else {
          toastCopyAddressSuccess(address);
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
      <TouchableOpacity
        style={StyleSheet.flatten([
          style,
          title
            ? {
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }
            : {},
        ])}
        onPress={handleCopyAddress}>
        <RcIconCopyCC color={color || colors['neutral-foot']} style={style} />
        {title && <Text style={titleStyle}>{title}</Text>}
      </TouchableOpacity>
    );
  },
);

export function toastCopyAddressSuccess(address?: string) {
  if (!address) {
    toast.success('Copied');
    return;
  }

  toast.success(tctx => {
    return (
      <View
        style={{
          flexDirection: 'column',
          justifyContent: 'flex-start',
        }}>
        <Text style={tctx.textStyle}>Copied</Text>
        <Text style={tctx.textStyle}>{address}</Text>
      </View>
    );
  });
}

const getStyles = createGetStyles(colors => {
  return {
    container: {},
  };
});
