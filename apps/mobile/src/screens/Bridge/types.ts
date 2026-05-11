import type { BridgeQuote } from '@rabby-wallet/rabby-api/dist/types';

export interface SelectedBridgeQuote extends Omit<BridgeQuote, 'tx'> {
  shouldApproveToken?: boolean;
  shouldTwoStepApprove?: boolean;
  loading?: boolean;
  tx?: BridgeQuote['tx'];
  manualClick?: boolean;
}
