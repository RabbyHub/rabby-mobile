import type { GasLevel, TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import type { Tx } from '@rabby-wallet/rabby-api/dist/types';
import BigNumber from 'bignumber.js';

import type {
  SignatureAction,
  SignatureFlowState,
  SignatureRequest,
} from './types';

import { signatureReducer } from './machine';
import { findChain } from '@/utils/chain';
import { SignerCtx } from '../domain/ctx';
import { signatureService } from '../services/SignatureService';
import { SignerConfig } from '../domain/types';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import { CHAINS_ENUM } from '@/constant/chains';
import { t } from 'i18next';

import { apiLedger, apiOneKey } from '@/core/apis';
import {
  callConnectLedgerModal,
  setLedgerStatus,
} from '@/hooks/ledger/useLedgerStatus';
import {
  callConnectOneKeyModal,
  setOneKeyStatus,
} from '@/hooks/onekey/useOneKeyStatus';
import { transactionHistoryService } from '@/core/services';
import { getMiniSignGasPanelController } from './MiniSignGasPanelController';

const ETH_GAS_USD_LIMIT = 15;
const OTHER_GAS_USD_LIMIT = 5;

export const MINI_SIGN_ERROR = {
  GAS_FEE_TOO_HIGH: 'selectedGasCost too high',
  PREFETCH_FAILURE: 'prepare failure',
  USER_CANCELLED: 'User cancelled',
  CANT_PROCESS: 'Can not process',
  GAS_NOT_ENOUGH: 'Gas not enough',
};

type Subscriber = (state: SignatureFlowState) => void;

type RunContext = {
  id: number;
  fingerprint: string;
};

const defaultError = {
  status: 'FAILED',
  content: t('page.signFooterBar.qrcode.txFailed'),
  description: MINI_SIGN_ERROR.PREFETCH_FAILURE,
} as SignatureFlowState['error'];

const createErrorMessage = (err: unknown) =>
  err instanceof Error ? err.message : String(err ?? 'Unknown error');

let nextInstanceId = 0;

export class SignatureManager {
  public readonly instanceId: string;
  private signingTxIds = new Set<string>();
  private state: SignatureFlowState = {
    status: 'idle',
  };
  private subscribers = [] as Subscriber[];
  private run: RunContext | null = null;
  private seq = 0;
  private pendingCtx = new Map<string, Promise<SignerCtx>>();
  private notifyScheduled = false;
  private manualGasMethod?: SignerCtx['gasMethod'];
  private manualGasFingerprint?: string;

  private pendingResult: {
    resolve: (hashes: string[]) => void;
    reject: (reason: any) => void;
  } | null = null;

  constructor(instanceId?: string) {
    this.instanceId = instanceId ?? `sig-${++nextInstanceId}`;
  }

  private dispatch(action: SignatureAction) {
    const next = signatureReducer(this.state, action);
    if (next === this.state) return;
    this.applyRuntimeState(next);
    this.state = next;
    this.notify();
  }

  private notify() {
    if (this.notifyScheduled) return;
    this.notifyScheduled = true;
    Promise.resolve().then(() => {
      this.notifyScheduled = false;
      const snapshot = this.state;
      for (const fn of this.subscribers) {
        fn(snapshot);
      }
    });
  }

  private applyRuntimeState(nextState: SignatureFlowState) {
    const ctx = nextState.ctx;
    if (!ctx?.txs?.length) return;
    ctx.disabledProcess = !this.canProcess(nextState);
    ctx.gasFeeTooHigh = this.isGasFeeTooHighFor(ctx, nextState.config);
  }

  private getFingerprint(txs: Tx[]) {
    return signatureService.fingerprint(txs);
  }

  private getGasUsdLimit(chainId?: number) {
    const chainInfo = findChain({ id: chainId });
    return chainInfo?.enum === CHAINS_ENUM.ETH
      ? ETH_GAS_USD_LIMIT
      : OTHER_GAS_USD_LIMIT;
  }

  private isGasFeeTooHighFor(
    ctx?: SignerCtx | null,
    config?: SignerConfig | null,
  ) {
    if (!ctx || !config?.checkGasFeeTooHigh || config.ignoreGasFeeTooHigh) {
      return false;
    }
    const limit = this.getGasUsdLimit(ctx.chainId);
    const gasCost = ctx.selectedGasCost?.gasCostUsd;
    return !!gasCost?.gt(limit);
  }

  private isPreExecResultFailed() {
    return this?.state.ctx?.txsCalc.some(
      r => !r?.preExecResult?.pre_exec?.success,
    );
  }

  private clearRunState() {
    this.run = null;
    this.pendingCtx.clear();
  }

  private getManualGasMethod(fingerprint?: string) {
    return fingerprint && this.manualGasFingerprint === fingerprint
      ? this.manualGasMethod
      : undefined;
  }

  private withManualGasMethod(ctx: SignerCtx, fingerprint = ctx.fingerprint) {
    const manualGasMethod = this.getManualGasMethod(fingerprint);
    return manualGasMethod
      ? ({
          ...ctx,
          gasMethod: manualGasMethod,
          manualGasMethod,
          useGasless: manualGasMethod === 'gasAccount' ? false : ctx.useGasless,
        } as SignerCtx)
      : ctx;
  }

  private bindManualGasMethodToFingerprint(fingerprint: string) {
    if (this.manualGasMethod) {
      this.manualGasFingerprint = fingerprint;
    }
  }

  private markRun(fingerprint: string, currentPendingId?: number) {
    if (currentPendingId && this.run?.fingerprint === fingerprint) {
      return currentPendingId;
    }
    const id = ++this.seq;
    this.run = { id, fingerprint };
    return id;
  }

  private isActive(id: number, fingerprint: string) {
    return (
      !!this.run && this.run.id === id && this.run.fingerprint === fingerprint
    );
  }

  private ensureContext(request: SignatureRequest, opId?: number) {
    const fingerprint = this.getFingerprint(request.txs);
    this.bindManualGasMethodToFingerprint(fingerprint);

    this.dispatch({ type: 'SET_CONFIG', payload: request.config });

    if (
      this.state.fingerprint === fingerprint &&
      this.state.ctx &&
      this.state.status !== 'error'
    ) {
      return Promise.resolve(
        this.withManualGasMethod(this.state.ctx, fingerprint),
      );
    }

    const cached = this.pendingCtx.get(fingerprint);
    if (cached) return cached;
    const currentOpId = this.markRun(fingerprint, opId);
    const skeleton = this.withManualGasMethod(
      this.createSkeletonCtx(request.txs, fingerprint),
      fingerprint,
    );

    this.dispatch({
      type: 'PREFETCH_START',
      fingerprint,
      config: request.config,
      ctx: skeleton,
    });

    const promise = signatureService
      .prepare({
        txs: request.txs,
        config: request.config,
        enableSecurityEngine: request.enableSecurityEngine,
        gasSelection: request.gasSelection,
      })
      .then(ctx => {
        const nextCtx = this.withManualGasMethod(ctx, fingerprint);
        if (this.isActive(currentOpId, fingerprint)) {
          this.dispatch({
            type: 'PREFETCH_SUCCESS',
            fingerprint,
            ctx: nextCtx,
          });
        }
        return nextCtx;
      })
      .catch(error => {
        console.error('PREFETCH_FAILURE error', error);
        if (this.isActive(currentOpId, fingerprint)) {
          this.dispatch({
            type: 'PREFETCH_FAILURE',
            fingerprint,
            error: defaultError,
          });
        }
        throw MINI_SIGN_ERROR.PREFETCH_FAILURE;
      })
      .finally(() => {
        const current = this.pendingCtx.get(fingerprint);
        if (current === promise) {
          this.pendingCtx.delete(fingerprint);
        }
      });

    this.pendingCtx.set(fingerprint, promise);
    return promise;
  }

  private createSkeletonCtx(txs: Tx[], fingerprint: string): SignerCtx {
    const chainId = txs[0]?.chainId || 0;
    return {
      fingerprint,
      open: true,
      mode: 'ui',
      txs,
      chainId,
      is1559: false,
      gasList: [],
      selectedGas: null,
      txsCalc: [],
      nativeTokenPrice: 0,
      nativeTokenBalance: '0x0',
      checkErrors: [],
      gasless: undefined,
      gasAccount: undefined,
      engineResults: undefined,
      gasMethod: 'native',
      useGasless: false,
      noCustomRPC: undefined,
      supportedAddrType: undefined,
      error: undefined,
      isGasNotEnough: false,
      signInfo: undefined,
    };
  }

  private canProcess(state: SignatureFlowState = this.state) {
    const { ctx, config } = state;
    const gasMethod = ctx?.gasMethod;
    const gasAccountCanPay =
      ctx?.gasMethod === 'gasAccount' &&
      // isSupportedAddr &&
      ctx?.noCustomRPC &&
      !!ctx?.gasAccount?.balance_is_enough &&
      !ctx?.gasAccount.chain_not_support &&
      !!ctx?.gasAccount.is_gas_account &&
      !(ctx?.gasAccount as any).err_msg;

    const canUseGasLess = !!ctx?.gasless?.is_gasless;
    let gasLessConfig =
      canUseGasLess && ctx?.gasless?.promotion
        ? ctx?.gasless?.promotion?.config
        : undefined;
    if (
      gasLessConfig &&
      ctx?.gasless?.promotion?.id === '0ca5aaa5f0c9217e6f45fe1d109c24fb'
    ) {
      gasLessConfig = { ...gasLessConfig, dark_color: '', theme_color: '' };
    }

    const useGasLess =
      (ctx?.isGasNotEnough || !!gasLessConfig) &&
      !!canUseGasLess &&
      !!ctx?.useGasless;
    const loading = !ctx?.txsCalc?.length;
    // status === 'prefetching' || status === 'signing' || !ctx?.txsCalc?.length;

    const disabledProcess = ctx?.txsCalc?.length
      ? gasMethod === 'gasAccount'
        ? !gasAccountCanPay
        : useGasLess
        ? false
        : !!loading ||
          !ctx?.txsCalc?.length ||
          !!ctx.checkErrors?.some(e => e.level === 'forbidden')
      : false;

    const autoUseGasFreeMethod =
      !loading &&
      disabledProcess &&
      config?.autoUseGasFree &&
      (ctx?.isGasNotEnough || !!gasLessConfig) &&
      !!canUseGasLess;

    if (autoUseGasFreeMethod && state.ctx) {
      if (state.ctx.gasMethod === 'gasAccount') {
        state.ctx.gasMethod = 'native';
      }
      state.ctx.useGasless = true;
      return true;
    }

    return !disabledProcess;
  }

  public getState = () => {
    return this.state;
  };

  public subscribe = (fn: Subscriber) => {
    this.subscribers.push(fn);
    return () => {
      this.subscribers = this.subscribers.filter(e => e !== fn);
    };
  };

  public prefetch(request: SignatureRequest) {
    const fingerprint = this.getFingerprint(request.txs);

    this.close({ preserveManualGasMethod: true });
    this.bindManualGasMethodToFingerprint(fingerprint);

    return this.ensureContext(request);
  }

  public async openUI(request: SignatureRequest) {
    const fingerprint = this.getFingerprint(request.txs);
    this.bindManualGasMethodToFingerprint(fingerprint);
    const opId = this.markRun(fingerprint);
    this.dispatch({ type: 'SET_CONFIG', payload: request.config });

    const prepared =
      this.pendingCtx.get(fingerprint) || this.ensureContext(request, opId);

    const skeleton = this.withManualGasMethod(
      this.createSkeletonCtx(request.txs, fingerprint),
      fingerprint,
    );
    this.dispatch({ type: 'OPEN_UI_SKELETON', fingerprint, ctx: skeleton });

    try {
      const ctx = await signatureService.openUI({
        txs: request.txs,
        config: request.config,
        enableSecurityEngine: request.enableSecurityEngine,
        gasSelection: request.gasSelection,
        prepared,
      });
      if (!this.isActive(opId, fingerprint)) return ctx;
      const nextCtx = this.withManualGasMethod(ctx, fingerprint);
      this.dispatch({ type: 'OPEN_UI_SUCCESS', fingerprint, ctx: nextCtx });
      return nextCtx;
    } catch (error) {
      if (!this.isActive(opId, fingerprint)) return;
      const message = createErrorMessage(error);
      this.dispatch({
        type: 'OPEN_UI_FAILURE',
        fingerprint,
        error: defaultError,
      });
      throw error instanceof Error ? error : new Error(message);
    }
  }

  public async updateGas(gas: GasLevel) {
    const { ctx, config, fingerprint } = this.state;
    if (!ctx || !config || !fingerprint) return;
    const opId = this.markRun(fingerprint);
    try {
      const nextCtxPromise = signatureService
        .updateGas({
          ctx,
          gas,
          account: config.account,
        })
        .catch(error => {
          if (this.isActive(opId, fingerprint)) {
            const message = createErrorMessage(error);
            this.dispatch({
              type: 'OPEN_UI_FAILURE',
              fingerprint,
              error: defaultError,
            });
          }
          throw error;
        });

      this.dispatch({
        type: 'UPDATE_CTX',
        fingerprint,
        ctx: {
          ...ctx,
          selectedGas: gas,
        } as SignerCtx,
      });

      config?.updateMiniGasStore?.({
        gasLevel: gas.level as any,
        chainId: ctx.chainId,
        customGasPrice:
          gas.level === 'custom' ? Math.round(gas.price) : undefined,
        fixed: !!(gas as any)?.fixedMode,
      });

      const nextCtx = await nextCtxPromise;
      if (!this.isActive(opId, fingerprint)) return;
      const latestCtx =
        this.state.fingerprint === fingerprint ? this.state.ctx : undefined;
      const manualGasMethod = this.getManualGasMethod(fingerprint);
      this.dispatch({
        type: 'UPDATE_CTX',
        fingerprint,
        ctx: {
          ...nextCtx,
          gasMethod:
            manualGasMethod ?? latestCtx?.gasMethod ?? nextCtx.gasMethod,
          manualGasMethod: manualGasMethod ?? latestCtx?.manualGasMethod,
          useGasless: latestCtx?.useGasless ?? nextCtx.useGasless,
        } as SignerCtx,
      });
    } catch (error) {
      if (!this.isActive(opId, fingerprint)) return;
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  public async updateGasLevel(gas: GasLevel) {
    return this.updateGas(gas);
  }

  public replaceTxs(nextTxs: Tx[]) {
    const { ctx, fingerprint } = this.state;
    if (!ctx || !fingerprint) return;

    const nextCalc = ctx.txsCalc.map((item, index) => {
      const nextTx = nextTxs[index];
      if (!nextTx) {
        return item;
      }

      return {
        ...item,
        tx: {
          ...item.tx,
          nonce: nextTx.nonce ?? item.tx.nonce,
        },
      };
    });

    this.dispatch({
      type: 'UPDATE_CTX',
      fingerprint,
      ctx: {
        ...ctx,
        txs: nextTxs,
        txsCalc: nextCalc,
      } as SignerCtx,
    });
  }

  public async send(
    options?: boolean | { retry?: boolean; isHideErrorUI?: boolean },
  ) {
    const retry = typeof options === 'boolean' ? options : options?.retry;
    const isHideErrorUI =
      typeof options === 'boolean' ? undefined : options?.isHideErrorUI;
    const { ctx, config, fingerprint } = this.state;
    if (!ctx || !config || !fingerprint) {
      throw new Error('Signature is not ready');
    }
    if (!this.canProcess()) {
      if (ctx.isGasNotEnough) {
        this.rejectPending(MINI_SIGN_ERROR.GAS_NOT_ENOUGH);
        throw MINI_SIGN_ERROR.GAS_NOT_ENOUGH;
      } else {
        this.rejectPending(MINI_SIGN_ERROR.CANT_PROCESS);
        throw MINI_SIGN_ERROR.CANT_PROCESS;
      }
    }
    const opId = this.markRun(fingerprint);
    this.dispatch({ type: 'SEND_START', fingerprint });
    try {
      const latestCtx =
        this.state.fingerprint === fingerprint && this.state.ctx
          ? this.state.ctx
          : ctx;
      const sendCtx = this.withManualGasMethod(latestCtx, fingerprint);
      const res = await signatureService.send({
        ctx: sendCtx,
        config,
        retry,
        onSigningTxCreated: signingTxId => {
          if (!this.isActive(opId, fingerprint)) {
            transactionHistoryService.removeSigningTx(signingTxId);
            return;
          }
          this.signingTxIds.add(signingTxId);
        },
        onProgress: nextCtx => {
          if (!this.isActive(opId, fingerprint)) return;
          this.dispatch({ type: 'SEND_PROGRESS', fingerprint, ctx: nextCtx });
        },
      });
      if (!this.isActive(opId, fingerprint)) return [];
      if (Array.isArray(res)) {
        const hashes = res.map(item => item.txHash);
        this.dispatch({ type: 'SEND_SUCCESS', fingerprint, hashes });
        this.resolvePending(hashes);
        return hashes;
      }
      if (res.error) {
        if (isHideErrorUI) {
          this.rejectPending(res.error.description);
          return res;
        }

        this.dispatch({
          type: 'SEND_FAILURE',
          fingerprint,
          error: res.error,
        });
        return res;
      }

      const hashes = Array.isArray(res) ? res.map(item => item.txHash) : [];
      this.dispatch({ type: 'SEND_SUCCESS', fingerprint, hashes });
      this.resolvePending(hashes);
      return hashes;
    } catch (error) {
      if (!this.isActive(opId, fingerprint)) return [];
      const message = createErrorMessage(error);
      this.dispatch({ type: 'SEND_FAILURE', fingerprint, error: defaultError });
      this.rejectPending(message);
      throw error instanceof Error ? error : new Error(message);
    }
  }

  private removeSigningTx() {
    if (!this.signingTxIds.size) {
      return;
    }
    for (const signingTxId of this.signingTxIds) {
      transactionHistoryService.removeSigningTx(signingTxId);
    }
    this.signingTxIds.clear();
  }

  public reset(options?: { preserveManualGasMethod?: boolean }) {
    if (!options?.preserveManualGasMethod) {
      this.manualGasMethod = undefined;
      this.manualGasFingerprint = undefined;
    }
    this.clearRunState();
    this.seq++;
    getMiniSignGasPanelController(this).reset();
    if (this.pendingResult) {
      this.pendingResult.reject(MINI_SIGN_ERROR.USER_CANCELLED);
      this.pendingResult = null;
    }
    this.removeSigningTx();
    this.dispatch({ type: 'RESET' });
  }

  public updateConfig(config: Partial<SignerConfig>) {
    this.dispatch({ type: 'SET_CONFIG', payload: config });
  }

  public close(options?: { preserveManualGasMethod?: boolean }) {
    this.reset(options);
  }

  public clearManualGasMethod() {
    this.manualGasMethod = undefined;
    this.manualGasFingerprint = undefined;
  }

  private async checkHardWareConnected(cb: () => void) {
    const { config } = this.state;
    const { account } = config || {};
    if (!account) {
      this.pendingResult?.reject(MINI_SIGN_ERROR.PREFETCH_FAILURE);
      return;
    }
    if (account.type === KEYRING_CLASS.HARDWARE.LEDGER) {
      try {
        const [isConnected, id] = await apiLedger.isConnected(
          account.address,
          // true,
        );
        setLedgerStatus(isConnected);
        if (isConnected) {
          cb();
        } else {
          callConnectLedgerModal({
            cb,
            deviceId: id,
            reject: () => {
              this.pendingResult?.reject?.(MINI_SIGN_ERROR.USER_CANCELLED);
            },
            address: account.address,
          });
        }

        return;
      } catch (error) {}
    }

    if (account.type === KEYRING_CLASS.HARDWARE.ONEKEY) {
      try {
        const [isConnected, id] = await apiOneKey.isConnected(account.address);
        setOneKeyStatus(isConnected);
        if (isConnected) {
          cb();
        } else {
          callConnectOneKeyModal({
            cb,
            deviceId: id,
            reject: () => {
              this.pendingResult?.reject?.(MINI_SIGN_ERROR.USER_CANCELLED);
            },
            address: account.address,
          });
        }
        return;
      } catch (error) {}
    }
    cb();
    return;
  }

  public async openDirect(
    request: SignatureRequest,
    opts?: { isHideErrorUI?: boolean },
  ) {
    const fingerprint = this.getFingerprint(request.txs);
    this.bindManualGasMethodToFingerprint(fingerprint);
    const resultPromise = this.createResultPromise();
    if (this.state.status === 'prefetch_failure') {
      this.rejectPending(MINI_SIGN_ERROR.PREFETCH_FAILURE);
      return resultPromise;
    }

    this.dispatch({ type: 'SET_CONFIG', payload: request.config });
    this.dispatch({
      type: 'UPDATE_CTX',
      fingerprint,
      ctx: this.withManualGasMethod(
        { ...this.state.ctx, mode: 'direct' } as SignerCtx,
        fingerprint,
      ),
    });

    try {
      const prepared =
        this.pendingCtx.get(fingerprint) ||
        this.ensureContext(request, this.run?.id);
      await prepared;

      if (this.isPreExecResultFailed()) {
        this.rejectPending(MINI_SIGN_ERROR.PREFETCH_FAILURE);
        return resultPromise;
      }

      if (this.isGasFeeTooHighFor(this.state.ctx, this.state.config)) {
        this.rejectPending(MINI_SIGN_ERROR.GAS_FEE_TOO_HIGH);
        return resultPromise;
      }
      if (this.state.fingerprint !== fingerprint || !this.state.ctx) {
        throw new Error('Failed to prepare transactions');
      }
      this.dispatch({
        type: 'UPDATE_CTX',
        fingerprint,
        ctx: this.withManualGasMethod(
          { ...this.state.ctx, mode: 'direct' } as SignerCtx,
          fingerprint,
        ),
      });

      await this.checkHardWareConnected(() =>
        this.send({ isHideErrorUI: opts?.isHideErrorUI }).catch(
          () => undefined,
        ),
      );
    } catch (error) {
      const message = createErrorMessage(error);
      this.rejectPending(message);
      throw error instanceof Error ? error : new Error(message);
    }
    return resultPromise;
  }

  public toggleGasless(value?: boolean) {
    const { ctx, fingerprint } = this.state;
    if (!ctx || !fingerprint) return;
    const useGasless = typeof value === 'boolean' ? value : !ctx.useGasless;
    this.dispatch({
      type: 'UPDATE_CTX',
      fingerprint,
      ctx: { ...ctx, useGasless } as SignerCtx,
    });
  }

  public setGasMethod(
    method: 'native' | 'gasAccount',
    options?: { manual?: boolean },
  ) {
    const { ctx, fingerprint } = this.state;
    if (!ctx || !fingerprint) return;
    if (options?.manual) {
      this.manualGasMethod = method;
      this.manualGasFingerprint = fingerprint;
    }
    const nextGasMethod = this.getManualGasMethod(fingerprint) ?? method;
    this.dispatch({
      type: 'UPDATE_CTX',
      fingerprint,
      ctx: {
        ...ctx,
        gasMethod: nextGasMethod,
        manualGasMethod:
          this.manualGasFingerprint === fingerprint
            ? this.manualGasMethod
            : ctx.manualGasMethod,
        useGasless: nextGasMethod === 'gasAccount' ? false : ctx.useGasless,
      } as SignerCtx,
    });
  }

  public setTempoFeeToken(
    token: TokenItem,
    options?: {
      applyFeeToken?: boolean;
      tempoPreferredFeeTokenId?: string;
    },
  ) {
    const { ctx, fingerprint } = this.state;
    if (!ctx || !fingerprint) {
      return;
    }
    const shouldApplyFeeToken =
      ctx.gasMethod !== 'gasAccount' && options?.applyFeeToken !== false;
    const tokenId = token.id;

    const txs = ctx.txs.map(tx => {
      const next = { ...tx } as Tx & { feeToken?: string };
      if (shouldApplyFeeToken) {
        next.feeToken = tokenId;
      }
      return next as Tx;
    });

    const txsCalc = ctx.txsCalc.map(item => {
      const nextTx = { ...item.tx } as Tx & { feeToken?: string };
      if (shouldApplyFeeToken) {
        nextTx.feeToken = tokenId;
      }
      return {
        ...item,
        tx: nextTx as Tx,
      };
    });

    this.dispatch({
      type: 'UPDATE_CTX',
      fingerprint,
      ctx: {
        ...ctx,
        txs,
        txsCalc,
        gasToken: {
          tokenId,
          symbol: token.display_symbol || token.symbol,
          decimals: token.decimals || 18,
          logoUrl: token.logo_url,
        },
        nativeTokenBalance: new BigNumber(
          token.raw_amount_hex_str || 0,
          16,
        ).toFixed(0),
        tempoPreferredFeeTokenId:
          options?.tempoPreferredFeeTokenId ||
          (shouldApplyFeeToken ? tokenId : ctx.tempoPreferredFeeTokenId),
      } as SignerCtx,
    });
  }

  public async retry() {
    return this.send(true);
  }

  public async startUI(request: SignatureRequest): Promise<string[]> {
    const resultPromise = this.createResultPromise();

    this.openUI(request).catch(error => {
      const message = createErrorMessage(error);
      this.rejectPending(message);
    });

    return resultPromise;
  }

  private createResultPromise() {
    if (this.pendingResult) {
      this.pendingResult.reject('Another signing operation is in progress');
      this.pendingResult = null;
    }
    return new Promise<string[]>((resolve, reject) => {
      this.pendingResult = { resolve, reject };
    });
  }

  private resolvePending(hashes: string[]) {
    if (this.pendingResult) {
      this.pendingResult.resolve(hashes);
      this.pendingResult = null;
    }
    this.clearRunState();
    this.removeSigningTx();
    this.dispatch({ type: 'RESET' });
  }

  private rejectPending(message: string) {
    if (this.pendingResult) {
      this.pendingResult.reject(message);
      this.pendingResult = null;
    }
    this.clearRunState();
    this.removeSigningTx();
  }
}

export const signatureManager = new SignatureManager();

// Note: useSignatureStore is now defined in useSignatureStore.ts to avoid circular deps
// Re-exported from state/index.ts for backward compatibility
