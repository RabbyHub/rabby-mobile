import { IS_IOS } from '@/core/native/utils';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import { useHandleBackPressClosable } from '@/hooks/useAppGesture';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type PropsWithChildren,
} from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { FullWindowOverlay } from 'react-native-screens';

const PERPS_PRO_MARKET_SELECTOR_EDGE_WIDTH = 24;
const PERPS_PRO_MARKET_SELECTOR_DISMISS_DISTANCE = 64;
const PERPS_PRO_MARKET_SELECTOR_DISMISS_VELOCITY = 600;

export const shouldDismissPerpsProMarketSelectorFromEdge = ({
  translationX,
  velocityX,
}: {
  translationX: number;
  velocityX: number;
}) =>
  translationX >= PERPS_PRO_MARKET_SELECTOR_DISMISS_DISTANCE ||
  velocityX >= PERPS_PRO_MARKET_SELECTOR_DISMISS_VELOCITY;

const PerpsProMarketSelectorDismissContext = createContext<(() => void) | null>(
  null,
);

export const PerpsProMarketSelectorDismissProvider: React.FC<
  PropsWithChildren<{ onDismiss: () => void }>
> = ({ children, onDismiss }) => (
  <PerpsProMarketSelectorDismissContext.Provider value={onDismiss}>
    {children}
  </PerpsProMarketSelectorDismissContext.Provider>
);

export const PerpsProMarketSelectorGestureContainer: React.FC<
  PropsWithChildren
> = ({ children }) => {
  const dismiss = useContext(PerpsProMarketSelectorDismissContext);
  const edgeGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX(12)
        .failOffsetY([-12, 12])
        .runOnJS(true)
        .onEnd(event => {
          if (dismiss && shouldDismissPerpsProMarketSelectorFromEdge(event)) {
            dismiss();
          }
        }),
    [dismiss],
  );

  if (!IS_IOS) {
    return <>{children}</>;
  }

  return (
    <FullWindowOverlay>
      {children}
      {dismiss ? (
        <GestureDetector gesture={edgeGesture}>
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={styles.edgeGestureTarget}
            testID="perps-pro-market-selector-edge-gesture"
          />
        </GestureDetector>
      ) : null}
    </FullWindowOverlay>
  );
};

export const usePerpsProMarketSelectorDismiss = ({
  dismiss,
  windowHeight,
}: {
  dismiss: () => void;
  windowHeight: number;
}) => {
  const navigation = useRabbyAppNavigation();
  const isOpenRef = useRef(false);
  const frozenWindowHeightRef = useRef(windowHeight);

  const setScreenGestureEnabled = useCallback(
    (gestureEnabled: boolean) => {
      if (!IS_IOS) {
        return;
      }
      navigation.setOptions({ gestureEnabled });
    },
    [navigation],
  );

  const markPresent = useCallback(() => {
    if (isOpenRef.current) {
      return;
    }
    frozenWindowHeightRef.current = windowHeight;
    isOpenRef.current = true;
    setScreenGestureEnabled(false);
  }, [setScreenGestureEnabled, windowHeight]);

  const markDismissed = useCallback(() => {
    if (!isOpenRef.current) {
      return;
    }
    isOpenRef.current = false;
    setScreenGestureEnabled(true);
  }, [setScreenGestureEnabled]);

  const requestBack = useCallback(() => {
    if (!isOpenRef.current) {
      return true;
    }
    dismiss();
    return false;
  }, [dismiss]);

  useHandleBackPressClosable(requestBack, { autoEffectEnabled: true });

  useEffect(
    () => () => {
      if (isOpenRef.current) {
        isOpenRef.current = false;
        setScreenGestureEnabled(true);
      }
    },
    [setScreenGestureEnabled],
  );

  return {
    markDismissed,
    markPresent,
    stableWindowHeight: isOpenRef.current
      ? frozenWindowHeightRef.current
      : windowHeight,
  };
};

const styles = StyleSheet.create({
  edgeGestureTarget: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    top: 0,
    width: PERPS_PRO_MARKET_SELECTOR_EDGE_WIDTH,
  },
});
