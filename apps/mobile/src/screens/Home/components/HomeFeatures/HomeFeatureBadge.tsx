import React from 'react';

import IconGift from '@/assets2024/icons/home/IconGift.svg';
import { MultiHomeFeatTitle } from '@/constant/newStyle';
import { useHomePostStartupReady } from '@/core/utils/homeStartupReady';
import { useGasAccountGiftEligibility } from '@/hooks/useGasAccountEligibility';
import { GasAccountBadge } from '@/screens/GasAccount/components/GasAccountBadge';
import { useApprovalAlertTotal } from '../../hooks/approvals';
import { useHomePendingTxCount } from '../../hooks/history';
import { BadgeText } from '../BadgeText';
import { HomePendingBadge } from '../HomePending';
import { LendingHF } from '../LendingHF';
import { MemeCoinBalance } from '../MemeCoinBalance';
import { PerpsPnl } from '../PerpsPnl';

function HistoryBadge() {
  const pendingTxCount = useHomePendingTxCount();

  return pendingTxCount > 0 ? (
    <HomePendingBadge number={pendingTxCount} />
  ) : null;
}

function ApprovalBadge() {
  const approvalTotal = useApprovalAlertTotal();

  return approvalTotal > 0 ? <BadgeText count={approvalTotal} /> : null;
}

function GasAccountFeatureBadge() {
  const isGiftEligible = useGasAccountGiftEligibility();

  return isGiftEligible ? (
    <IconGift width={24} height={24} />
  ) : (
    <GasAccountBadge />
  );
}

/**
 * The top-right figure of a feature card. Every badge subscribes on its own,
 * so a balance or a pending count changing repaints one card, not the grid.
 */
export const HomeFeatureBadge = React.memo(function HomeFeatureBadge({
  featureKey,
}: {
  featureKey: MultiHomeFeatTitle;
}) {
  const startupReady = useHomePostStartupReady();

  if (!startupReady) {
    return null;
  }

  switch (featureKey) {
    case MultiHomeFeatTitle.Perps:
      return <PerpsPnl />;
    case MultiHomeFeatTitle.History:
      return <HistoryBadge />;
    case MultiHomeFeatTitle.Approvals:
      return <ApprovalBadge />;
    case MultiHomeFeatTitle.Lending:
      return <LendingHF />;
    case MultiHomeFeatTitle.MemeCoin:
      return <MemeCoinBalance />;
    case MultiHomeFeatTitle.GasAccount:
      return <GasAccountFeatureBadge />;
    default:
      return null;
  }
});
