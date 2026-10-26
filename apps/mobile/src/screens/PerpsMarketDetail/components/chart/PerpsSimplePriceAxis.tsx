import React, { useEffect, useMemo } from 'react';
import { ScrollView, View, type ScrollViewProps } from 'react-native';
import {
  Gesture,
  GestureDetector,
  type NativeGesture,
} from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';
import {
  createSimplePriceAxisDrag,
  type SimplePriceAxisCommand,
} from './simplePriceAxisDrag';

export function PerpsSimpleChartScrollView({
  scrollGesture,
  ...props
}: ScrollViewProps & { scrollGesture?: NativeGesture }) {
  const scroll = <ScrollView {...props} />;
  return scrollGesture ? (
    <GestureDetector gesture={scrollGesture}>{scroll}</GestureDetector>
  ) : (
    scroll
  );
}

/** iOS owns only the native price-axis strip; the Web chart still owns its plot. */
export function PerpsSimplePriceAxis({
  scrollGesture,
  owner,
  paneWidth,
  paneHeight,
  onCommand,
}: {
  scrollGesture: NativeGesture;
  owner: string;
  paneWidth: number;
  paneHeight: number;
  onCommand: (owner: string, command: SimplePriceAxisCommand) => void;
}) {
  const drag = useMemo(
    () => createSimplePriceAxisDrag(command => onCommand(owner, command)),
    [owner, onCommand],
  );
  useEffect(() => () => drag.cancel(), [drag]);
  const touchId = useSharedValue(-1);
  const gesture = useMemo(
    () =>
      Gesture.Manual()
        .shouldCancelWhenOutside(false)
        .blocksExternalGesture(scrollGesture)
        .onTouchesDown((event, manager) => {
          // End the entire interaction on a second finger; do not switch fingers.
          if (touchId.value !== -1 || event.numberOfTouches !== 1) {
            const wasActive = touchId.value !== -1;
            touchId.value = -1;
            runOnJS(drag.cancel)();
            // End an active UIKit recognizer instead of returning it to failed.
            if (wasActive) manager.end();
            else manager.fail();
            return;
          }
          const touch = event.changedTouches[0];
          touchId.value = touch.id;
          manager.begin();
          manager.activate();
          runOnJS(drag.start)(touch.absoluteY);
        })
        .onTouchesMove((event, manager) => {
          if (touchId.value === -1) return;
          if (event.numberOfTouches !== 1) {
            touchId.value = -1;
            runOnJS(drag.cancel)();
            manager.end();
            return;
          }
          const touch = event.allTouches.find(
            item => item.id === touchId.value,
          );
          if (touch) runOnJS(drag.move)(touch.absoluteY);
        })
        .onTouchesUp((event, manager) => {
          const touch = event.changedTouches.find(
            item => item.id === touchId.value,
          );
          if (!touch) return;
          touchId.value = -1;
          runOnJS(drag.end)(touch.absoluteY);
          manager.end();
        })
        .onTouchesCancelled((_event, manager) => {
          // RNGH also cancels tracked pointers after manager.end().
          if (touchId.value === -1) return;
          touchId.value = -1;
          runOnJS(drag.cancel)();
          manager.end();
        })
        .onFinalize(() => {
          touchId.value = -1;
          runOnJS(drag.cancel)();
        }),
    [drag, scrollGesture, touchId],
  );
  return (
    <GestureDetector gesture={gesture}>
      <View
        collapsable={false}
        accessible={false}
        style={{
          position: 'absolute',
          top: 12,
          left: 12 + paneWidth,
          right: 0,
          height: paneHeight,
        }}
      />
    </GestureDetector>
  );
}
