import type { Tx } from '@rabby-wallet/rabby-api/dist/types';

import { useMemoizedFn } from 'ahooks';
import { useCallback, useEffect, useState } from 'react';
import { omit } from 'lodash';
import {
  GasSelectionOptions,
  signatureStore,
  SignerConfig,
} from '@/components2024/MiniSignV2';
import { Account } from '@/core/services/preference';
import { normalizeTxParams } from '@/components/Approval/components/SignTx/util';
import {
  useClearMiniGasStateEffect,
  useMemoMiniSignGasStore,
  useMiniSignGasStore,
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

  const [previousChainServerId, setPreviousChainServerId] =
    useState(chainServerId);

  if (
    previousChainServerId !== chainServerId &&
    autoResetGasStoreOnChainChange
  ) {
    setPreviousChainServerId(chainServerId);
    if (miniGasLevel === 'custom') {
      resetGasStore();
    }
  }

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
      console.log('isFixedMode updateMiniGas', isFixedMode);

      setFixedCustomGas(pre => {
        let data = { ...pre };
        delete data[params.chainId];

        if (isFixedMode) {
          data[params.chainId] = params.customGasPrice || 0;
        }

        console.log('setFixedCustomGas data', params.chainId, data);

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

  useEffect(() => {
    signatureStore.close();
    return () => signatureStore.close();
  }, []);

  const ensureTxs = useMemoizedFn(async (cfg: SimpleSignConfig) => {
    let txs: Tx[] | undefined = cfg.txs;
    if (!txs && cfg.buildTxs) txs = (await cfg.buildTxs()) || [];
    return txs || [];
  });

  const prefetch = useMemoizedFn(async (cfg: SimpleSignConfig) => {
    const txs = await ensureTxs(cfg);
    if (!txs.length) {
      signatureStore.close();
      return;
    }

    const { isSwap, isBridge, isSend, isSpeedUp, isCancel } = normalizeTxParams(
      txs[0],
    );

    const signerCfg = toSignerConfig(cfg);

    const chainId = txs[0].chainId;
    const currentMiniSignGasLevel =
      fixedCustomGas?.[chainId] !== undefined ? 'custom' : miniGasLevel;
    const currentMiniCustomGas =
      fixedCustomGas?.[chainId] ?? miniCustomPrice?.[chainId];

    await signatureStore.prefetch({
      txs,
      config: signerCfg,
      enableSecurityEngine: cfg.enableSecurityEngine,
      gasSelection: cfg.gasSelection || {
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
      },
    });
  });

  const openUI = useMemoizedFn(
    async (cfg: SimpleSignConfig): Promise<string[]> => {
      const txs = await ensureTxs(cfg);
      if (!txs.length) {
        throw new Error('No transactions to sign');
      }
      const signerCfg = toSignerConfig(cfg);
      const { isSwap, isBridge, isSend, isSpeedUp, isCancel } =
        normalizeTxParams(txs[0]);

      const chainId = txs[0].chainId;
      const currentMiniSignGasLevel =
        fixedCustomGas?.[chainId] !== undefined ? 'custom' : miniGasLevel;
      const currentMiniCustomGas =
        fixedCustomGas?.[chainId] ?? miniCustomPrice?.[chainId];

      return signatureStore.startUI({
        txs,
        config: signerCfg,
        enableSecurityEngine: cfg.enableSecurityEngine,
        gasSelection: cfg.gasSelection || {
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
        },
      });
    },
  );

  const openDirect = useMemoizedFn(
    async (cfg: SimpleSignConfig): Promise<string[]> => {
      const txs = await ensureTxs(cfg);
      if (!txs.length) {
        throw new Error('No transactions to sign');
      }
      const { isSwap, isBridge, isSend, isSpeedUp, isCancel } =
        normalizeTxParams(txs[0]);
      const signerCfg = toSignerConfig(cfg);
      const chainId = txs[0].chainId;
      const currentMiniSignGasLevel =
        fixedCustomGas?.[chainId] !== undefined ? 'custom' : miniGasLevel;
      const currentMiniCustomGas =
        fixedCustomGas?.[chainId] ?? miniCustomPrice?.[chainId];
      return signatureStore.openDirect({
        txs,
        config: signerCfg,
        enableSecurityEngine: false,
        gasSelection: cfg.gasSelection || {
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
        },
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
