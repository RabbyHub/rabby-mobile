import { useMemo } from 'react';
import BigNumber from 'bignumber.js';
import { CHAINS_ENUM } from '@debank/common';
import type { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { useDebouncedValue } from '@/hooks/common/delayLikeValue';
import { isAccountSupportMiniApproval } from '@/utils/account';
import type { QuoteProvider } from './quote';

export const isMEVProtectionSupported = (chain: CHAINS_ENUM) =>
  [CHAINS_ENUM.ETH, CHAINS_ENUM.BSC].includes(chain);

const isSameTokenId = (left?: string, right?: string) =>
  !!left && !!right && left.toLowerCase() === right.toLowerCase();

export type SwapScreenRenderStateInput = {
  form: {
    payAmount: string;
    payToken?: TokenItem;
    receiveToken?: TokenItem;
    inSufficient: boolean;
    inSufficientCanGetQuote: boolean;
    quoteBlockedByClosedMarket: boolean;
  };
  quote: {
    loading: boolean;
    activeProvider?: QuoteProvider;
    isSubmitting: boolean;
  };
  page: {
    chain: CHAINS_ENUM;
    isSupportedChain: boolean;
  };
  risk: {
    isSlippageLow: boolean;
    isSlippageHigh: boolean;
    showLoss: boolean;
    gasFeeTooHigh: boolean;
  };
  directSign: {
    accountType?: string;
  };
  twoStep: {
    shouldTwoStep: boolean;
    approveHash?: string;
    currentTxChainId?: number;
    hasCurrentAccount: boolean;
  };
  pending: {
    hasSwapProgress: boolean;
    approveHash?: string;
  };
};

export const computeSwapScreenRenderState = ({
  form,
  quote,
  page,
  risk,
  directSign,
  twoStep,
  pending,
}: SwapScreenRenderStateInput) => {
  const hasPayTokenBalance = new BigNumber(
    form.payToken?.raw_amount_hex_str || 0,
    16,
  ).gt(0);
  const hasUserInputAmount = Number(form.payAmount) > 0;
  const hasTokenPair = !!form.payToken && !!form.receiveToken;
  const isSameTokenPair = isSameTokenId(
    form.payToken?.id,
    form.receiveToken?.id,
  );
  const shouldPrioritizeSwapProgress =
    !hasUserInputAmount && pending.hasSwapProgress;

  const canShowDirectSubmit =
    isAccountSupportMiniApproval(directSign.accountType || '') &&
    page.isSupportedChain &&
    !form.inSufficient;

  const swapBtnDisabled =
    quote.loading ||
    !form.payToken ||
    !form.receiveToken ||
    !hasPayTokenBalance ||
    form.inSufficient ||
    !quote.activeProvider ||
    quote.isSubmitting;

  const isPreviewVisible =
    hasTokenPair &&
    !isSameTokenPair &&
    page.isSupportedChain &&
    !shouldPrioritizeSwapProgress;

  const noQuoteOrigin =
    hasUserInputAmount &&
    form.inSufficientCanGetQuote &&
    !form.quoteBlockedByClosedMarket &&
    hasPayTokenBalance &&
    !quote.loading &&
    hasTokenPair &&
    !quote.activeProvider;

  const showClosedMarketTip =
    (!!form.payToken || !!form.receiveToken) && form.quoteBlockedByClosedMarket;

  const showRiskTips =
    risk.isSlippageLow ||
    risk.isSlippageHigh ||
    risk.showLoss ||
    risk.gasFeeTooHigh;
  const showRiskConfirm = showRiskTips && !swapBtnDisabled;

  const showTwoStepApproveProgress =
    !showRiskTips &&
    twoStep.shouldTwoStep &&
    twoStep.hasCurrentAccount &&
    !!twoStep.approveHash &&
    !!twoStep.currentTxChainId;

  const showMEVGuardedSwitch = isMEVProtectionSupported(page.chain);

  const showPendingSwapProgress = !pending.approveHash && !isPreviewVisible;

  return {
    hasPayTokenBalance,
    hasUserInputAmount,
    canShowDirectSubmit,
    swapBtnDisabled,
    isPreviewVisible,
    noQuoteOrigin,
    showClosedMarketTip,
    showRiskTips,
    showRiskConfirm,
    showTwoStepApproveProgress,
    showMEVGuardedSwitch,
    showPendingSwapProgress,
  };
};

export const useSwapScreenRenderState = (
  params: SwapScreenRenderStateInput,
) => {
  const renderState = useMemo(
    () => computeSwapScreenRenderState(params),
    [params],
  );
  const noQuote = useDebouncedValue(renderState.noQuoteOrigin, 10);

  return {
    ...renderState,
    noQuote,
  };
};
