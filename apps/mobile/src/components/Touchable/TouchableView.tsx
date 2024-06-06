import * as React from 'react';
import {
  TouchableOpacity,
  StyleProp,
  ViewStyle,
  GestureResponderEvent,
  TouchableWithoutFeedback,
  View,
  StyleSheet,
} from 'react-native';

type Props = React.ComponentProps<typeof TouchableOpacity> & {
  onPress: (event: GestureResponderEvent) => void;
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

type SilentProps = React.ComponentProps<typeof TouchableWithoutFeedback> & {
  viewStyle?: StyleProp<ViewStyle>;
  viewProps?: React.ComponentProps<typeof View>;
};
export function SilentTouchableView(props: SilentProps) {
  const { children, viewProps, viewStyle, ...rest } = props;
  return (
    <TouchableWithoutFeedback {...rest}>
      <View
        {...viewProps}
        style={StyleSheet.flatten([viewStyle, viewProps?.style])}>
        {children}
      </View>
    </TouchableWithoutFeedback>
  );
}
