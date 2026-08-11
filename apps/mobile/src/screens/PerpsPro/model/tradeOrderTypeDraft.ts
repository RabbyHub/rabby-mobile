import {
  createPerpsProTradeAmountDraft,
  getPerpsProTradeAmountDraftDisplay,
  type PerpsProTradeAmountDraft,
} from './tradeAmountDraft';
import type { PerpsProTradeAmountUnit, PerpsProTradeOrderType } from './trade';

export type PerpsProTradeAmountSource = 'manual' | 'slider';

export type PerpsProTradeOrderTypeAmountDraft = {
  amountDraft: PerpsProTradeAmountDraft;
  amountSource: PerpsProTradeAmountSource;
  percentage: number;
};

export type PerpsProTradeOrderTypeAmountDrafts = Record<
  PerpsProTradeOrderType,
  PerpsProTradeOrderTypeAmountDraft
>;

export const createPerpsProTradeOrderTypeAmountDraft =
  (): PerpsProTradeOrderTypeAmountDraft => ({
    amountDraft: createPerpsProTradeAmountDraft(),
    amountSource: 'manual',
    percentage: 0,
  });

export const createPerpsProTradeOrderTypeAmountDrafts =
  (): PerpsProTradeOrderTypeAmountDrafts => ({
    conditional: createPerpsProTradeOrderTypeAmountDraft(),
    limit: createPerpsProTradeOrderTypeAmountDraft(),
    market: createPerpsProTradeOrderTypeAmountDraft(),
  });

export const getPerpsProTradeOrderTypeAmountDisplay = ({
  amountUnit,
  draft,
}: {
  amountUnit: PerpsProTradeAmountUnit;
  draft: PerpsProTradeOrderTypeAmountDraft;
}) =>
  draft.amountSource === 'slider' && draft.percentage > 0
    ? `${draft.percentage}%`
    : getPerpsProTradeAmountDraftDisplay(draft.amountDraft, amountUnit);
