import { PERPS_PRO_HEADER_HEIGHT } from '../components/header/constants';
import {
  getPerpsProMarketTop,
  getPerpsProRestrictedMarketTop,
} from '../components/market/perpsProMarketSticky';

/**
 * Scene presentation is a pure function of the scroll offset. The header
 * collapses proportionally over its own height instead of running a timed
 * animation, so every sticky overlay shares the list's velocity for the whole
 * gesture (QA 1156: a 160ms tween decoupled the header/market/tabs band from
 * the finger and read as jitter).
 */
export const getPerpsProAndroidScenePresentationGeometry = ({
  infoTabsAnchorY,
  marketBarHeight,
  marketNaturalAnchorY,
  rawOffset,
  regionAlertExtent,
  restricted,
  sceneLeadInHeight,
}: {
  infoTabsAnchorY: number;
  marketBarHeight: number;
  marketNaturalAnchorY: number;
  rawOffset: number;
  regionAlertExtent: number;
  restricted: boolean;
  sceneLeadInHeight: number;
}) => {
  'worklet';
  const offset = Number.isFinite(rawOffset) ? Math.max(rawOffset, 0) : 0;
  const collapsedDistance = Math.min(offset, PERPS_PRO_HEADER_HEIGHT);
  const headerOpacity = 1 - collapsedDistance / PERPS_PRO_HEADER_HEIGHT;
  const headerTranslateY = collapsedDistance > 0 ? -collapsedDistance : 0;
  const headerMarketTranslateY = PERPS_PRO_HEADER_HEIGHT - collapsedDistance;
  const marketTop = restricted
    ? getPerpsProRestrictedMarketTop({
        headerMarketTop: headerMarketTranslateY,
        regionAlertExtent,
      })
    : getPerpsProMarketTop({
        headerMarketTop: headerMarketTranslateY,
        naturalAnchorY: marketNaturalAnchorY,
        scrollY: offset,
      });

  return {
    headerOpacity,
    headerTranslateY,
    infoTabsTranslateY: Math.max(
      infoTabsAnchorY - offset,
      marketTop + marketBarHeight,
    ),
    marketTranslateY: marketTop,
    regionAlertTranslateY: headerMarketTranslateY,
    tradeTranslateY: sceneLeadInHeight - offset,
  };
};
