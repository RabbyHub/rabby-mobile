export type HomeCenterAreaBlocksVisibility = {
  soloAccountToShowReceiveTip: boolean;
  rateGuideOnHome: boolean;
  offlineChainData: boolean;
  tipScreenshot: boolean;
  convertDustBanner: boolean;
};

export type HomeCenterAreaVisibility = {
  blocksVisibility: HomeCenterAreaBlocksVisibility;
  noBetweenContent: boolean;
  onlyOneContent: boolean;
};

type ResolveHomeCenterAreaVisibilityParams = {
  previousResolvedVisibility: HomeCenterAreaVisibility | null;
  isLoadingAccountToShowReceiveTip: boolean;
  hasAccountToShowReceiveTip: boolean;
  forceShowDepositAssetsCard: boolean;
  shouldShowConvertDustBanner: boolean;
  hasCompletedTransaction: boolean;
  hasOfflineChainData: boolean;
  viewedScreenShotReportTip: boolean;
  shouldShowRateGuideOnHome: boolean;
};

function createEmptyVisibility(): HomeCenterAreaVisibility {
  return {
    blocksVisibility: {
      soloAccountToShowReceiveTip: false,
      rateGuideOnHome: false,
      offlineChainData: false,
      tipScreenshot: false,
      convertDustBanner: false,
    },
    noBetweenContent: true,
    onlyOneContent: false,
  };
}

export function resolveHomeCenterAreaVisibility({
  previousResolvedVisibility,
  isLoadingAccountToShowReceiveTip,
  hasAccountToShowReceiveTip,
  forceShowDepositAssetsCard,
  shouldShowConvertDustBanner,
  hasCompletedTransaction,
  hasOfflineChainData,
  viewedScreenShotReportTip,
  shouldShowRateGuideOnHome,
}: ResolveHomeCenterAreaVisibilityParams): HomeCenterAreaVisibility {
  if (isLoadingAccountToShowReceiveTip) {
    return previousResolvedVisibility ?? createEmptyVisibility();
  }

  const blocks = createEmptyVisibility().blocksVisibility;

  if (hasAccountToShowReceiveTip || forceShowDepositAssetsCard) {
    blocks.soloAccountToShowReceiveTip = true;
  } else if (shouldShowConvertDustBanner) {
    blocks.convertDustBanner = true;
  } else {
    if (hasCompletedTransaction && hasOfflineChainData) {
      blocks.offlineChainData = true;
    }
    if (hasCompletedTransaction && !viewedScreenShotReportTip) {
      blocks.tipScreenshot = true;
    } else if (shouldShowRateGuideOnHome) {
      blocks.rateGuideOnHome = true;
    }
  }

  const visibleBlocks = Object.values(blocks);
  return {
    blocksVisibility: blocks,
    noBetweenContent: !visibleBlocks.some(Boolean),
    onlyOneContent: visibleBlocks.filter(Boolean).length === 1,
  };
}
