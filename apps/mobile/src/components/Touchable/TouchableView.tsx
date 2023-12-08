import * as React from 'react';
import {
  TouchableNativeFeedback,
  TouchableOpacity,
  Platform,
  View,
  StyleProp,
  ViewStyle,
  ViewProps,
} from 'react-native';

type Props = ViewProps & {
  onPress: () => void;
  onLongPress?: () => void;
  delayPressIn?: number;
  borderless?: boolean;
  pressColor: string;
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
    const { style, pressOpacity, pressColor, borderless, children, ...rest } =
      this.props;

    return (
      <TouchableOpacity {...rest} style={style} activeOpacity={pressOpacity}>
        {children}
      </TouchableOpacity>
    );
  }
}
