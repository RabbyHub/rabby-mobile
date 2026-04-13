export type ApprovalGasDisplayMode =
  | 'legacy'
  | 'native_insufficient_prefers_gasAccount';

// Flip this back to `legacy` to restore the previous approval gas UI behavior.
export const APPROVAL_GAS_DISPLAY_MODE: ApprovalGasDisplayMode =
  'native_insufficient_prefers_gasAccount';
