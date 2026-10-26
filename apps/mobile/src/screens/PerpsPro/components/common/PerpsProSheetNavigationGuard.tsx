import { IS_IOS } from '@/core/native/utils';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import { useHandleBackPressClosable } from '@/hooks/useAppGesture';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type PropsWithChildren,
} from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { FullWindowOverlay } from 'react-native-screens';

import {
  beginPerpsProSheetBackTap,
  getPerpsProSheetNavigationVersion,
  getTopPerpsProSheetNavigationRegistration,
  requestDismissPerpsProSheet,
  resetPerpsProSheetNavigationGuardForTests,
  subscribePerpsProSheetNavigation,
  usePerpsProSheetNavigationRegistration,
} from './perpsProSheetNavigationRegistry';

const EDGE_WIDTH = 24;
const DISMISS_DISTANCE = 64;
const DISMISS_VELOCITY = 600;

export { resetPerpsProSheetNavigationGuardForTests };
export { usePerpsProSheetNavigationRegistration };

export const shouldDismissPerpsProSheetFromEdge = ({
  translationX,
  velocityX,
}: {
  translationX: number;
  velocityX: number;
}) => translationX >= DISMISS_DISTANCE || velocityX >= DISMISS_VELOCITY;

const useRegistryVersion = () =>
  useSyncExternalStore(
    subscribePerpsProSheetNavigation,
    getPerpsProSheetNavigationVersion,
    getPerpsProSheetNavigationVersion,
  );

export const PerpsProSheetGlobalEdgeTarget = () => {
  useRegistryVersion();
  const registration = getTopPerpsProSheetNavigationRegistration();
  const backTap = useRef<ReturnType<typeof beginPerpsProSheetBackTap>>(null);
  useEffect(() => () => backTap.current?.cancel(), [registration]);
  const edgeGesture = useMemo(() => {
    const pan = Gesture.Pan()
      .activeOffsetX(12)
      .failOffsetY([-12, 12])
      .runOnJS(true)
      .onEnd(event => {
        if (registration && shouldDismissPerpsProSheetFromEdge(event)) {
          requestDismissPerpsProSheet(registration, 'edge');
        }
      });
    const tap = Gesture.Tap()
      .maxDistance(12)
      .runOnJS(true)
      .onBegin(event => {
        backTap.current?.cancel();
        backTap.current = beginPerpsProSheetBackTap(registration, event);
      })
      .onEnd((event, success) => {
        if (success) {
          backTap.current?.finish(event);
        } else {
          backTap.current?.cancel();
        }
      })
      .onFinalize((_event, success) => {
        if (!success) {
          backTap.current?.cancel();
        }
      });
    return Gesture.Exclusive(pan, tap);
  }, [registration]);

  if (!IS_IOS || !registration?.edgeDismissibleRef.current) return null;
  return (
    <FullWindowOverlay>
      <GestureDetector gesture={edgeGesture}>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.edgeGestureTarget}
          testID="perps-pro-sheet-edge-gesture"
        />
      </GestureDetector>
    </FullWindowOverlay>
  );
};

export const PerpsProSheetNavigationBoundary: React.FC<
  PropsWithChildren<{
    active: boolean;
    dismiss: () => void;
    dismissible?: boolean;
    edgeDismissible?: boolean;
  }>
> = ({ active, children, dismiss, dismissible, edgeDismissible }) => {
  usePerpsProSheetNavigationRegistration({
    active,
    dismiss,
    dismissible,
    edgeDismissible,
  });
  return <>{children}</>;
};

export const usePerpsProSheetNavigationHost = () => {
  const navigation = useRabbyAppNavigation();
  useRegistryVersion();
  const active = getTopPerpsProSheetNavigationRegistration() != null;

  useEffect(() => {
    if (!IS_IOS) return;
    navigation.setOptions({ gestureEnabled: !active });
    return () => {
      if (active) navigation.setOptions({ gestureEnabled: true });
    };
  }, [active, navigation]);

  const requestBack = useCallback(() => {
    const top = getTopPerpsProSheetNavigationRegistration();
    if (!top) return true;
    requestDismissPerpsProSheet(top);
    return false;
  }, []);
  useHandleBackPressClosable(requestBack, { autoEffectEnabled: true });
};

/**
 * Keep registry publications out of the realtime Perps Pro scene. This host
 * intentionally renders as a route-level sibling so opening or closing a
 * sheet only updates the lightweight navigation control plane.
 */
export const PerpsProSheetNavigationHost = () => {
  usePerpsProSheetNavigationHost();
  return null;
};

const styles = StyleSheet.create({
  edgeGestureTarget: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    top: 0,
    width: EDGE_WIDTH,
  },
});
