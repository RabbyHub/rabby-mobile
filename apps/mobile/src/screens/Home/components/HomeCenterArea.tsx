import React, { useCallback, useMemo, useRef } from 'react';
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
import { useMockDataForHomeCenterArea } from '../hooks/homeCenterArea';
import { DepositAssetsCard } from './DepositAssetsCard';
import { ConvertDustBanner } from './ConvertDustBanner';
import { useConvertDustBanner } from '../hooks/useConvertDustBanner';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import { RootNames } from '@/constant/layout';

export function HomeCenterArea() {
  const { styles } = useTheme2024({
    getStyle,
  });
  const navigation = useRabbyAppNavigation();

  const { accountToShowReceiveTip, isLoadingAccountToShowReceiveTip } =
    useAccountHomeShowReceiveTip();
  const { shouldShowRateGuideOnHome } = useExposureRateGuide();
  const offlineChainData = useOfflineChain();
  const txCount = rateGuideLastExposureState(state => state.txCount);
  const { mockData } = useMockDataForHomeCenterArea();
  const forceShowDepositAssetsCard = mockData?.forceShowDepositAssetsCard;
  const { shouldShowConvertDustBanner, dismissConvertDustBanner } =
    useConvertDustBanner();

  const prevAccountToShowReceiveTipRef = useRef(accountToShowReceiveTip);
  if (!isLoadingAccountToShowReceiveTip) {
    prevAccountToShowReceiveTipRef.current = accountToShowReceiveTip;
  }

  const displayAccount = isLoadingAccountToShowReceiveTip
    ? prevAccountToShowReceiveTipRef.current
    : accountToShowReceiveTip;

  const { viewedHomeTip: viewedScreenShotReportTip } = useViewedHomeTip();

  const handlePressConvertDustBanner = useCallback(() => {
    dismissConvertDustBanner();
    navigation.push(RootNames.StackTransaction, {
      screen: RootNames.ConvertDust,
      params: {
        fromHomeConvertDustBanner: true,
      },
    });
  }, [dismissConvertDustBanner, navigation]);

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
      convertDustBanner: false as boolean,
    };

    // Preserve previous account tip during refresh to prevent flickering
    if (isLoadingAccountToShowReceiveTip) {
      const hasPreviousTip = !!prevAccountToShowReceiveTipRef.current;
      return {
        blocksVisibility: {
          ...blocks,
          soloAccountToShowReceiveTip: hasPreviousTip,
        },
        noBetweenContent: !hasPreviousTip,
        onlyOneContent: hasPreviousTip,
      };
    }

    if (accountToShowReceiveTip || forceShowDepositAssetsCard) {
      blocks.soloAccountToShowReceiveTip = true;
    } else {
      if (shouldShowConvertDustBanner) {
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
    shouldShowConvertDustBanner,
    offlineChainData,
    accountToShowReceiveTip,
    viewedScreenShotReportTip,
    isLoadingAccountToShowReceiveTip,
    txCount,
    forceShowDepositAssetsCard,
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
          <DepositAssetsCard account={displayAccount || null} />
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

      {blocksVisibility.convertDustBanner && (
        <Animated.View entering={FadeInUp.duration(200)}>
          <ConvertDustBanner
            onPress={handlePressConvertDustBanner}
            onClose={dismissConvertDustBanner}
          />
        </Animated.View>
      )}
    </View>
  );
}

const getStyle = createGetStyles2024(() => ({
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
