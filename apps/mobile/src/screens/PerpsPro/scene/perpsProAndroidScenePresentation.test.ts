import { getPerpsProAndroidScenePresentationGeometry } from './perpsProAndroidScenePresentation';

describe('getPerpsProAndroidScenePresentationGeometry', () => {
  const base = {
    infoTabsAnchorY: 536,
    marketBarHeight: 40,
    marketNaturalAnchorY: 56,
    regionAlertExtent: 0,
    restricted: false,
    sceneLeadInHeight: 96,
  };

  it('keeps every overlay on the same offset at the top', () => {
    expect(
      getPerpsProAndroidScenePresentationGeometry({
        ...base,
        rawOffset: 0,
        visibilityProgress: 1,
      }),
    ).toEqual({
      headerOpacity: 1,
      headerTranslateY: 0,
      infoTabsTranslateY: 536,
      marketTranslateY: 56,
      regionAlertTranslateY: 56,
      tradeTranslateY: 96,
    });
  });

  it('uses one collapsed geometry for Trade, Market and Info Tabs', () => {
    expect(
      getPerpsProAndroidScenePresentationGeometry({
        ...base,
        rawOffset: 500,
        visibilityProgress: 0,
      }),
    ).toEqual({
      headerOpacity: 0,
      headerTranslateY: -56,
      infoTabsTranslateY: 40,
      marketTranslateY: 0,
      regionAlertTranslateY: 0,
      tradeTranslateY: -404,
    });
  });

  it('keeps the restricted market below the moving alert surface', () => {
    expect(
      getPerpsProAndroidScenePresentationGeometry({
        ...base,
        infoTabsAnchorY: 600,
        rawOffset: 500,
        regionAlertExtent: 64,
        restricted: true,
        sceneLeadInHeight: 160,
        visibilityProgress: 0,
      }),
    ).toEqual({
      headerOpacity: 0,
      headerTranslateY: -56,
      infoTabsTranslateY: 104,
      marketTranslateY: 64,
      regionAlertTranslateY: 0,
      tradeTranslateY: -340,
    });
  });
});
