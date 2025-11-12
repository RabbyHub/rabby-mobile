import React, {
  useRef,
  useEffect,
  useState,
  Children,
  useCallback,
  useMemo,
} from 'react';
import {
  StyleSheet,
  Text,
  View,
  ViewStyle,
  TextStyle,
  TextProps,
  I18nManager,
  LayoutChangeEvent,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import usePrevious from 'react-use/lib/usePrevious';

const styles = StyleSheet.create({
  row: {
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
    overflow: 'hidden',
  },
  hide: {
    position: 'absolute',
    top: 0,
    left: 0,
    opacity: 0,
  },
});

const uniq = (values: string[]) => {
  return values.filter((value, index) => {
    return values.indexOf(value) === index;
  });
};

const range = (length: number) => Array.from({ length }, (x, i) => i);
const NUMBER_ITEMS = [...range(10).map(p => p + ''), ',', '.'];
const splitText = (text = '') => (text + '').split('');
const isNumber = (v: string) => !isNaN(parseInt(v));

const getPosition = ({
  text,
  items,
  height,
}: {
  text: string;
  items: string[];
  height: number;
}) => {
  const index = items.findIndex(p => p === text);
  return {
    index,
    position: index * height * -1,
  };
};

type MeasureMap = Record<string, { width: number; height: number }>;

interface TickProps {
  children: string;
  duration?:
    | number
    | ((ctx: { itemIndex: number; prevItemIndex: number }) => number);
  textStyle?: TextStyle;
  textProps?: TextProps;
  rotateItems: string[];
  measureMap?: MeasureMap;
}

export const TickItem = ({
  children,
  duration: propDuration = 500,
  textStyle,
  textProps,
  measureMap,
  rotateItems,
}: TickProps) => {
  const measurement = useMemo(() => {
    return measureMap?.[children] || { height: 0, width: 0 };
  }, [children, measureMap]);

  const { position, index: itemIndex } = getPosition({
    text: children,
    height: measurement.height,
    items: rotateItems,
  });
  const prevItemIndex = usePrevious(itemIndex) || 0;

  const widthAnim = useSharedValue(measurement.width);
  const stylePos = useSharedValue(position);

  const animatedStyles = useAnimatedStyle(() => ({
    height: measurement.height,
    width: widthAnim.value,
    // overflow: 'hidden',
    transform: [{ translateY: stylePos.value }],
  }));

  const duration = useMemo(() => {
    if (typeof propDuration === 'function') {
      return propDuration({ itemIndex, prevItemIndex });
    }

    return propDuration;
  }, [propDuration, itemIndex, prevItemIndex]);

  useEffect(() => {
    const curve = Easing.bezier(0.42, 0, 0.58, 1);
    stylePos.value = withTiming(position, {
      duration: duration,
      easing: curve,
    });
    widthAnim.value = withTiming(measurement.width, {
      duration: 25,
      easing: Easing.linear,
    });
  }, [position, measurement, duration, stylePos, widthAnim]);

  return (
    <Animated.View style={animatedStyles}>
      {rotateItems.map(v => (
        <Text
          key={v}
          {...textProps}
          style={[textStyle, { height: measurement.height }]}>
          {v}
        </Text>
      ))}
    </Animated.View>
  );
};

interface Props {
  duration?: TickProps['duration'];
  containerStyle?: ViewStyle;
  textStyle?: TextStyle;
  textProps?: TextProps;
  additionalDisplayItems?: string[];
  children?: React.ReactNode;
}

const TickerTexts = ({
  duration = 250,
  containerStyle,
  textStyle,
  textProps,
  children,
}: Props) => {
  const [measured, setMeasured] = useState<boolean>(false);

  const measureMap = useRef<MeasureMap>({});
  const measureStrings: string[] = Children.map(children as any, child => {
    if (typeof child === 'string' || typeof child === 'number') {
      return splitText(`${child}`);
    } else if (child) {
      return child?.props && child?.props?.rotateItems;
    }
  }).reduce((acc, val) => acc.concat(val), [] as string[]);

  const hasNumbers = measureStrings.find(v => isNumber(v)) !== undefined;
  const rotateItems = uniq([
    ...(hasNumbers ? NUMBER_ITEMS : []),
    ...measureStrings,
  ]);

  const handleMeasure = useCallback(
    (e: LayoutChangeEvent, v: string) => {
      if (!measureMap.current) return;

      measureMap.current[v] = {
        width: e.nativeEvent.layout.width,
        height: e.nativeEvent.layout.height,
      };

      if (Object.keys(measureMap.current).length === rotateItems.length) {
        setMeasured(true);
      }
    },
    [rotateItems.length],
  );

  return (
    <View style={[styles.row, containerStyle]}>
      {measured === true &&
        Children.map(children, child => {
          if (typeof child === 'string' || typeof child === 'number') {
            return splitText(`${child}`).map((text, index) => {
              let items = isNumber(text) ? NUMBER_ITEMS : [text];
              return (
                <TickItem
                  key={index}
                  duration={duration}
                  textStyle={textStyle}
                  textProps={textProps}
                  rotateItems={items}
                  measureMap={measureMap.current}>
                  {text}
                </TickItem>
              );
            });
          } else {
            // @ts-expect-error
            return React.cloneElement(child, {
              duration,
              textStyle,
              textProps,
              measureMap: measureMap.current,
            });
          }
        })}
      {rotateItems.map(v => {
        return (
          <Text
            key={v}
            {...textProps}
            style={[textStyle, styles.hide]}
            onLayout={e => handleMeasure(e, v)}>
            {v}
          </Text>
        );
      })}
    </View>
  );
};

export default TickerTexts;
