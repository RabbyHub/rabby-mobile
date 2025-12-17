import type { Tx } from '@rabby-wallet/rabby-api/dist/types';

import { useMemoizedFn } from 'ahooks';
import { useCallback, useEffect, useRef } from 'react';
import { omit } from 'lodash';
import {
  GasSelectionOptions,
  signatureStore,
  SignerConfig,
} from '@/components2024/MiniSignV2';
import { Account } from '@/core/services/preference';
import { normalizeTxParams } from '@/components/Approval/components/SignTx/util';
import {
  useMemoMiniSignGasStore,
  useMiniSignGasStoreOrigin,
} from './miniSignGasStore';

export type SimpleSignConfig = {
  txs?: Tx[];
  buildTxs?: () => Promise<Tx[] | undefined>;
  gasSelection?: GasSelectionOptions;
} & Omit<SignerConfig, 'account'>;

export const useMiniSigner = ({
  account,
  chainServerId,
  autoResetGasStoreOnChainChange,
}: {
  account: Account;
  chainServerId?: string;
  autoResetGasStoreOnChainChange?: boolean;
}) => {
  const {
    miniGasLevel,
    setMiniGasLevel,
    miniCustomPrice,
    setMiniCustomPrice,
    fixedCustomGas,
    setFixedCustomGas,
  } = useMiniSignGasStoreOrigin();

  const { reset: resetGasStore } = useMemoMiniSignGasStore();

  useEffect(() => {
    resetGasStore();
    return resetGasStore;
  }, [resetGasStore]);

  const previousChainServerIdRef = useRef(chainServerId);

  useEffect(() => {
    if (!autoResetGasStoreOnChainChange) return;
    if (previousChainServerIdRef.current === chainServerId) return;

    previousChainServerIdRef.current = chainServerId;

    if (miniGasLevel === 'custom') {
      resetGasStore();
    }
  }, [
    autoResetGasStoreOnChainChange,
    chainServerId,
    miniGasLevel,
    resetGasStore,
  ]);

  const updateMiniGasStore = useCallback(
    (params: {
      gasLevel: 'normal' | 'slow' | 'fast' | 'custom';
      chainId: number;
      customGasPrice?: number;
      fixed?: boolean;
    }) => {
      const isCustom = params.gasLevel === 'custom';
      setMiniGasLevel(params.gasLevel);

      setMiniCustomPrice(() =>
        isCustom
          ? {
              [params.chainId]: params.customGasPrice || 0,
            }
          : {},
      );

      const isFixedMode = isCustom && !!params.fixed;

      setFixedCustomGas(pre => {
        let data = { ...pre };
        delete data[params.chainId];

        if (isFixedMode) {
          data[params.chainId] = params.customGasPrice || 0;
        }

        return data;
      });
    },
    [setMiniGasLevel, setMiniCustomPrice, setFixedCustomGas],
  );

  const toSignerConfig = (cfg: SimpleSignConfig): SignerConfig => ({
    account,
    updateMiniGasStore,
    ...cfg,
  });

  const toPartialSignerConfig = (
    cfg: Partial<SimpleSignConfig>,
  ): Partial<SignerConfig> => {
    const partial: Partial<SignerConfig> = {
      ...omit(cfg, ['txs', 'buildTxs', 'gasSelection']),
    };
    return partial;
  };

  // useEffect(() => {
  //   signatureStore.close();
  //   return () => signatureStore.close();
  // }, []);

  const ensureTxs = useMemoizedFn(async (cfg: SimpleSignConfig) => {
    let txs: Tx[] | undefined = cfg.txs;
    if (!txs && cfg.buildTxs) txs = (await cfg.buildTxs()) || [];
    return txs || [];
  });

  const buildGasSelection = useMemoizedFn(
    (tx: Tx, incoming?: GasSelectionOptions): GasSelectionOptions => {
      if (incoming) return incoming;

      const { isSwap, isBridge, isSend, isSpeedUp, isCancel } =
        normalizeTxParams(tx);
      const chainId = tx.chainId;
      const currentMiniSignGasLevel =
        fixedCustomGas?.[chainId] !== undefined ? 'custom' : miniGasLevel;
      const currentMiniCustomGas =
        fixedCustomGas?.[chainId] ?? miniCustomPrice?.[chainId];

      return {
        flags: {
          isSwap,
          isBridge,
          isSend,
          isSpeedUp,
          isCancel,
        },
        lastSelection: {
          lastTimeSelect:
            currentMiniSignGasLevel === 'custom' ? 'gasPrice' : 'gasLevel',
          gasLevel: currentMiniSignGasLevel,
          gasPrice: currentMiniCustomGas,
        },
      };
    },
  );

  const prepareSignerPayload = useMemoizedFn(
    async (
      cfg: SimpleSignConfig,
    ): Promise<{
      txs: Tx[];
      signerConfig: SignerConfig;
      gasSelection: GasSelectionOptions;
    } | null> => {
      const txs = await ensureTxs(cfg);
      if (!txs.length) return null;
      const signerConfig = toSignerConfig(cfg);
      return {
        txs,
        signerConfig,
        gasSelection: buildGasSelection(txs[0], cfg.gasSelection),
      };
    },
  );

  const prefetch = useMemoizedFn(async (cfg: SimpleSignConfig) => {
    const payload = await prepareSignerPayload(cfg);
    if (!payload) {
      signatureStore.close();
      return;
    }

    await signatureStore.prefetch({
      txs: payload.txs,
      config: payload.signerConfig,
      enableSecurityEngine: cfg.enableSecurityEngine,
      gasSelection: payload.gasSelection,
    });
  });

  const openUI = useMemoizedFn(
    async (cfg: SimpleSignConfig): Promise<string[]> => {
      const payload = await prepareSignerPayload(cfg);
      if (!payload) {
        throw new Error('No transactions to sign');
      }

      return signatureStore.startUI({
        txs: payload.txs,
        config: payload.signerConfig,
        enableSecurityEngine: cfg.enableSecurityEngine,
        gasSelection: payload.gasSelection,
      });
    },
  );

  const openDirect = useMemoizedFn(
    async (cfg: SimpleSignConfig): Promise<string[]> => {
      const payload = await prepareSignerPayload(cfg);
      if (!payload) {
        throw new Error('No transactions to sign');
      }
      return signatureStore.openDirect({
        txs: payload.txs,
        config: payload.signerConfig,
        enableSecurityEngine: false,
        gasSelection: payload.gasSelection,
      });
    },
  );

  const updateConfig = useMemoizedFn((next: Partial<SimpleSignConfig>) => {
    const partial = toPartialSignerConfig(next);
    signatureStore.updateConfig(partial);
  });

  const close = useMemoizedFn(() => signatureStore.close());
  return {
    openDirect,
    openUI,
    prefetch,
    close,
    updateConfig,
    resetGasStore,
  } as const;
};
