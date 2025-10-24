import type { Tx, GasLevel } from '@rabby-wallet/rabby-api/dist/types';

import { SignatureSteps } from './SignatureSteps';
import { findChain } from '@/utils/chain';
import BigNumber from 'bignumber.js';
import { CalcItem, GasSelectionOptions, SignerConfig } from '../domain/types';
import { explainGas } from '@/components/Approval/components/SignTx/calc';
import { buildFingerprint, SignerCtx } from '../domain/ctx';
import { Account } from '@/core/services/preference';

type PrepareParams = {
  txs: Tx[];
  config: SignerConfig;
  enableSecurityEngine?: boolean;
  gasSelection?: GasSelectionOptions;
};

type OpenParams = PrepareParams & {
  prepared?: SignerCtx | Promise<SignerCtx>;
};

type GasParams = {
  ctx: SignerCtx;
  gas: GasLevel;
  account: SignerConfig['account'];
};

type SendParams = {
  ctx: SignerCtx;
  config: SignerConfig;
  retry?: boolean;
  onProgress?: (ctx: SignerCtx) => void;
};

export const signatureService = {
  fingerprint: (txs: Tx[]) => buildFingerprint(txs),

  prepare: async ({
    txs,
    config,
    enableSecurityEngine,
    gasSelection,
  }: PrepareParams) =>
    SignatureSteps.prefetchCore({
      account: config.account,
      txs,
      enableSecurityEngine,
      gasSelection,
      config,
    }),

  openUI: async ({
    txs,
    config,
    enableSecurityEngine,
    gasSelection,
    prepared,
  }: OpenParams) =>
    SignatureSteps.openUICore({
      account: config.account,
      txs,
      enableSecurityEngine,
      gasSelection,
      existing: prepared,
      config,
    }),

  updateGas: async ({ ctx, gas, account }: GasParams) =>
    SignatureSteps.updateGasCore({
      ctx,
      gas,
      account,
    }),

  send: async ({ ctx, config, retry, onProgress }: SendParams) => {
    const chainMeta = findChain({ id: ctx.chainId });
    const chainServerId = (chainMeta as any)?.serverId || '';
    let currentCtx = ctx;
    return SignatureSteps.sendCore({
      chainServerId,
      ctx: currentCtx,
      config,
      retry,
      account: config.account,
      onSendedTx: ({ hash, idx }) => {
        if (!onProgress) return;
        const txsCalc = currentCtx.txsCalc.map((item, index) =>
          index === idx ? { ...item, hash } : item,
        );
        const total = txsCalc.length;
        const signed = idx === total - 1;

        currentCtx = {
          ...currentCtx,
          txsCalc,
          signInfo: {
            currentTxIndex: Math.min(idx + (signed ? 0 : 1), total),
            totalTxs: total,
            status: signed ? 'signed' : 'signing',
          },
        } as SignerCtx;
        onProgress(currentCtx);
      },
    });
  },
  gasCalcMethod: async ({
    txsCalc,
    price,
    currentAccount,
  }: {
    txsCalc: CalcItem[];
    price: string | number;
    currentAccount: Account;
  }) => {
    const res = await Promise.all(
      txsCalc.map(item =>
        explainGas({
          gasUsed: item.gasUsed,
          gasPrice: price,
          chainId: item.tx.chainId,
          nativeTokenPrice: item.preExecResult.native_token.price || 0,
          tx: item.tx,
          gasLimit: item.gasLimit,
          account: currentAccount!,
        }),
      ),
    );
    const totalCost = res.reduce(
      (sum, item) => {
        sum.gasCostAmount = sum.gasCostAmount.plus(item.gasCostAmount);
        sum.gasCostUsd = sum.gasCostUsd.plus(item.gasCostUsd);

        sum.maxGasCostAmount = sum.maxGasCostAmount.plus(item.maxGasCostAmount);
        return sum;
      },
      {
        gasCostUsd: new BigNumber(0),
        gasCostAmount: new BigNumber(0),
        maxGasCostAmount: new BigNumber(0),
      },
    );
    return totalCost;
  },
};
