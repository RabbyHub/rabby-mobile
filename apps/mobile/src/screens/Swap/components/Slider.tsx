import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { AnimateableText, Text } from '@/components/Typography';
import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { RootSiblingPortal } from 'react-native-root-siblings';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

const BUBBLE_PORTAL_Z_INDEX = 9999;
const BUBBLE_HORIZONTAL_MARGIN = 8;
const ARROW_HORIZONTAL_MARGIN = 16;
const BUBBLE_VERTICAL_OFFSET = 5;
const THUMB_SIZE = 14;

const clamp = (value: number, min: number, max: number) => {
  'worklet';
  return Math.min(Math.max(value, min), max);
};

export const BubbleWithText = ({
  slide,
  arrowOffsetX = 0,
}: {
  slide: number;
  arrowOffsetX?: number;
}) => {
  const { styles } = useTheme2024({ getStyle: getBubbleStyles });

  return (
    <View style={styles.container}>
      <View style={styles.bubble}>
        <Text style={styles.text} numberOfLines={1}>
          {slide}%
        </Text>
      </View>
      <View
        style={[
          styles.arrowWrapper,
          { transform: [{ translateX: arrowOffsetX }] },
        ]}>
        <View style={styles.arrowBorder}>
          <View style={styles.arrowInner} />
        </View>
      </View>
    </View>
  );
};

type BubbleGeometry = {
  progress: number;
  trackX: number;
  trackY: number;
  trackW: number;
  portalX: number;
  portalY: number;
  portalW: number;
  bubbleW: number;
  bubbleH: number;
};

const getBubbleGeometry = ({
  progress,
  trackX,
  trackY,
  trackW,
  portalX,
  portalY,
  portalW,
  bubbleW,
  bubbleH,
}: BubbleGeometry) => {
  'worklet';

  const ratio = clamp(progress, 0, 100) / 100;
  const travel = Math.max(0, trackW - THUMB_SIZE);
  const anchorX = trackX + ratio * travel + THUMB_SIZE / 2 - portalX;
  const anchorY = trackY + THUMB_SIZE / 2 - portalY;
  const ready = bubbleW > 0 && bubbleH > 0 && trackW > 0 && portalW > 0;
  const maxLeft = Math.max(
    BUBBLE_HORIZONTAL_MARGIN,
    portalW - bubbleW - BUBBLE_HORIZONTAL_MARGIN,
  );
  const left = clamp(anchorX - bubbleW / 2, BUBBLE_HORIZONTAL_MARGIN, maxLeft);
  const maxArrowOffset = Math.max(0, bubbleW / 2 - ARROW_HORIZONTAL_MARGIN);

  return {
    ready,
    left,
    top: Math.max(0, anchorY - bubbleH - BUBBLE_VERTICAL_OFFSET),
    arrowOffsetX: clamp(
      anchorX - (left + bubbleW / 2),
      -maxArrowOffset,
      maxArrowOffset,
    ),
  };
};

export type SliderBubbleHandle = {
  setProgress: (value: number) => void;
};

export const SliderBubblePortal = React.forwardRef<
  SliderBubbleHandle,
  {
    trackRef: React.RefObject<View | null>;
    slide: number;
    visible: boolean;
  }
>(({ trackRef, slide, visible }, ref) => {
  const { styles } = useTheme2024({ getStyle: getBubbleStyles });
  const rootRef = useRef<View>(null);
  const progress = useSharedValue(slide);
  const trackX = useSharedValue(0);
  const trackY = useSharedValue(0);
  const trackW = useSharedValue(0);
  const portalX = useSharedValue(0);
  const portalY = useSharedValue(0);
  const portalW = useSharedValue(0);
  const bubbleW = useSharedValue(0);
  const bubbleH = useSharedValue(0);

  React.useImperativeHandle(
    ref,
    () => ({
      setProgress: (value: number) => {
        progress.value = value;
      },
    }),
    [progress],
  );

  useEffect(() => {
    if (visible) {
      return;
    }
    progress.value = slide;
  }, [progress, slide, visible]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    trackRef.current?.measureInWindow((x, y, width) => {
      if (width <= 0) {
        return;
      }
      trackX.value = x;
      trackY.value = y;
      trackW.value = width;
    });
  }, [trackRef, trackW, trackX, trackY, visible]);

  const textProps = useAnimatedProps(() => {
    return { text: `${Math.round(progress.value)}%` };
  });

  const bubbleStyle = useAnimatedStyle(() => {
    const geometry = getBubbleGeometry({
      progress: progress.value,
      trackX: trackX.value,
      trackY: trackY.value,
      trackW: trackW.value,
      portalX: portalX.value,
      portalY: portalY.value,
      portalW: portalW.value,
      bubbleW: bubbleW.value,
      bubbleH: bubbleH.value,
    });

    return {
      opacity: geometry.ready ? 1 : 0,
      transform: [{ translateX: geometry.left }, { translateY: geometry.top }],
    };
  });

  const arrowStyle = useAnimatedStyle(() => {
    const geometry = getBubbleGeometry({
      progress: progress.value,
      trackX: trackX.value,
      trackY: trackY.value,
      trackW: trackW.value,
      portalX: portalX.value,
      portalY: portalY.value,
      portalW: portalW.value,
      bubbleW: bubbleW.value,
      bubbleH: bubbleH.value,
    });

    return {
      transform: [{ translateX: geometry.arrowOffsetX }],
    };
  });

  if (!visible) {
    return null;
  }

  return (
    <RootSiblingPortal>
      <View
        ref={rootRef}
        pointerEvents="none"
        style={portalStyles.root}
        onLayout={() => {
          rootRef.current?.measureInWindow((x, y, width) => {
            portalX.value = x;
            portalY.value = y;
            portalW.value = width;
          });
        }}>
        <Animated.View
          onLayout={event => {
            bubbleW.value = event.nativeEvent.layout.width;
            bubbleH.value = event.nativeEvent.layout.height;
          }}
          style={[portalStyles.bubble, bubbleStyle]}>
          <View style={styles.container}>
            <View style={styles.bubble}>
              <AnimateableText
                style={styles.text}
                numberOfLines={1}
                animatedProps={textProps}
              />
            </View>
            <Animated.View style={[styles.arrowWrapper, arrowStyle]}>
              <View style={styles.arrowBorder}>
                <View style={styles.arrowInner} />
              </View>
            </Animated.View>
          </View>
        </Animated.View>
      </View>
    </RootSiblingPortal>
  );
});

SliderBubblePortal.displayName = 'SliderBubblePortal';

const portalStyles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: BUBBLE_PORTAL_Z_INDEX,
    elevation: BUBBLE_PORTAL_Z_INDEX,
  },
  bubble: {
    position: 'absolute',
  },
});

const getBubbleStyles = createGetStyles2024(({ colors2024 }) => ({
  container: {
    flexGrow: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bubble: {
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 15,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderColor: colors2024['neutral-line'],
    borderWidth: 1,
  },
  arrowWrapper: {
    position: 'relative',
    top: -1,
    alignItems: 'center',
  },
  arrowBorder: {
    position: 'relative',
    width: 0,
    height: 0,
    borderLeftWidth: 12,
    borderRightWidth: 12,
    borderTopWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: colors2024['neutral-line'],
  },
  arrowInner: {
    position: 'absolute',
    top: -13.5,
    left: -12,
    width: 0,
    height: 0,
    borderLeftWidth: 12,
    borderRightWidth: 12,
    borderTopWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: colors2024['neutral-bg-2'],
  },

  tokenText: {
    color: colors2024['neutral-title-1'],
  },
  text: {
    fontSize: 20,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
    color: colors2024['brand-default'],
  },
}));
