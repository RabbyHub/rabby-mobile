import type { BridgeQuote } from '@rabby-wallet/rabby-api/dist/types';

export interface SelectedBridgeQuote extends Omit<BridgeQuote, 'tx'> {
  shouldApproveToken?: boolean;
  shouldTwoStepApprove?: boolean;
  loading?: boolean;
  /**
   * Quote/approve decoupling: the approve (allowance) result may arrive after
   * the quote itself, so the reserved approve slot tracks its own state.
   */
  approvalLoading?: boolean;
  approvalError?: boolean;
  tx?: BridgeQuote['tx'];
  manualClick?: boolean;
}
