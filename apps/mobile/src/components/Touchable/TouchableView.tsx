import * as React from 'react';
import { TouchableOpacity, StyleProp, ViewStyle } from 'react-native';

type Props = React.ComponentProps<typeof TouchableOpacity> & {
  onPress: () => void;
  onLongPress?: () => void;
  delayPressIn?: number;
  borderless?: boolean;
  pressColor?: string;
  pressOpacity?: number;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

const LOLLIPOP = 21;

export default class TouchableView extends React.Component<Props> {
  static defaultProps = {
    pressColor: 'rgba(255, 255, 255, .4)',
  };

  render() {
    const { pressOpacity, pressColor, borderless, children, ...rest } =
      this.props;

    return (
      <TouchableOpacity {...rest} activeOpacity={pressOpacity}>
        {children}
      </TouchableOpacity>
    );
  }
}
