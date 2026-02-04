import React, { useCallback, useImperativeHandle, useMemo } from 'react';
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

import RcIconCopyCC from '@/assets2024/icons/address/mcopy.svg';
import { useThemeStyles } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import { toast } from '@/components2024/Toast';
import i18next from 'i18next';

type ContainerOnPressProp = React.ComponentProps<
  typeof TouchableOpacity
>['onPress'] &
  object;
type CopyHandler = (evt?: Parameters<ContainerOnPressProp>[0]) => void;

type Props = {
  address?: string | null;
  style?: SvgProps['style'];
  color?: string;
  onToastSuccess?: (ctx: { address: string }) => void;
  title?: string;
  titleStyle?: StyleProp<TextStyle>;
  icon?:
    | React.ReactNode
    | ((ctx: {
        defaultNode: React.ReactNode;
        iconStyle: SvgProps['style'];
        iconColor: string;
      }) => React.ReactNode);
};
export type CopyAddressIconType = {
  doCopy: CopyHandler;
};
export const CopyAddressIcon = React.forwardRef<CopyAddressIconType, Props>(
  function (
    {
      onToastSuccess: propOnToastSucess,
      style,
      // containerStyle,
      address,
      color,
      title,
      titleStyle,
      icon,
    },
    ref,
  ) {
    const { colors } = useThemeStyles(getStyles);

    const onToastSuccess = useCallback<Props['onToastSuccess'] & object>(
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
        onToastSuccess({ address });
      },
      [address, onToastSuccess],
    );

    useImperativeHandle(ref, () => ({
      doCopy: handleCopyAddress,
    }));

    const iconNode = useMemo(() => {
      const iconColor = color || colors['neutral-foot'];
      const defaultNode = <RcIconCopyCC color={iconColor} style={style} />;

      if (!icon) return defaultNode;

      if (typeof icon === 'function') {
        return icon({
          defaultNode,
          iconStyle: style,
          iconColor: iconColor,
        });
      }
    }, [icon, color, colors, style]);

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
        {iconNode}
        {title && <Text style={titleStyle}>{title}</Text>}
      </TouchableOpacity>
    );
  },
);

export function toastCopyAddressSuccess(address?: string, title?: string) {
  if (!address) {
    toast.success(i18next.t('global.copied'));
    return;
  }

  toast.success(tctx => {
    return (
      <View
        style={{
          flexDirection: 'column',
          justifyContent: 'flex-start',
        }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {tctx.iconNode}
          <Text style={[tctx.styles.text, tctx.styles.selfDefinedContent]}>
            {title ? title : i18next.t('global.copied')}
          </Text>
        </View>
        <Text style={[tctx.styles.text, tctx.styles.selfDefinedContent]}>
          {address}
        </Text>
      </View>
    );
  });
}

const getStyles = createGetStyles(colors => {
  return {
    container: {},
  };
});
