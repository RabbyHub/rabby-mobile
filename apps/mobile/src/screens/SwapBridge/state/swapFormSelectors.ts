import BigNumber from 'bignumber.js';

import { tokenAmountBn } from './swapFormMath';
import type { SwapFormState } from './swapFormStore';

export const selectDraft = (state: SwapFormState) => state.draft;
export const selectCommitted = (state: SwapFormState) => state.committed;
export const selectIsMax = (state: SwapFormState) => state.isMax;
export const selectIsDragging = (state: SwapFormState) => state.isDragging;

/** Draft-based insufficient check for the amount card while dragging. */
export const selectInsufficientDraft = (state: SwapFormState) => {
  const { payToken, draft } = state;
  return payToken
    ? tokenAmountBn(payToken).lt(new BigNumber(draft || 0))
    : new BigNumber(0).lt(new BigNumber(draft || 0));
};
