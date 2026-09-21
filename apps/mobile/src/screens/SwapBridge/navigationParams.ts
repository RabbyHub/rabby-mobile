type ConsumableSwapNavigationParams = {
  isSwapToTokenDetail?: boolean;
  isFromSwap?: boolean;
};

export function shouldClearConsumedSwapNavigationParams(
  params?: ConsumableSwapNavigationParams,
) {
  return !!(params?.isSwapToTokenDetail || params?.isFromSwap);
}
