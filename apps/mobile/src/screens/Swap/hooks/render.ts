import BigNumber from 'bignumber.js';
import { CHAINS_ENUM } from '@debank/common';
import type { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { useDebouncedValue } from '@/hooks/common/delayLikeValue';
import { isAccountSupportMiniApproval } from '@/utils/account';
import type { QuoteProvider } from './quote';

export const isMEVProtectionSupported = (chain: CHAINS_ENUM) =>
  [CHAINS_ENUM.ETH, CHAINS_ENUM.BSC].includes(chain);

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
  // 支付代币钱包余额 > 0
  const hasPayTokenBalance = new BigNumber(
    form.payToken?.raw_amount_hex_str || 0,
    16,
  ).gt(0);
  const hasUserInputAmount = Number(form.payAmount) > 0;
  const hasTokenPair = !!form.payToken && !!form.receiveToken;
  const isSameTokenPair =
    hasTokenPair && isSameAddress(form.payToken!.id, form.receiveToken!.id);
  // 无输入且有进行中 swap 时，优先展示进度而非预览
  const shouldPrioritizeSwapProgress =
    !hasUserInputAmount && pending.hasSwapProgress;

  // 休市提示
  const showClosedMarketTip =
    (!!form.payToken || !!form.receiveToken) && form.quoteBlockedByClosedMarket;
  // 有输入但无可用报价
  const noQuoteOrigin =
    hasUserInputAmount &&
    form.inSufficientCanGetQuote &&
    !form.quoteBlockedByClosedMarket &&
    hasPayTokenBalance &&
    !quote.loading &&
    hasTokenPair &&
    !quote.activeProvider;

  const showRiskTips =
    risk.isSlippageLow ||
    risk.isSlippageHigh ||
    risk.showLoss ||
    risk.gasFeeTooHigh;

  // 预览信息卡片
  const isPreviewVisible =
    hasTokenPair &&
    !isSameTokenPair &&
    page.isSupportedChain &&
    !shouldPrioritizeSwapProgress;
  // 两步授权进度（预览上方）
  const showTwoStepApproveProgress =
    !showRiskTips &&
    twoStep.shouldTwoStep &&
    twoStep.hasCurrentAccount &&
    !!twoStep.approveHash &&
    !!twoStep.currentTxChainId;
  // 预览内 MEV 保护开关
  const showMEVGuardedSwitch = isMEVProtectionSupported(page.chain);

  // 进行中 swap 交易列表
  const showPendingSwapProgress = !pending.approveHash && !isPreviewVisible;

  // Swap 按钮禁用
  const swapBtnDisabled =
    quote.loading ||
    !form.payToken ||
    !form.receiveToken ||
    !hasPayTokenBalance ||
    form.inSufficient ||
    !quote.activeProvider ||
    quote.isSubmitting;
  // 底部风险确认勾选
  const showRiskConfirm = showRiskTips && !swapBtnDisabled;
  // 展示简化签名按钮
  const canShowDirectSubmit =
    isAccountSupportMiniApproval(directSign.accountType || '') &&
    page.isSupportedChain &&
    !form.inSufficient;

  return {
    hasPayTokenBalance,
    hasUserInputAmount,
    shouldPrioritizeSwapProgress,
    showClosedMarketTip,
    noQuoteOrigin,
    showRiskTips,
    isPreviewVisible,
    showTwoStepApproveProgress,
    showMEVGuardedSwitch,
    showPendingSwapProgress,
    swapBtnDisabled,
    showRiskConfirm,
    canShowDirectSubmit,
  };
};

export const useSwapScreenRenderState = (
  params: SwapScreenRenderStateInput,
) => {
  const renderState = computeSwapScreenRenderState(params);
  const noQuote = useDebouncedValue(renderState.noQuoteOrigin, 10);

  return {
    ...renderState,
    noQuote,
  };
};
