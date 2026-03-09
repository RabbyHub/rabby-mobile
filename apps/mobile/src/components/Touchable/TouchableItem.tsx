import * as React from 'react';
import {
  TouchableNativeFeedback,
  TouchableOpacity,
  TouchableWithoutFeedbackProps,
  Platform,
  View,
  StyleProp,
  ViewStyle,
} from 'react-native';

type Props = TouchableWithoutFeedbackProps & {
  delayPressIn?: number;
  borderless?: boolean;
  pressColor?: string;
  pressOpacity?: number;
  children: React.ReactElement;
  style?: StyleProp<ViewStyle>;
};

const LOLLIPOP = 21;

const DEFAULT_PRESS_COLOR = 'rgba(255, 255, 255, .4)';

export default function TouchableItem({
  style,
  pressOpacity,
  pressColor = DEFAULT_PRESS_COLOR,
  borderless,
  children,
  ...rest
}: Props) {
  if (Platform.OS === 'android' && Platform.Version >= LOLLIPOP) {
    return (
      <TouchableNativeFeedback
        {...rest}
        background={TouchableNativeFeedback.Ripple(pressColor, !!borderless)}>
        <View style={style}>{React.Children.only(children)}</View>
      </TouchableNativeFeedback>
    );
  }

  return (
    <TouchableOpacity {...rest} style={style} activeOpacity={pressOpacity}>
      {children}
    </TouchableOpacity>
  );
}
