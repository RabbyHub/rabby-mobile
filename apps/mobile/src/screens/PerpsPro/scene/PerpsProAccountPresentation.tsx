import React, { useCallback } from 'react';
import { shallow } from 'zustand/shallow';

import { perpsStore, type PerpsState } from '@/hooks/perps/usePerpsStore';
import { useActivityStore } from '@/hooks/storeActivity/useActivityStore';
import { PerpsProAccountSummary } from '../components/account/PerpsProAccountSummary';
import { PerpsProAccountAssetRow } from '../components/account/PerpsProAccountAssetRow';
import type { PerpsAccountAssetRow } from '../model/account';
import type { PerpsProAccountSelectors } from './perpsProAccountSelectors';

export const PerpsProAccountSummaryRow = React.memo(
  ({
    selectors,
    onDeposit,
    onWithdraw,
  }: {
    selectors: PerpsProAccountSelectors;
    onDeposit: () => void;
    onWithdraw: () => void;
  }) => {
    const account = useActivityStore(perpsStore, selectors.summary, shallow);
    return (
      <PerpsProAccountSummary
        account={account}
        onDeposit={onDeposit}
        onWithdraw={onWithdraw}
      />
    );
  },
);
PerpsProAccountSummaryRow.displayName = 'PerpsProAccountSummaryRow';

export const PerpsProAccountAssetDataRow = React.memo(
  ({
    selectors,
    assetKey,
    onSwap,
    onTransfer,
  }: {
    selectors: PerpsProAccountSelectors;
    assetKey: string;
    onSwap: (coin: PerpsAccountAssetRow['coin']) => void;
    onTransfer: (asset: PerpsAccountAssetRow) => void;
  }) => {
    const selectAsset = useCallback(
      (state: PerpsState) =>
        selectors.valuation(state).assets.find(asset => asset.key === assetKey),
      [assetKey, selectors],
    );
    const asset = useActivityStore(perpsStore, selectAsset, shallow);
    return asset ? (
      <PerpsProAccountAssetRow
        asset={asset}
        onSwap={onSwap}
        onTransfer={onTransfer}
      />
    ) : null;
  },
);
PerpsProAccountAssetDataRow.displayName = 'PerpsProAccountAssetDataRow';
