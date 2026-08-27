import { getPerpsProHeaderGeometry } from '../components/header/usePerpsProHeaderCollapse';
import {
  getPerpsProMarketTop,
  getPerpsProRestrictedMarketTop,
} from '../components/market/perpsProMarketSticky';

export const getPerpsProAndroidScenePresentationGeometry = ({
  infoTabsAnchorY,
  marketBarHeight,
  marketNaturalAnchorY,
  rawOffset,
  regionAlertExtent,
  restricted,
  sceneLeadInHeight,
  visibilityProgress,
}: {
  infoTabsAnchorY: number;
  marketBarHeight: number;
  marketNaturalAnchorY: number;
  rawOffset: number;
  regionAlertExtent: number;
  restricted: boolean;
  sceneLeadInHeight: number;
  visibilityProgress: number;
}) => {
  'worklet';
  const offset = Number.isFinite(rawOffset) ? Math.max(rawOffset, 0) : 0;
  const header = getPerpsProHeaderGeometry(offset, visibilityProgress);
  const marketTop = restricted
    ? getPerpsProRestrictedMarketTop({
        headerMarketTop: header.marketTranslateY,
        regionAlertExtent,
      })
    : getPerpsProMarketTop({
        headerMarketTop: header.marketTranslateY,
        naturalAnchorY: marketNaturalAnchorY,
        scrollY: offset,
      });

  return {
    headerOpacity: header.headerOpacity,
    headerTranslateY: header.headerTranslateY,
    infoTabsTranslateY: Math.max(
      infoTabsAnchorY - offset,
      marketTop + marketBarHeight,
    ),
    marketTranslateY: marketTop,
    regionAlertTranslateY: header.marketTranslateY,
    tradeTranslateY: sceneLeadInHeight - offset,
  };
};
