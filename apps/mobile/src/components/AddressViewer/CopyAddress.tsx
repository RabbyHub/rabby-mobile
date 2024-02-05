import { useCallback } from 'react';
import { TouchableOpacity } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { SvgProps } from 'react-native-svg';

import { RcIconCopyCC } from '@/assets/icons/common';
import { useThemeStyles } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import { toast } from '../Toast';

type ContainerProps = React.ComponentProps<typeof TouchableOpacity>;

type Props = {
  address?: string | null;
  // containerStyle?: ContainerProps['style'];
  style?: SvgProps['style'];
  color?: string;
};
export function CopyAddressIcon({
  style,
  // containerStyle,
  address,
  color,
}: Props) {
  const { colors } = useThemeStyles(getStyles);

  const handleCopyAddress = useCallback<ContainerProps['onPress'] & object>(
    evt => {
      if (!address) return null;

      evt.stopPropagation();
      Clipboard.setString(address);
      toast.success('Copied');
    },
    [address],
  );

  return (
    <TouchableOpacity style={style} onPress={handleCopyAddress}>
      <RcIconCopyCC color={color || colors['neutral-foot']} style={style} />
    </TouchableOpacity>
  );
}

const getStyles = createGetStyles(colors => {
  return {
    container: {},
  };
});
