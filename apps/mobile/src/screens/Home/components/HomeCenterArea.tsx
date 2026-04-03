import React, { useMemo } from 'react';
import { View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { RateModal } from '@/components/RateModal/RateModal';
import { RateModalTriggerOnHome } from '@/components/RateModal/RateModalTriggerOnHome';
import {
  useExposureRateGuide,
  rateGuideLastExposureState,
} from '@/components/RateModal/hooks';
import { TipFeedbackByScreenshot } from '@/components/Screenshot/HomeCenterTip';
import { useViewedHomeTip } from '@/components/Screenshot/hooks';
import { ITEM_LAYOUT_PADDING_HORIZONTAL } from '@/constant/home';
import {
  OfflineChainNotify,
  useOfflineChain,
} from '../components/OfflineChainNotify';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useAccountHomeShowReceiveTip } from '@/screens/Address/components/MultiAssets/hooks';
import { DepositAssetsCard } from './DepositAssetsCard';

export function HomeCenterArea() {
  const { styles } = useTheme2024({
    getStyle,
  });

  const { accountToShowReceiveTip, isLoadingAccountToShowReceiveTip } =
    useAccountHomeShowReceiveTip();
  const { shouldShowRateGuideOnHome } = useExposureRateGuide();
  const offlineChainData = useOfflineChain();
  const txCount = rateGuideLastExposureState(state => state.txCount);

  const { viewedHomeTip: viewedScreenShotReportTip } = useViewedHomeTip();

  const { blocksVisibility, noBetweenContent, onlyOneContent } = useMemo(() => {
    const hasOfflineChainData = !!(
      offlineChainData.displayWillClosedChain &&
      offlineChainData.offlineChainInfo
    );

    const hasCompletedTransaction = txCount > 0;

    const blocks = {
      soloAccountToShowReceiveTip: false as boolean,
      rateGuideOnHome: false as boolean,
      offlineChainData: false as boolean,
      tipScreenshot: false as boolean,
    };

    // Wait for account check to complete before deciding what to show
    if (isLoadingAccountToShowReceiveTip) {
      // Show nothing while loading to prevent flickering
      return {
        blocksVisibility: blocks,
        noBetweenContent: true,
        onlyOneContent: false,
      };
    }

    if (accountToShowReceiveTip) {
      blocks.soloAccountToShowReceiveTip = true;
    } else {
      if (hasCompletedTransaction && hasOfflineChainData)
        blocks.offlineChainData = true;
      if (hasCompletedTransaction && !viewedScreenShotReportTip)
        blocks.tipScreenshot = true;
      else if (shouldShowRateGuideOnHome) blocks.rateGuideOnHome = true;
    }

    const visibleEls = Object.values(blocks);
    const hasBetweenContent = visibleEls.some(Boolean);
    return {
      blocksVisibility: blocks,
      noBetweenContent: !hasBetweenContent,
      onlyOneContent: visibleEls.filter(Boolean).length === 1,
    };
  }, [
    shouldShowRateGuideOnHome,
    offlineChainData,
    accountToShowReceiveTip,
    viewedScreenShotReportTip,
    isLoadingAccountToShowReceiveTip,
    txCount,
  ]);

  return (
    <View
      style={[
        noBetweenContent
          ? styles.contentBetweenHeaderAndMatrixEmpty
          : styles.contentBetweenHeaderAndMatrix,
        onlyOneContent ? styles.contentBetweenHeaderAndMatrixOnlyOne : null,
      ]}>
      {blocksVisibility.offlineChainData && (
        <Animated.View entering={FadeInUp.duration(200)}>
          <OfflineChainNotify data={offlineChainData} />
        </Animated.View>
      )}

      {blocksVisibility.soloAccountToShowReceiveTip && (
        <Animated.View entering={FadeInUp.duration(200)}>
          <DepositAssetsCard account={accountToShowReceiveTip} />
        </Animated.View>
      )}

      {blocksVisibility.tipScreenshot && (
        <Animated.View entering={FadeInUp.duration(200)}>
          <TipFeedbackByScreenshot />
        </Animated.View>
      )}

      {blocksVisibility.rateGuideOnHome && (
        <Animated.View
          entering={FadeInUp.duration(200)}
          style={{
            paddingHorizontal: ITEM_LAYOUT_PADDING_HORIZONTAL,
          }}>
          <RateModalTriggerOnHome /* totalBalanceText={combineData.netWorth} */
          />
          <RateModal /* totalBalanceText={combineData.netWorth} */ />
        </Animated.View>
      )}
    </View>
  );
}

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  contentBetweenHeaderAndMatrix: {
    marginTop: 12,
    marginBottom: 12,
    gap: 12,
    // ...makeDebugBorder(),
  },
  contentBetweenHeaderAndMatrixEmpty: {
    marginBottom: 12,
  },
  contentBetweenHeaderAndMatrixOnlyOne: {
    paddingTop: 0,
  },
}));
