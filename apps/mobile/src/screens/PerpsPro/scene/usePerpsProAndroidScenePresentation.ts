import {
  useAnimatedStyle,
  useDerivedValue,
  type SharedValue,
} from 'react-native-reanimated';

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
  const geometry = useDerivedValue(
    () =>
      getPerpsProAndroidScenePresentationGeometry({
        infoTabsAnchorY,
        marketBarHeight,
        marketNaturalAnchorY,
        rawOffset: enabled ? scrollOffset.value : 0,
        regionAlertExtent,
        restricted,
        sceneLeadInHeight,
      }),
    [
      enabled,
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
