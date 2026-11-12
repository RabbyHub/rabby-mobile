/**
 * The chain filter belongs to an address that actually has assets.
 *
 * While the first projection/balance load is still running the selector is
 * shown in its loading state, so the row does not pop the control in later
 * (QA 1145/1157). Once it settles the two cases diverge: an address with chain
 * assets keeps the filter, an address with none hides it instead of showing an
 * empty "All" pill (QA 1197). The loading state itself is identical in both —
 * only the settled outcome differs.
 */
export function shouldShowChainSelector(input: {
  currentAddress?: string | null;
  chainLength: number;
  pending: boolean;
}) {
  if (!input.currentAddress) return false;
  if (input.pending) return true;
  return input.chainLength > 0;
}
