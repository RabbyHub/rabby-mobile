import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { RootSiblingPortal } from 'react-native-root-siblings';
import { Text } from '@/components/Typography';

const BUBBLE_PORTAL_Z_INDEX = 9999;
const BUBBLE_HORIZONTAL_MARGIN = 8;
const ARROW_HORIZONTAL_MARGIN = 16;
const BUBBLE_VERTICAL_OFFSET = 5;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

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

export const SliderBubblePortal = ({
  anchorRef,
  slide,
  visible,
}: {
  anchorRef: React.RefObject<View | null>;
  slide: number;
  visible: boolean;
}) => {
  const rootRef = useRef<View>(null);
  const [anchorPosition, setAnchorPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [portalFrame, setPortalFrame] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [bubbleSize, setBubbleSize] = useState<{
    width: number;
    height: number;
  } | null>(null);

  const measureAnchor = useCallback(() => {
    anchorRef.current?.measureInWindow((x, y, anchorWidth, anchorHeight) => {
      setAnchorPosition({
        x: x + anchorWidth / 2,
        y: y + anchorHeight / 2,
      });
    });
  }, [anchorRef]);

  const measurePortal = useCallback(() => {
    rootRef.current?.measureInWindow((x, y, width, height) => {
      setPortalFrame({ x, y, width, height });
    });
  }, []);

  const bubblePosition = useMemo(() => {
    if (!anchorPosition || !portalFrame || !bubbleSize) {
      return null;
    }

    const anchorX = anchorPosition.x - portalFrame.x;
    const anchorY = anchorPosition.y - portalFrame.y;
    const maxLeft = Math.max(
      BUBBLE_HORIZONTAL_MARGIN,
      portalFrame.width - bubbleSize.width - BUBBLE_HORIZONTAL_MARGIN,
    );
    const left = clamp(
      anchorX - bubbleSize.width / 2,
      BUBBLE_HORIZONTAL_MARGIN,
      maxLeft,
    );
    const maxArrowOffset = Math.max(
      0,
      bubbleSize.width / 2 - ARROW_HORIZONTAL_MARGIN,
    );

    return {
      left,
      top: Math.max(0, anchorY - bubbleSize.height - BUBBLE_VERTICAL_OFFSET),
      arrowOffsetX: clamp(
        anchorX - (left + bubbleSize.width / 2),
        -maxArrowOffset,
        maxArrowOffset,
      ),
    };
  }, [anchorPosition, bubbleSize, portalFrame]);

  useEffect(() => {
    if (!visible) {
      setAnchorPosition(null);
      setPortalFrame(null);
      return;
    }

    const frame = requestAnimationFrame(() => {
      measurePortal();
      measureAnchor();
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [measureAnchor, measurePortal, slide, visible]);

  const handleRootLayout = useCallback(() => {
    measurePortal();
  }, [measurePortal]);

  const handleBubbleLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setBubbleSize({ width, height });
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <RootSiblingPortal>
      <View
        ref={rootRef}
        pointerEvents="none"
        style={portalStyles.root}
        onLayout={handleRootLayout}>
        <View
          onLayout={handleBubbleLayout}
          style={[
            portalStyles.bubble,
            bubblePosition
              ? {
                  left: bubblePosition.left,
                  top: bubblePosition.top,
                }
              : portalStyles.hiddenBubble,
          ]}>
          <BubbleWithText
            slide={slide}
            arrowOffsetX={bubblePosition?.arrowOffsetX}
          />
        </View>
      </View>
    </RootSiblingPortal>
  );
};

const portalStyles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: BUBBLE_PORTAL_Z_INDEX,
    elevation: BUBBLE_PORTAL_Z_INDEX,
  },
  bubble: {
    position: 'absolute',
  },
  hiddenBubble: {
    left: 0,
    top: 0,
    opacity: 0,
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
