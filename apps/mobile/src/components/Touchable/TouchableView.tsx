import {
  ReactNativeViewAs,
  ReactNativeViewAsMap,
  getViewComponentByAs,
} from '@/hooks/common/useReactNativeViews';
import * as React from 'react';
import {
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleProp,
  ViewStyle,
  GestureResponderEvent,
  View,
  StyleSheet,
} from 'react-native';
import { IS_IOS } from '@/core/native/utils';

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

/**
 * @deprecated use TouchableOpacity instead
 */
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
  typeof TouchableOpacity | typeof TouchableOpacity
> & {
  viewStyle?: StyleProp<ViewStyle>;
  as?: T;
  viewProps?: React.ComponentProps<ReactNativeViewAsMap[T]>;
  /**
   * @description for react-native@>=0.73, react-native-svg would cause error like
   * "-[RNSVGSvgView setOnClick:]: unrecognized selector sent to instance..." for this kind of component:
   *
   * ```js
   *    import { TouchableWithoutFeedback } from 'react-native';
   *    import RcIcon from 'path/to/foo.svg';
   *
   *    <TouchableWithoutFeedback onPress={onPress}>
   *      <RcIcon />
   *    </TouchableWithoutFeedback>
   * ```
   *
   * @see https://github.com/software-mansion/react-native-svg/issues/2219#issuecomment-1957357059
   **/
  __wrapSvgStraightOnIOS__?: boolean;
};
export function SilentTouchableView<T extends ReactNativeViewAs = 'View'>(
  props: SilentProps<T>,
) {
  const {
    children,
    viewProps,
    viewStyle,
    __wrapSvgStraightOnIOS__ = false,
    as,
    ...rest
  } = props;

  const ViewComp = React.useMemo(() => {
    return getViewComponentByAs(as);
  }, [as]);

  const TouchableComp =
    __wrapSvgStraightOnIOS__ && IS_IOS
      ? TouchableOpacity
      : TouchableWithoutFeedback;

  return (
    <TouchableComp {...rest}>
      <ViewComp
        {...viewProps}
        style={StyleSheet.flatten([viewStyle, viewProps?.style])}>
        {children}
      </ViewComp>
    </TouchableComp>
  );
}
