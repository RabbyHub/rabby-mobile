import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { RootSiblingPortal } from 'react-native-root-siblings';
import { Text } from '@/components/Typography';

const BUBBLE_OFFSET_TOP = 66;
const BUBBLE_PORTAL_Z_INDEX = 9999;

export const BubbleWithText = ({ slide }: { slide: number }) => {
  const { styles } = useTheme2024({ getStyle: getBubbleStyles });

  return (
    <View style={styles.container}>
      <View style={styles.bubble}>
        <Text style={styles.text} numberOfLines={1}>
          {slide}%
        </Text>
      </View>
      <View style={styles.arrowWrapper}>
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
  const { width } = useWindowDimensions();
  const [anchorPosition, setAnchorPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const measureAnchor = useCallback(() => {
    anchorRef.current?.measureInWindow((x, y, anchorWidth) => {
      setAnchorPosition({
        x: x + anchorWidth / 2,
        y,
      });
    });
  }, [anchorRef]);

  useEffect(() => {
    if (!visible) {
      setAnchorPosition(null);
      return;
    }

    const frame = requestAnimationFrame(measureAnchor);

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [measureAnchor, slide, visible]);

  if (!visible || !anchorPosition) {
    return null;
  }

  return (
    <RootSiblingPortal>
      <View pointerEvents="none" style={portalStyles.root}>
        <View
          style={[
            portalStyles.bubbleRow,
            {
              top: Math.max(0, anchorPosition.y - BUBBLE_OFFSET_TOP),
              transform: [
                {
                  translateX: anchorPosition.x - width / 2,
                },
              ],
            },
          ]}>
          <BubbleWithText slide={slide} />
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
  bubbleRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
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
