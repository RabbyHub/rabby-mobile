import { type Dispatch, type SetStateAction, useEffect, useRef } from 'react';
import BigNumber from 'bignumber.js';
import { useMemoizedFn } from 'ahooks';
import type { CHAINS_ENUM } from '@debank/common';
import type { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import {
  getChainDefaultToken,
  getDefaultSwapToTokenItem,
} from '@/constant/swap';
import type { ActiveRegressionScenarioContext } from '@/devtools/regressionScenarios/contracts';
import { useRegressionScenario } from '@/devtools/regressionScenarios/react';
import { findChainByEnum } from '@/utils/chain';
import type { QuoteProvider } from '../../Swap/hooks/quote';
import {
  formatSafeHash,
  isRegressionBroadcastRequested,
  isSameAmountValue,
  readRegressionSwapChain,
  readRegressionUsdParam,
} from '../util';

const DEFAULT_REGRESSION_TARGET_USD = '0.1';
const DEFAULT_REGRESSION_MAX_TOTAL_USD = '1';

type PendingBroadcastSuccess = Pick<
  ActiveRegressionScenarioContext<'SwapBridge'>,
  'claimOnce' | 'report'
>;

type UseSwapFundedRegressionParams = {
  sceneActive: boolean;
  chain: CHAINS_ENUM;
  chainServerId: string;
  payAmount: string;
  payToken?: TokenItem;
  receiveToken?: TokenItem;
  quoteLoading: boolean;
  inSufficient: boolean;
  slippageChanged: boolean;
  activeProvider?: QuoteProvider;
  quoteListLength: number;
  swapBtnDisabled: boolean;
  canShowDirectSubmit: boolean;
  shouldTwoStepSwap: boolean;
  showRiskConfirm: boolean;
  riskChecked: boolean;
  riskConfirmDisabled: boolean;
  handleAmountChange: (value: string) => void;
  switchChain: (
    chain: CHAINS_ENUM,
    options?: {
      payTokenId?: string;
      changeTo?: boolean;
      markExplicitSelection?: boolean;
    },
  ) => void;
  setReceiveToken: (token?: TokenItem) => void;
  setRiskChecked: Dispatch<SetStateAction<boolean>>;
  refresh: (updater: (value: number) => number) => void;
  handleSwap: (params?: { ignoreGasFee?: boolean }) => Promise<void>;
  saveFormSnapshot: () => void;
};

export type SwapFundedBroadcastSuccessPayload = {
  txHash: string;
  chainServerId: string;
  payToken?: TokenItem;
  receiveToken?: TokenItem;
  payAmount: string;
  provider?: string;
};

export function useSwapFundedRegression({
  sceneActive,
  chain,
  chainServerId,
  payAmount,
  payToken,
  receiveToken,
  quoteLoading,
  inSufficient,
  slippageChanged,
  activeProvider,
  quoteListLength,
  swapBtnDisabled,
  canShowDirectSubmit,
  shouldTwoStepSwap,
  showRiskConfirm,
  riskChecked,
  riskConfirmDisabled,
  handleAmountChange,
  switchChain,
  setReceiveToken,
  setRiskChecked,
  refresh,
  handleSwap,
  saveFormSnapshot,
}: UseSwapFundedRegressionParams) {
  const regressionScenario = useRegressionScenario<'SwapBridge'>();
  const swapFundedAmountAppliedRunIdRef = useRef('');
  const swapFundedSubmitStartedRunIdRef = useRef('');
  const pendingBroadcastSuccessRef = useRef<PendingBroadcastSuccess | null>(
    null,
  );
  const regressionBroadcastRequested =
    regressionScenario.active &&
    regressionScenario.scenario === 'swap-funded' &&
    isRegressionBroadcastRequested(regressionScenario.params);

  useEffect(() => {
    if (
      !sceneActive ||
      !regressionScenario.active ||
      regressionScenario.scenario !== 'swap-funded'
    ) {
      return;
    }

    const targetChain = readRegressionSwapChain(
      regressionScenario.params.chain,
    );
    const shouldBroadcast = isRegressionBroadcastRequested(
      regressionScenario.params,
    );
    const targetChainInfo = findChainByEnum(targetChain);
    const targetPayToken = getChainDefaultToken(targetChain);
    const targetReceiveToken = getDefaultSwapToTokenItem(targetChain);

    if (
      chain !== targetChain ||
      payToken?.chain !== targetChainInfo?.serverId ||
      !payToken?.id ||
      !isSameAddress(payToken.id, targetPayToken.id)
    ) {
      switchChain(targetChain, {
        payTokenId: targetPayToken.id,
        changeTo: false,
        markExplicitSelection: true,
      });
      return;
    }

    if (
      targetReceiveToken &&
      (!receiveToken ||
        receiveToken.chain !== targetReceiveToken.chain ||
        !isSameAddress(receiveToken.id, targetReceiveToken.id))
    ) {
      setReceiveToken(targetReceiveToken);
      return;
    }

    if (swapFundedSubmitStartedRunIdRef.current === regressionScenario.runId) {
      return;
    }

    const price = new BigNumber(payToken?.price || 0);
    if (!price.gt(0)) {
      return;
    }

    const targetUsd = readRegressionUsdParam(
      regressionScenario.params.targetUsd,
      DEFAULT_REGRESSION_TARGET_USD,
    );
    const maxTotalUsd = readRegressionUsdParam(
      regressionScenario.params.maxTotalUsd,
      DEFAULT_REGRESSION_MAX_TOTAL_USD,
    );
    const amount = targetUsd
      .div(price)
      .decimalPlaces(Math.min(payToken?.decimals || 18, 6), BigNumber.ROUND_UP);
    const actualUsd = amount.times(price);
    const balance = new BigNumber(payToken?.raw_amount_hex_str || 0, 16).div(
      new BigNumber(10).pow(payToken?.decimals || 18),
    );

    if (!amount.gt(0) || actualUsd.gt(maxTotalUsd) || !balance.gt(amount)) {
      if (regressionScenario.claimOnce('swap-funded-amount-invalid')) {
        regressionScenario.report('assertion', {
          assertion: 'swap-funded-amount-valid',
          passed: false,
          chain: targetChainInfo?.serverId,
          token: payToken?.symbol,
          targetUsd: targetUsd.toString(10),
          actualUsd: actualUsd.toString(10),
          balance: balance.toString(10),
        });
      }
      return;
    }

    if (!isSameAmountValue(payAmount, amount)) {
      const hasApplied =
        swapFundedAmountAppliedRunIdRef.current === regressionScenario.runId;
      const assertion = hasApplied
        ? 'swap-funded-amount-reapplied'
        : 'swap-funded-amount-applied';
      handleAmountChange(amount.toString(10));
      if (!hasApplied || regressionScenario.claimOnce(assertion)) {
        regressionScenario.report('assertion', {
          assertion,
          passed: true,
          mode: shouldBroadcast ? 'broadcast' : 'dry-run',
          chain: targetChainInfo?.serverId,
          payToken: payToken?.symbol,
          receiveToken: targetReceiveToken?.symbol,
          amount: amount.toString(10),
          targetUsd: targetUsd.toString(10),
          actualUsd: actualUsd.toString(10),
        });
      }
      swapFundedAmountAppliedRunIdRef.current = regressionScenario.runId;
      return;
    }

    if (regressionScenario.claimOnce('swap-funded-form-amount-ready')) {
      regressionScenario.report('assertion', {
        assertion: 'swap-funded-form-amount-ready',
        passed: true,
        mode: shouldBroadcast ? 'broadcast' : 'dry-run',
        chain: targetChainInfo?.serverId,
        payToken: payToken?.symbol,
        receiveToken: targetReceiveToken?.symbol,
        amount: payAmount,
        targetUsd: targetUsd.toString(10),
        actualUsd: actualUsd.toString(10),
      });
    }
  }, [
    chain,
    handleAmountChange,
    payAmount,
    payToken,
    receiveToken,
    regressionScenario,
    sceneActive,
    setReceiveToken,
    switchChain,
  ]);

  useEffect(() => {
    if (
      !sceneActive ||
      !regressionScenario.active ||
      regressionScenario.scenario !== 'swap-funded' ||
      regressionBroadcastRequested
    ) {
      return;
    }

    if (
      !payToken ||
      !receiveToken ||
      !new BigNumber(payAmount || 0).gt(0) ||
      quoteLoading ||
      inSufficient ||
      !activeProvider?.quote
    ) {
      return;
    }

    if (!regressionScenario.claimOnce('swap-funded-dry-run-ready')) {
      return;
    }

    regressionScenario.report('assertion', {
      assertion: 'swap-funded-dry-run-ready',
      passed: true,
      mode: 'dry-run',
      chain: chainServerId,
      payToken: payToken.symbol,
      payTokenId: payToken.id,
      receiveToken: receiveToken.symbol,
      receiveTokenId: receiveToken.id,
      amount: payAmount,
      provider: activeProvider.name,
      quoteCount: quoteListLength,
    });
  }, [
    activeProvider?.name,
    activeProvider?.quote,
    chainServerId,
    inSufficient,
    payAmount,
    payToken,
    quoteListLength,
    quoteLoading,
    receiveToken,
    regressionBroadcastRequested,
    regressionScenario,
    sceneActive,
  ]);

  useEffect(() => {
    if (
      !sceneActive ||
      !regressionBroadcastRequested ||
      !regressionScenario.active ||
      regressionScenario.scenario !== 'swap-funded'
    ) {
      return;
    }

    if (
      !payToken ||
      !receiveToken ||
      !new BigNumber(payAmount || 0).gt(0) ||
      quoteLoading ||
      inSufficient ||
      !activeProvider?.quote ||
      swapBtnDisabled
    ) {
      return;
    }

    if (!canShowDirectSubmit) {
      if (regressionScenario.claimOnce('swap-funded-direct-submit-required')) {
        regressionScenario.report('assertion', {
          assertion: 'swap-funded-direct-submit-required',
          passed: false,
          mode: 'broadcast',
          reason: 'direct-submit-unavailable',
          chain: chainServerId,
          payToken: payToken.symbol,
          receiveToken: receiveToken.symbol,
        });
      }
      return;
    }

    if (slippageChanged) {
      if (regressionScenario.claimOnce('swap-funded-refresh-slippage')) {
        regressionScenario.report('assertion', {
          assertion: 'swap-funded-refresh-slippage',
          passed: true,
          mode: 'broadcast',
          chain: chainServerId,
        });
      }
      refresh(e => e + 1);
      return;
    }

    if (activeProvider?.shouldTwoStepApprove || shouldTwoStepSwap) {
      if (regressionScenario.claimOnce('swap-funded-two-step-unsupported')) {
        regressionScenario.report('assertion', {
          assertion: 'swap-funded-two-step-unsupported',
          passed: false,
          mode: 'broadcast',
          chain: chainServerId,
          payToken: payToken.symbol,
          receiveToken: receiveToken.symbol,
          provider: activeProvider.name,
        });
      }
      return;
    }

    if (showRiskConfirm && !riskChecked) {
      if (regressionScenario.claimOnce('swap-funded-risk-confirm-accepted')) {
        regressionScenario.report('assertion', {
          assertion: 'swap-funded-risk-confirm-accepted',
          passed: true,
          mode: 'broadcast',
          chain: chainServerId,
        });
      }
      setRiskChecked(true);
      return;
    }

    if (riskConfirmDisabled) {
      return;
    }

    if (!regressionScenario.claimOnce('swap-funded-submit-started')) {
      return;
    }

    saveFormSnapshot();
    swapFundedSubmitStartedRunIdRef.current = regressionScenario.runId;
    pendingBroadcastSuccessRef.current = {
      claimOnce: regressionScenario.claimOnce,
      report: regressionScenario.report,
    };
    regressionScenario.report('assertion', {
      assertion: 'swap-funded-submit-started',
      passed: true,
      mode: 'broadcast',
      chain: chainServerId,
      payToken: payToken.symbol,
      payTokenId: payToken.id,
      receiveToken: receiveToken.symbol,
      receiveTokenId: receiveToken.id,
      amount: payAmount,
      provider: activeProvider.name,
      quoteCount: quoteListLength,
    });
    handleSwap({ ignoreGasFee: riskChecked || showRiskConfirm });
  }, [
    activeProvider,
    canShowDirectSubmit,
    chainServerId,
    handleSwap,
    inSufficient,
    payAmount,
    payToken,
    quoteListLength,
    quoteLoading,
    receiveToken,
    refresh,
    regressionBroadcastRequested,
    regressionScenario,
    riskChecked,
    riskConfirmDisabled,
    saveFormSnapshot,
    sceneActive,
    shouldTwoStepSwap,
    showRiskConfirm,
    slippageChanged,
    swapBtnDisabled,
    setRiskChecked,
  ]);

  const reportBroadcastSuccess = useMemoizedFn(
    ({
      txHash,
      chainServerId: chainId,
      payToken: fromToken,
      receiveToken: toToken,
      payAmount: amount,
      provider,
    }: SwapFundedBroadcastSuccessPayload) => {
      const pending = pendingBroadcastSuccessRef.current;
      pendingBroadcastSuccessRef.current = null;
      if (!pending) {
        return;
      }

      if (!pending.claimOnce('swap-funded-broadcast-success')) {
        return;
      }

      pending.report('assertion', {
        assertion: 'swap-funded-broadcast-success',
        passed: true,
        mode: 'broadcast',
        txHash: formatSafeHash(txHash),
        chain: chainId,
        payToken: fromToken?.symbol,
        payTokenId: fromToken?.id,
        receiveToken: toToken?.symbol,
        receiveTokenId: toToken?.id,
        amount,
        provider,
      });
    },
  );

  return { reportBroadcastSuccess };
}
