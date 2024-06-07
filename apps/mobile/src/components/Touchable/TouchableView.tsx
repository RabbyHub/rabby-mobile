import {
  ReactNativeViewAs,
  ReactNativeViewAsMap,
  getViewComponentByAs,
} from '@/hooks/common/useReactNativeViews';
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

type SilentProps<T extends ReactNativeViewAs = 'View'> = React.ComponentProps<
  typeof TouchableWithoutFeedback
> & {
  viewStyle?: StyleProp<ViewStyle>;
  as?: T;
  viewProps?: React.ComponentProps<ReactNativeViewAsMap[T]>;
};
export function SilentTouchableView<T extends ReactNativeViewAs = 'View'>(
  props: SilentProps<T>,
) {
  const { children, viewProps, viewStyle, as, ...rest } = props;

  const ViewComp = React.useMemo(() => {
    return getViewComponentByAs(as);
  }, [as]);

  return (
    <TouchableWithoutFeedback {...rest}>
      <ViewComp
        {...viewProps}
        style={StyleSheet.flatten([viewStyle, viewProps?.style])}>
        {children}
      </ViewComp>
    </TouchableWithoutFeedback>
  );
}
