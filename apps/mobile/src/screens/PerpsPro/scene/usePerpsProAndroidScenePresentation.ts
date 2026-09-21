import {
  Easing,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import {
  getNextPerpsProHeaderScrollState,
  PERPS_PRO_HEADER_ANIMATION_MS,
} from '../components/header/usePerpsProHeaderCollapse';
import { getPerpsProAndroidScenePresentationGeometry } from './perpsProAndroidScenePresentation';

export const usePerpsProAndroidScenePresentation = ({
  enabled,
  infoTabsAnchorY,
  marketBarHeight,
  marketNaturalAnchorY,
  regionAlertExtent,
  restricted,
  sceneLeadInHeight,
  scrollOffset,
}: {
  enabled: boolean;
  infoTabsAnchorY: number;
  marketBarHeight: number;
  marketNaturalAnchorY: number;
  regionAlertExtent: number;
  restricted: boolean;
  sceneLeadInHeight: number;
  scrollOffset: SharedValue<number>;
}) => {
  const accumulatedDelta = useSharedValue(0);
  const headerVisible = useSharedValue(true);
  const lastOffset = useSharedValue(0);
  const visibilityProgress = useSharedValue(1);

  useAnimatedReaction(
    () => ({ enabled, offset: scrollOffset.value }),
    state => {
      if (!state.enabled) {
        accumulatedDelta.value = 0;
        headerVisible.value = true;
        lastOffset.value = 0;
        visibilityProgress.value = 1;
        return;
      }

      const current = {
        accumulatedDelta: accumulatedDelta.value,
        lastOffset: lastOffset.value,
        visible: headerVisible.value,
      };
      const next = getNextPerpsProHeaderScrollState(current, state.offset);
      accumulatedDelta.value = next.accumulatedDelta;
      lastOffset.value = next.lastOffset;
      if (next.visible !== current.visible) {
        headerVisible.value = next.visible;
        visibilityProgress.value = withTiming(next.visible ? 1 : 0, {
          duration: PERPS_PRO_HEADER_ANIMATION_MS,
          easing: Easing.out(Easing.cubic),
        });
      }
    },
    [enabled],
  );

  const geometry = useDerivedValue(
    () =>
      getPerpsProAndroidScenePresentationGeometry({
        infoTabsAnchorY,
        marketBarHeight,
        marketNaturalAnchorY,
        rawOffset: scrollOffset.value,
        regionAlertExtent,
        restricted,
        sceneLeadInHeight,
        visibilityProgress: visibilityProgress.value,
      }),
    [
      infoTabsAnchorY,
      marketBarHeight,
      marketNaturalAnchorY,
      regionAlertExtent,
      restricted,
      sceneLeadInHeight,
    ],
  );

  const headerAnimatedStyle = useAnimatedStyle(() => {
    const current = geometry.value;
    return {
      opacity: current.headerOpacity,
      transform: [{ translateY: current.headerTranslateY }],
    };
  });
  const infoTabsAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: geometry.value.infoTabsTranslateY }],
  }));
  const marketAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: geometry.value.marketTranslateY }],
  }));
  const regionAlertAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: geometry.value.regionAlertTranslateY }],
  }));
  const tradeAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: geometry.value.tradeTranslateY }],
  }));

  return {
    headerAnimatedStyle,
    infoTabsAnimatedStyle,
    marketAnimatedStyle,
    regionAlertAnimatedStyle,
    tradeAnimatedStyle,
  };
};
