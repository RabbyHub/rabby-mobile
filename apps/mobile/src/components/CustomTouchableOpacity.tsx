import { useCallback, useMemo, useRef } from 'react';
import { TouchableOpacity } from 'react-native';
import {
  TouchableOpacity as RNGHTouchableOpacity,
  Pressable as RNGHPressable,
} from 'react-native-gesture-handler';

const DefaultOpacity = 0.8;

type ViewAsMap = {
  TouchableOpacity: typeof TouchableOpacity;
  RNGHTouchableOpacity: typeof RNGHTouchableOpacity;
  // RNGHPressable: typeof RNGHPressable;
};
export type NativeViewAs = keyof ViewAsMap;

export function getViewComponentByAs<T extends NativeViewAs>(
  as: T = 'TouchableOpacity' as T,
) {
  switch (as) {
    case 'RNGHTouchableOpacity':
      return RNGHTouchableOpacity;
    // case 'RNGHPressable':
    //   return RNGHPressable;
    case 'TouchableOpacity':
    default:
      return TouchableOpacity;
  }
}

type Props<T extends NativeViewAs> = {
  as?: T;
} & React.ComponentProps<ViewAsMap[T]>;

/**
 * @see https://stackoverflow.com/questions/47979866/dynamic-opacity-not-changing-when-component-rerenders-in-react-native
 */
export const CustomTouchableOpacity = <T extends NativeViewAs>({
  as = 'TouchableOpacity' as T,
  onPress: _onPress,
  onPressIn: _onPressIn,
  onPressOut: _onPressOut,
  ...rest
}: Props<T>) => {
  const pressInPagePointRef = useRef({ x: 0, y: 0 });

  const handlePressIn = useCallback(
    (e?: any) => {
      if (e) {
        pressInPagePointRef.current = {
          x: e.nativeEvent.pageX,
          y: e.nativeEvent.pageY,
        };
      }

      _onPressIn?.(e);
    },
    [_onPressIn],
  );

  const handlePressOut = useCallback(
    (e?: any) => {
      _onPressOut?.(e);

      if (e) {
        const [x, y] = [e.nativeEvent.pageX, e.nativeEvent.pageY];
        if (
          Math.abs(pressInPagePointRef.current.x - x) > 10 ||
          Math.abs(pressInPagePointRef.current.y - y) > 10
        ) {
          e.preventDefault();
        }
      }
    },
    [_onPressOut],
  );

  const onPress = useCallback(
    (e?: any) => {
      if (e?.isDefaultPrevented()) {
        return;
      }

      _onPress?.(e);
    },
    [_onPress],
  );

  const TouchableOpacityComp = useMemo(() => getViewComponentByAs(as), [as]);

  return (
    // @ts-expect-error
    <TouchableOpacityComp
      activeOpacity={DefaultOpacity}
      {...rest}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
    />
  );
};
