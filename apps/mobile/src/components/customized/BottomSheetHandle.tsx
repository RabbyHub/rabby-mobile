import { useMemo } from 'react';

import {
  BottomSheetHandle,
  useBottomSheet,
  useBottomSheetGestureHandlers,
} from '@gorhom/bottom-sheet';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { useThemeColors } from '@/hooks/theme';
import { getBottomSheetHandleStyles } from './BottomSheet';

export const AppBottomSheetHandle = (
  props: React.ComponentProps<typeof BottomSheetHandle>,
) => {
  const colors = useThemeColors();
  const styles = useMemo(() => getBottomSheetHandleStyles(colors), [colors]);

  return (
    <BottomSheetHandle
      {...props}
      style={[
        props.style,
        styles.handleStyles,
        {
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'center',
          // leave here for debug
          // borderWidth: 1,
          // borderColor: colors['neutral-line'],
        },
      ]}
      indicatorStyle={[
        props.indicatorStyle,
        styles.handleIndicatorStyle,
        {
          top: -6,
        },
      ]}
    />
  );
};

/**
 * @description View can be draggable, used under context of one BottomSheet
 */
export function BottomSheetHandlableView({
  children,
}: React.PropsWithChildren<React.ComponentProps<typeof Animated.View>>) {
  const { animatedIndex, animatedPosition } = useBottomSheet();
  const { handlePanGestureHandler } = useBottomSheetGestureHandlers();

  const panGesture = useMemo(() => {
    let gesture = Gesture.Pan()
      .enabled(true)
      .shouldCancelWhenOutside(false)
      .runOnJS(false)
      .onStart(handlePanGestureHandler.handleOnStart)
      .onChange(handlePanGestureHandler.handleOnChange)
      .onEnd(handlePanGestureHandler.handleOnEnd)
      .onFinalize(handlePanGestureHandler.handleOnFinalize);

    return gesture;
  }, [
    handlePanGestureHandler.handleOnChange,
    handlePanGestureHandler.handleOnEnd,
    handlePanGestureHandler.handleOnFinalize,
    handlePanGestureHandler.handleOnStart,
  ]);

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View
        accessible={true}
        accessibilityRole="adjustable"
        accessibilityLabel="Bottom Sheet handle"
        accessibilityHint="Drag up or down to extend or minimize the Bottom Sheet">
        {children}
      </Animated.View>
    </GestureDetector>
  );
}
