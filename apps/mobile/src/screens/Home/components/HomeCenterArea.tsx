import React, { useMemo } from 'react';
import { TouchableOpacity as RNTouchableOpacity, View } from 'react-native';

import { RateModal } from '@/components/RateModal/RateModal';
import { RateModalTriggerOnHome } from '@/components/RateModal/RateModalTriggerOnHome';
import { useExposureRateGuide } from '@/components/RateModal/hooks';
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
import { ReceiveOnNoAssets } from './ReceiveOnNoAssets';

export function HomeCenterArea() {
  const { styles, colors2024 } = useTheme2024({
    getStyle,
  });

  const { accountToShowReceiveTip } = useAccountHomeShowReceiveTip();
  const { shouldShowRateGuideOnHome } = useExposureRateGuide();
  const offlineChainData = useOfflineChain();

  const { viewedHomeTip: viewedScreenShotReportTip } = useViewedHomeTip();

  const { blocksVisibility, noBetweenContent, onlyOneContent } = useMemo(() => {
    const blocks = {
      soloAccountToShowReceiveTip: false as boolean,
      rateGuideOnHome: false as boolean,
      offlineChainData: !!(
        offlineChainData.displayWillClosedChain &&
        offlineChainData.offlineChainInfo
      ),
      tipScreenshot: false as boolean,
    };

    if (accountToShowReceiveTip) blocks.soloAccountToShowReceiveTip = true;
    else if (!viewedScreenShotReportTip) blocks.tipScreenshot = true;
    else if (shouldShowRateGuideOnHome) blocks.rateGuideOnHome = true;

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
        <OfflineChainNotify data={offlineChainData} />
      )}

      {blocksVisibility.soloAccountToShowReceiveTip && (
        <ReceiveOnNoAssets.BgWrapper isForSingle={false}>
          <ReceiveOnNoAssets
            account={accountToShowReceiveTip}
            isForSingle={false}
          />
        </ReceiveOnNoAssets.BgWrapper>
      )}

      {blocksVisibility.tipScreenshot && <TipFeedbackByScreenshot />}

      {blocksVisibility.rateGuideOnHome && (
        <View
          style={{
            paddingHorizontal: ITEM_LAYOUT_PADDING_HORIZONTAL,
          }}>
          <RateModalTriggerOnHome /* totalBalanceText={combineData.netWorth} */
          />
          <RateModal /* totalBalanceText={combineData.netWorth} */ />
        </View>
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
