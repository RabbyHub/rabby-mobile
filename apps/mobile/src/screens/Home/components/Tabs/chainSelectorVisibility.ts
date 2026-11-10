/**
 * The chain filter belongs to an address that actually has assets. While the
 * initial balance/curve load is running we still render it immediately (QA
 * 1145); once loading settles and the address has no chain assets, hide it
 * instead of showing an empty "All" pill (QA 1197).
 */
export function shouldShowChainSelector(input: {
  currentAddress?: string | null;
  chainLength: number;
  balanceLoading: boolean;
  isLoadingCurve: boolean;
}) {
  if (!input.currentAddress) return false;
  if (input.balanceLoading || input.isLoadingCurve) return true;
  return input.chainLength > 0;
}
