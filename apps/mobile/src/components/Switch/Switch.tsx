import React, { useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  PanResponder,
  TouchableWithoutFeedback,
  StyleProp,
  TextStyle,
  ViewStyle,
  TouchableWithoutFeedbackProps,
  GestureResponderEvent,
} from 'react-native';
import usePrevious from 'react-use/lib/usePrevious';

export type SwitchProps = TouchableWithoutFeedbackProps & {
  onValueChange?: (value: boolean) => void;
  disabled?: boolean;
  activeText?: string;
  inActiveText?: string;
  backgroundActive?: string;
  backgroundInactive?: string;
  value?: boolean;
  circleActiveColor?: string;
  circleInActiveColor?: string;
  circleSize?: number;
  circleBorderActiveColor?: string;
  circleBorderInactiveColor?: string;
  activeTextStyle?: StyleProp<TextStyle>;
  inactiveTextStyle?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  barHeight?: number | null;
  circleBorderWidth?: number;
  renderInsideCircle?: () => React.ReactNode;
  changeValueImmediately?: boolean;
  innerCircleStyle?: StyleProp<ViewStyle>;
  outerCircleStyle?: StyleProp<ViewStyle>;
  renderActiveText?: boolean;
  renderInActiveText?: boolean;
  switchLeftPx?: number;
  switchRightPx?: number;
  switchWidthMultiplier?: number;
  switchBorderRadius?: number | null;
  testID?: string;
};

export type RabbySwitch = {};
const Switch = React.forwardRef<RabbySwitch, SwitchProps>(
  ({
    value: propValue = false,
    onValueChange = () => null,
    renderInsideCircle = () => null,
    disabled = false,
    activeText = 'On',
    inActiveText = 'Off',
    containerStyle,
    activeTextStyle,
    inactiveTextStyle,
    backgroundActive = 'green',
    backgroundInactive = 'gray',
    circleActiveColor = 'white',
    circleInActiveColor = 'white',
    circleBorderActiveColor = 'rgb(100, 100, 100)',
    circleBorderInactiveColor = 'rgb(80, 80, 80)',
    circleSize = 30,
    barHeight = null,
    circleBorderWidth = 1,
    changeValueImmediately = true,
    innerCircleStyle = { alignItems: 'center', justifyContent: 'center' },
    outerCircleStyle = {},
    renderActiveText = true,
    renderInActiveText = true,
    switchLeftPx = 2,
    switchRightPx = 2,
    switchWidthMultiplier = 2,
    switchBorderRadius = null,
    testID = '',
    onPress,
    ...restProps
  }: SwitchProps) => {
    const [
      {
        value,
        transformSwitch,
        backgroundColor,
        circleColor,
        circleBorderColor,
      },
      setState,
    ] = React.useState({
      value: propValue,
      transformSwitch: new Animated.Value(
        propValue ? circleSize / switchLeftPx : -circleSize / switchRightPx,
      ),
      backgroundColor: new Animated.Value(propValue ? 75 : -75),
      circleColor: new Animated.Value(propValue ? 75 : -75),
      circleBorderColor: new Animated.Value(propValue ? 75 : -75),
    });

    const interpolatedColorAnimation = backgroundColor.interpolate({
      inputRange: [-75, 75],
      outputRange: [backgroundInactive, backgroundActive],
    });

    const interpolatedCircleColor = circleColor.interpolate({
      inputRange: [-75, 75],
      outputRange: [circleInActiveColor, circleActiveColor],
    });

    const interpolatedCircleBorderColor = circleBorderColor.interpolate({
      inputRange: [-75, 75],
      outputRange: [circleBorderInactiveColor, circleBorderActiveColor],
    });

    const animateSwitch = useCallback(
      (val: boolean, cb = () => {}) => {
        Animated.parallel([
          Animated.spring(transformSwitch, {
            toValue: val
              ? circleSize / switchLeftPx
              : -circleSize / switchRightPx,
            useNativeDriver: false,
          }),
          Animated.timing(backgroundColor, {
            toValue: val ? 75 : -75,
            duration: 200,
            useNativeDriver: false,
          }),
          Animated.timing(circleColor, {
            toValue: val ? 75 : -75,
            duration: 200,
            useNativeDriver: false,
          }),
          Animated.timing(circleBorderColor, {
            toValue: val ? 75 : -75,
            duration: 200,
            useNativeDriver: false,
          }),
        ]).start(cb);
      },
      [
        transformSwitch,
        circleSize,
        switchLeftPx,
        switchRightPx,
        backgroundColor,
        circleColor,
        circleBorderColor,
      ],
    );

    // const previousDisabled = usePrevious(disabled);
    useEffect(() => {
      if (propValue === value) return;
      // if (disabled === previousDisabled) return;

      animateSwitch(propValue, () => {
        setState(prev => ({ ...prev, value: propValue }));
      });
    }, [
      animateSwitch,
      propValue,
      value,
      // disabled,
      // previousDisabled
    ]);

    const handleSwitch = useCallback(
      (evt: GestureResponderEvent) => {
        onPress?.(evt);

        if (disabled) return;

        if (propValue === value) {
          onValueChange(!value);
          return;
        }

        if (changeValueImmediately) {
          animateSwitch(!propValue);
          onValueChange(!propValue);
        } else {
          animateSwitch(!propValue, () => {
            setState(prev => ({ ...prev, value: !propValue }));
            onValueChange(!propValue);
          });
        }
      },
      [
        disabled,
        propValue,
        value,
        changeValueImmediately,
        onValueChange,
        animateSwitch,
        onPress,
      ],
    );

    return (
      <TouchableWithoutFeedback onPress={handleSwitch} {...restProps}>
        <Animated.View
          style={[
            styles.container,
            containerStyle,
            {
              backgroundColor: interpolatedColorAnimation,
              width: circleSize * switchWidthMultiplier,
              height: barHeight || circleSize,
              borderRadius: switchBorderRadius || circleSize,
            },
          ]}>
          <Animated.View
            style={[
              styles.animatedContainer,
              {
                left: transformSwitch,
                width: circleSize * switchWidthMultiplier,
              },
              outerCircleStyle,
            ]}>
            {propValue && renderActiveText && (
              <Text style={[styles.text, styles.paddingRight, activeTextStyle]}>
                {activeText}
              </Text>
            )}

            <Animated.View
              style={[
                styles.circle,
                {
                  borderWidth: circleBorderWidth,
                  borderColor: interpolatedCircleBorderColor,
                  backgroundColor: interpolatedCircleColor,
                  width: circleSize,
                  height: circleSize,
                  borderRadius: circleSize / 2,
                },
                innerCircleStyle,
              ]}>
              {renderInsideCircle()}
            </Animated.View>
            {!propValue && renderInActiveText && (
              <Text
                style={[styles.text, styles.paddingLeft, inactiveTextStyle]}>
                {inActiveText}
              </Text>
            )}
          </Animated.View>
        </Animated.View>
      </TouchableWithoutFeedback>
    );
  },
);

export const RabbySwitch = Switch;

const styles = StyleSheet.create({
  container: {
    width: 71,
    height: 30,
    borderRadius: 30,
    backgroundColor: 'black',
  },
  animatedContainer: {
    flex: 1,
    width: 78,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  circle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'white',
  },
  text: {
    color: 'white',
    backgroundColor: 'transparent',
  },
  paddingRight: {
    paddingRight: 5,
  },
  paddingLeft: {
    paddingLeft: 5,
  },
});
