// patch from node_modules/@gorhom/bottom-sheet/src/components/bottomSheetBackdrop/BottomSheetBackdrop.tsx

import React, { memo, useCallback, useMemo, useState } from 'react';
import { ViewProps } from 'react-native';
import Animated, {
  interpolate,
  Extrapolate,
  useAnimatedStyle,
  useAnimatedReaction,
  useAnimatedGestureHandler,
  runOnJS,
} from 'react-native-reanimated';
import {
  TapGestureHandler,
  TapGestureHandlerGestureEvent,
} from 'react-native-gesture-handler';
import { useBottomSheet } from '@gorhom/bottom-sheet';
import {
  DEFAULT_OPACITY,
  DEFAULT_APPEARS_ON_INDEX,
  DEFAULT_DISAPPEARS_ON_INDEX,
  DEFAULT_ENABLE_TOUCH_THROUGH,
  DEFAULT_PRESS_BEHAVIOR,
} from '@gorhom/bottom-sheet/src/components/bottomSheetBackdrop/constants';
import { styles } from '@gorhom/bottom-sheet/src/components/bottomSheetBackdrop/styles';
import type { BottomSheetDefaultBackdropProps } from '@gorhom/bottom-sheet/src/components/bottomSheetBackdrop/types';

/**
 * @description this component is patched from the original BottomSheetBackdrop.tsx on package @gorhom/bottom-sheet,
 * the essence of this patch is to trigger onPress event when the backdrop is pressed event if the pressBehavior is set to 'none'
 */
const BottomSheetBackdropComponent = ({
  animatedIndex,
  opacity: _providedOpacity,
  appearsOnIndex: _providedAppearsOnIndex,
  disappearsOnIndex: _providedDisappearsOnIndex,
  enableTouchThrough: _providedEnableTouchThrough,
  pressBehavior = DEFAULT_PRESS_BEHAVIOR,
  onPress,
  style,
  children,
}: BottomSheetDefaultBackdropProps) => {
  //#region hooks
  const { snapToIndex, close } = useBottomSheet();
  //#endregion

  //#region defaults
  const opacity = _providedOpacity ?? DEFAULT_OPACITY;
  const appearsOnIndex = _providedAppearsOnIndex ?? DEFAULT_APPEARS_ON_INDEX;
  const disappearsOnIndex =
    _providedDisappearsOnIndex ?? DEFAULT_DISAPPEARS_ON_INDEX;
  const enableTouchThrough =
    _providedEnableTouchThrough ?? DEFAULT_ENABLE_TOUCH_THROUGH;
  //#endregion

  //#region variables
  const [pointerEvents, setPointerEvents] = useState<
    ViewProps['pointerEvents']
  >(enableTouchThrough ? 'none' : 'auto');
  //#endregion

  //#region callbacks
  const handleOnPress = useCallback(() => {
    onPress?.();

    if (pressBehavior === 'close') {
      close();
    } else if (pressBehavior === 'collapse') {
      snapToIndex(disappearsOnIndex as number);
    } else if (typeof pressBehavior === 'number') {
      snapToIndex(pressBehavior);
    }
  }, [snapToIndex, close, disappearsOnIndex, pressBehavior, onPress]);
  const handleContainerTouchability = useCallback(
    (shouldDisableTouchability: boolean) => {
      setPointerEvents(shouldDisableTouchability ? 'none' : 'auto');
    },
    [],
  );
  //#endregion

  //#region tap gesture
  const gestureHandler =
    useAnimatedGestureHandler<TapGestureHandlerGestureEvent>(
      {
        onFinish: () => {
          runOnJS(handleOnPress)();
        },
      },
      [handleOnPress],
    );
  //#endregion

  //#region styles
  const containerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      animatedIndex.value,
      [-1, disappearsOnIndex, appearsOnIndex],
      [0, 0, opacity],
      Extrapolate.CLAMP,
    ),
    flex: 1,
  }));
  const containerStyle = useMemo(
    () => [styles.container, style, containerAnimatedStyle],
    [style, containerAnimatedStyle],
  );
  //#endregion

  //#region effects
  useAnimatedReaction(
    () => animatedIndex.value <= disappearsOnIndex,
    (shouldDisableTouchability, previous) => {
      if (shouldDisableTouchability === previous) {
        return;
      }
      runOnJS(handleContainerTouchability)(shouldDisableTouchability);
    },
    [disappearsOnIndex],
  );
  //#endregion

  return (
    <TapGestureHandler onGestureEvent={gestureHandler}>
      {pressBehavior !== 'none' ? (
        <Animated.View
          style={containerStyle}
          pointerEvents={pointerEvents}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Bottom Sheet backdrop"
          accessibilityHint={`Tap to ${
            typeof pressBehavior === 'string' ? pressBehavior : 'move'
          } the Bottom Sheet`}>
          {children}
        </Animated.View>
      ) : (
        <Animated.View pointerEvents={pointerEvents} style={containerStyle}>
          {children}
        </Animated.View>
      )}
    </TapGestureHandler>
  );
};

const AppBottomSheetBackdrop = memo(BottomSheetBackdropComponent);
AppBottomSheetBackdrop.displayName = 'BottomSheetBackdrop';

export default AppBottomSheetBackdrop;
