import React from 'react';
import { shallow } from 'zustand/shallow';

import { perpsStore } from '@/hooks/perps/usePerpsStore';
import { useActivityStore } from '@/hooks/storeActivity/useActivityStore';
import { PerpsProAccountSummary } from '../components/account/PerpsProAccountSummary';
import type { PerpsAccountAssetRow } from '../model/account';
import type { PerpsProAccountSelectors } from './perpsProAccountSelectors';

export const PerpsProAccountSummaryRow = React.memo(
  ({
    selectors,
    onDeposit,
    onSwap,
    onTransfer,
    onWithdraw,
  }: {
    selectors: PerpsProAccountSelectors;
    onDeposit: () => void;
    onSwap: (coin: PerpsAccountAssetRow['coin']) => void;
    onTransfer: (asset: PerpsAccountAssetRow) => void;
    onWithdraw: () => void;
  }) => {
    // One card holds the summary, actions and asset rows (Figma
    // 86609:327475), so the card reads the full valuation instead of the
    // summary-only slice.
    const account = useActivityStore(perpsStore, selectors.valuation, shallow);
    return (
      <PerpsProAccountSummary
        account={account}
        onDeposit={onDeposit}
        onSwap={onSwap}
        onTransfer={onTransfer}
        onWithdraw={onWithdraw}
      />
    );
  },
);
PerpsProAccountSummaryRow.displayName = 'PerpsProAccountSummaryRow';
