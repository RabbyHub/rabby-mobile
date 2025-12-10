import React, { useMemo } from 'react';
import { TouchableOpacity as RNTouchableOpacity, View } from 'react-native';

import { RateModal } from '@/components/RateModal/RateModal';
import { RateModalTriggerOnHome } from '@/components/RateModal/RateModalTriggerOnHome';
import { useExposureRateGuide } from '@/components/RateModal/hooks';
import { TipFeedbackByScreenshot } from '@/components/Screenshot/HomeCenterTip';
import { useViewedHomeTip } from '@/components/Screenshot/hooks';
import { isNonPublicProductionEnv } from '@/constant';
import { ITEM_LAYOUT_PADDING_HORIZONTAL } from '@/constant/home';
import { useMockDataForHomeCenterArea } from '@/screens/Settings/sheetModals/DevUIHomeCenterArea';
import { FoundYourWalletGuide } from '../FundYourWallet';
import {
  OfflineChainNotify,
  useOfflineChain,
} from '../components/OfflineChainNotify';
import useAccountsBalance from '@/hooks/useAccountsBalance';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { transactionHistoryService } from '@/core/services';

export function HomeCenterArea() {
  const { styles, colors2024 } = useTheme2024({
    getStyle,
  });

  const {
    balanceAccounts,
    balanceCacheAccounts,
    // loadBalanceFromApiStage,
  } = useAccountsBalance();

  const { mockData } = useMockDataForHomeCenterArea();

  const displayFundWalletOrig = useMemo(() => {
    return (
      !!balanceAccounts.length &&
      balanceAccounts.every(e => e.balance === 0) &&
      balanceCacheAccounts.every(e => e.balance === 0) &&
      balanceAccounts.every(
        e =>
          transactionHistoryService.getTransactionGroups({
            address: e.address,
          }).length === 0,
      )
    );
  }, [balanceAccounts, balanceCacheAccounts]);

  const displayFundWallet = useMemo(() => {
    if (isNonPublicProductionEnv && mockData.forceShowFundWallet) {
      return true;
    }
    return displayFundWalletOrig;
  }, [displayFundWalletOrig, mockData.forceShowFundWallet]);

  const { shouldShowRateGuideOnHome } = useExposureRateGuide();
  const offlineChainData = useOfflineChain();
  const { viewedHomeTip } = useViewedHomeTip();

  const { noBetweenContent, onlyOneContent } = useMemo(() => {
    const visibleEls = [
      displayFundWallet,
      shouldShowRateGuideOnHome,
      offlineChainData.displayWillClosedChain &&
        offlineChainData.offlineChainInfo,
      !viewedHomeTip,
    ];
    const hasBetweenContent = visibleEls.some(Boolean);
    return {
      noBetweenContent: !hasBetweenContent,
      onlyOneContent: visibleEls.filter(Boolean).length === 1,
    };
  }, [
    shouldShowRateGuideOnHome,
    offlineChainData,
    displayFundWallet,
    viewedHomeTip,
  ]);

  return (
    <View
      style={[
        noBetweenContent
          ? styles.contentBetweenHeaderAndMatrixEmpty
          : styles.contentBetweenHeaderAndMatrix,
        onlyOneContent ? styles.contentBetweenHeaderAndMatrixOnlyOne : null,
      ]}>
      <OfflineChainNotify data={offlineChainData} />

      {displayFundWallet && <FoundYourWalletGuide />}

      {shouldShowRateGuideOnHome && (
        <View
          style={{
            paddingHorizontal: ITEM_LAYOUT_PADDING_HORIZONTAL,
          }}>
          <RateModalTriggerOnHome /* totalBalanceText={combineData.netWorth} */
          />
          <RateModal /* totalBalanceText={combineData.netWorth} */ />
        </View>
      )}

      <TipFeedbackByScreenshot />
    </View>
  );
}

const getStyle = createGetStyles2024(
  ({ colors2024, isLight, bottomSafeArea }) => ({
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
  }),
);
