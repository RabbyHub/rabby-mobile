import {
  resolveHomeCenterAreaVisibility,
  type HomeCenterAreaVisibility,
} from './homeCenterAreaVisibility';

const defaultParams = {
  previousResolvedVisibility: null,
  isLoadingAccountToShowReceiveTip: false,
  hasAccountToShowReceiveTip: false,
  forceShowDepositAssetsCard: false,
  shouldShowConvertDustBanner: false,
  hasCompletedTransaction: false,
  hasOfflineChainData: false,
  viewedScreenShotReportTip: true,
  shouldShowRateGuideOnHome: false,
};

describe('resolveHomeCenterAreaVisibility', () => {
  it('keeps the center area empty before the first account-tip check resolves', () => {
    const result = resolveHomeCenterAreaVisibility({
      ...defaultParams,
      isLoadingAccountToShowReceiveTip: true,
    });

    expect(result).toEqual({
      blocksVisibility: {
        soloAccountToShowReceiveTip: false,
        rateGuideOnHome: false,
        offlineChainData: false,
        tipScreenshot: false,
        convertDustBanner: false,
      },
      noBetweenContent: true,
      onlyOneContent: false,
    });
  });

  it('preserves the Convert Dust banner throughout a refresh', () => {
    const resolved = resolveHomeCenterAreaVisibility({
      ...defaultParams,
      shouldShowConvertDustBanner: true,
    });

    const refreshing = resolveHomeCenterAreaVisibility({
      ...defaultParams,
      previousResolvedVisibility: resolved,
      isLoadingAccountToShowReceiveTip: true,
    });

    expect(refreshing).toBe(resolved);
    expect(refreshing.blocksVisibility.convertDustBanner).toBe(true);
  });

  it('preserves the resolved account tip and its layout throughout a refresh', () => {
    const resolved = resolveHomeCenterAreaVisibility({
      ...defaultParams,
      hasAccountToShowReceiveTip: true,
    });

    const refreshing = resolveHomeCenterAreaVisibility({
      ...defaultParams,
      previousResolvedVisibility: resolved,
      isLoadingAccountToShowReceiveTip: true,
    });

    expect(refreshing).toBe(resolved);
    expect(refreshing.blocksVisibility.soloAccountToShowReceiveTip).toBe(true);
    expect(refreshing.onlyOneContent).toBe(true);
  });

  it('recomputes the final state after refresh completes', () => {
    const previousResolvedVisibility: HomeCenterAreaVisibility =
      resolveHomeCenterAreaVisibility({
        ...defaultParams,
        shouldShowConvertDustBanner: true,
      });

    const result = resolveHomeCenterAreaVisibility({
      ...defaultParams,
      previousResolvedVisibility,
      hasCompletedTransaction: true,
      hasOfflineChainData: true,
      viewedScreenShotReportTip: false,
    });

    expect(result.blocksVisibility).toEqual({
      soloAccountToShowReceiveTip: false,
      rateGuideOnHome: false,
      offlineChainData: true,
      tipScreenshot: true,
      convertDustBanner: false,
    });
    expect(result.noBetweenContent).toBe(false);
    expect(result.onlyOneContent).toBe(false);
  });
});
