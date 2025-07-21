import React, { useMemo } from 'react';
import { View } from 'react-native';

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
        styles.handleStyles,
        {
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'center',
          // leave here for debug
          // borderWidth: 1,
          // borderColor: colors['neutral-line'],
        },
        props.style,
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
  ...props
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
        accessibilityHint="Drag up or down to extend or minimize the Bottom Sheet"
        {...props}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

export function Handlable<T extends React.FC<any>>({
  __IN_SHEET_MODAL__ = false,
  style,
  children,
  Component = View as any,
}: React.PropsWithChildren<
  RNViewProps & {
    __IN_SHEET_MODAL__?: boolean;
    Component?: T;
  }
>) {
  const HandlableView = __IN_SHEET_MODAL__
    ? BottomSheetHandlableView
    : Component;

  return <HandlableView style={style}>{children}</HandlableView>;
}

Handlable.Fragment = function ({
  __IN_SHEET_MODAL__ = false,
  children,
}: React.PropsWithChildren<{
  __IN_SHEET_MODAL__?: boolean;
}>) {
  const HandlableFragment = __IN_SHEET_MODAL__
    ? BottomSheetHandlableView
    : React.Fragment;

  return <HandlableFragment>{children}</HandlableFragment>;
};
