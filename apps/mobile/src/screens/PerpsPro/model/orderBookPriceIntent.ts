import type { PerpsProAttachedTpSlDraft, PerpsProTpSlLegKind } from './tpsl';

export type PerpsProTradeInputFocusOwner =
  | PerpsProTpSlLegKind
  | 'amount'
  | null;

export type PerpsProOrderBookPriceIntent =
  | { type: 'attachedTpSlPrice'; leg: PerpsProTpSlLegKind }
  | { type: 'dismissKeyboard' }
  | { type: 'tradePrice' };

export type PerpsProOrderBookPriceSelectionOutcome =
  | 'accepted'
  | 'invalidPrice'
  | 'rejected';

export const resolvePerpsProOrderBookPriceIntent = ({
  attachedTpSl,
  focusOwner,
}: {
  attachedTpSl: PerpsProAttachedTpSlDraft;
  focusOwner: PerpsProTradeInputFocusOwner;
}): PerpsProOrderBookPriceIntent => {
  if (focusOwner === 'amount') {
    return { type: 'dismissKeyboard' };
  }
  if (focusOwner === 'tp' || focusOwner === 'sl') {
    return attachedTpSl.enabled && attachedTpSl[focusOwner].mode === 'price'
      ? { type: 'attachedTpSlPrice', leg: focusOwner }
      : { type: 'dismissKeyboard' };
  }
  return { type: 'tradePrice' };
};
