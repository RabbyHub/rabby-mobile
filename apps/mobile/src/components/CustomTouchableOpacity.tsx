import { useCallback, useRef } from 'react';
import { TouchableOpacity, TouchableOpacityProps } from 'react-native';

const DefaultOpacity = 0.8;

/**
 * @see https://stackoverflow.com/questions/47979866/dynamic-opacity-not-changing-when-component-rerenders-in-react-native
 */
export const CustomTouchableOpacity = ({
  onPress: _onPress,
  onPressIn: _onPressIn,
  onPressOut: _onPressOut,
  ...rest
}: TouchableOpacityProps) => {
  const pressInPagePointRef = useRef({ x: 0, y: 0 });

  const handlePressIn = useCallback(
    (e: any) => {
      pressInPagePointRef.current = {
        x: e.nativeEvent.pageX,
        y: e.nativeEvent.pageY,
      };

      _onPressIn?.(e);
    },
    [_onPressIn],
  );

  const handlePressOut = useCallback(
    (e: any) => {
      _onPressOut?.(e);

      const [x, y] = [e.nativeEvent.pageX, e.nativeEvent.pageY];
      if (
        Math.abs(pressInPagePointRef.current.x - x) > 10 ||
        Math.abs(pressInPagePointRef.current.y - y) > 10
      ) {
        e.preventDefault();
      }
    },
    [_onPressOut],
  );

  const onPress = useCallback(
    (e: any) => {
      if (e.isDefaultPrevented()) {
        return;
      }

      _onPress?.(e);
    },
    [_onPress],
  );

  return (
    <TouchableOpacity
      activeOpacity={DefaultOpacity}
      {...rest}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
    />
  );
};
