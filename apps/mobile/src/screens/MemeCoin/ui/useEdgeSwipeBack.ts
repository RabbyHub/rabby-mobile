import { useEffect, useMemo } from 'react';
import { useNavigation } from '@react-navigation/native';
import { Gesture } from 'react-native-gesture-handler';
import { IS_IOS } from '@/core/native/utils';

const EDGE_WIDTH = 24;
const BACK_DISTANCE = 64;
const BACK_VELOCITY = 600;

export const isEdgeSwipeBack = ({
  translationX,
  velocityX,
}: {
  translationX: number;
  velocityX: number;
}) => translationX >= BACK_DISTANCE || velocityX >= BACK_VELOCITY;

/**
 * iOS swipe back belongs to the root stack, which slides the whole page away
 * before usePreventRemove can cancel it. While `active`, turn that swipe off
 * and recognise the same left-edge swipe here instead.
 */
export const useEdgeSwipeBack = (active: boolean, onBack: () => void) => {
  const navigation = useNavigation();
  const enabled = IS_IOS && active;

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const root = navigation.getParent();
    root?.setOptions({ gestureEnabled: false });
    return () => root?.setOptions({ gestureEnabled: true });
  }, [enabled, navigation]);

  return useMemo(
    () =>
      Gesture.Pan()
        .enabled(enabled)
        .hitSlop({ left: 0, width: EDGE_WIDTH })
        .activeOffsetX(12)
        .failOffsetY([-12, 12])
        .runOnJS(true)
        .onEnd(event => {
          if (isEdgeSwipeBack(event)) {
            onBack();
          }
        }),
    [enabled, onBack],
  );
};
