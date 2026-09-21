import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';

import type { PerpsQuoteAsset } from '@/constant/perps';
import {
  isPerpsUserAbstractionReadyForAccount,
  perpsStore,
} from '@/hooks/perps/usePerpsStore';
import {
  getPerpsProCollateralToken,
  resolvePerpsProCrossMarginAvailableAfterMaintenance,
} from '@/screens/PerpsPro/model/tradeRiskAccount';

// Stable snapshot returned while disabled so the shallow-equal check bails and
// hidden consumers stop re-rendering on every store frame.
const DISABLED_FACTS = {
  accountFactsReady: false,
  dexCrossAccountValue: null,
  dexCrossMaintenanceMarginUsed: null,
  unifiedAvailableAfterMaintenance: null,
  userAbstraction: '',
};

/**
 * Simple-mode mirror of Perps Pro's cross risk balance: the account-mode-aware
 * Cross collateral remaining after current maintenance. Unified accounts use
 * the server-computed per-collateral-token balance, standard accounts use the
 * selected DEX's cross summary, and Portfolio Margin fails closed (null).
 *
 * Pass enabled=false while the consumer is hidden to freeze the store
 * subscription (returns null without re-rendering on hot WS frames).
 */
export const useCrossMarginAvailableAfterMaintenance = ({
  dexId,
  quoteAsset,
  enabled = true,
}: {
  dexId: string;
  quoteAsset?: string;
  enabled?: boolean;
}) => {
  const collateralToken = getPerpsProCollateralToken(
    (quoteAsset ?? 'USDC') as PerpsQuoteAsset,
  );
  const facts = perpsStore(
    useShallow(state => {
      if (!enabled) {
        return DISABLED_FACTS;
      }
      const dexSummary =
        state.currentClearinghouseState?.perDexSummaries?.[dexId];
      return {
        accountFactsReady:
          state.isUserDataReady && isPerpsUserAbstractionReadyForAccount(state),
        dexCrossAccountValue: dexSummary?.crossAccountValue ?? null,
        dexCrossMaintenanceMarginUsed:
          dexSummary?.crossMaintenanceMarginUsed ?? null,
        unifiedAvailableAfterMaintenance:
          collateralToken == null
            ? null
            : state.spotState.tokenToAvailableAfterMaintenance?.find(
                ([token]) => token === collateralToken,
              )?.[1] ?? null,
        userAbstraction: state.userAbstraction,
      };
    }),
  );
  return useMemo(
    () => resolvePerpsProCrossMarginAvailableAfterMaintenance(facts),
    [facts],
  );
};
