import type { Tx } from '@rabby-wallet/rabby-api/dist/types';

import { useMemoizedFn } from 'ahooks';
import { useCallback, useEffect, useRef, useState } from 'react';
import { omit } from 'lodash';
import type {
  GasSelectionOptions,
  SignerConfig,
} from '@/components2024/MiniSignV2/domain/types';
import { SignatureManager } from '@/components2024/MiniSignV2/state/SignatureManager';
import { registry } from '@/components2024/MiniSignV2/state/SignatureManagerRegistry';
import { Account } from '@/core/services/preference';
import { normalizeTxParams } from '@/components/Approval/components/SignTx/util';
import {
  useMemoMiniSignGasStore,
  useMiniSignGasStoreOrigin,
} from './miniSignGasStore';

type GasLevelType = 'normal' | 'slow' | 'fast' | 'custom';

export type SimpleSignConfig = {
  txs?: Tx[];
  buildTxs?: () => Promise<Tx[] | undefined>;
  gasSelection?: GasSelectionOptions;
  isHideErrorUI?: boolean;
} & Omit<SignerConfig, 'account'>;

export const useMiniSigner = ({
  account,
  chainServerId,
  autoResetGasStoreOnChainChange,
  isolateGasStore,
}: {
  account: Account;
  chainServerId?: string;
  autoResetGasStoreOnChainChange?: boolean;
  /** When true, this signer uses its own isolated gas level/price state instead of global atoms */
  isolateGasStore?: boolean;
}) => {
  // Create instance and add to registry during render. Snapshot is updated
  // synchronously so getSnapshot() sees it immediately; listener notification
  // is deferred via microtask to avoid "setState during render" warnings.
  const instanceRef = useRef<SignatureManager | null>(null);
  if (!instanceRef.current) {
    instanceRef.current = new SignatureManager();
    registry.add(instanceRef.current);
  }
  const instance = instanceRef.current;

  useEffect(() => {
    return () => {
      registry.destroy(instance.instanceId);
    };
  }, [instance]);

  // Global gas store (default)
  const globalGas = useMiniSignGasStoreOrigin();
  const { reset: resetGlobalGas } = useMemoMiniSignGasStore();

  // Local gas store (only used when isolateGasStore=true)
  const [localGasLevel, setLocalGasLevel] = useState<GasLevelType>('normal');
  const [localCustomPrice, setLocalCustomPrice] = useState<
    Record<number, number>
  >({});

  // Unified gas state interface
  const miniGasLevel = isolateGasStore ? localGasLevel : globalGas.miniGasLevel;
  const miniCustomPrice = isolateGasStore
    ? localCustomPrice
    : globalGas.miniCustomPrice;
  const fixedCustomGas = globalGas.fixedCustomGas; // always global
  const setMiniGasLevel = isolateGasStore
    ? setLocalGasLevel
    : globalGas.setMiniGasLevel;
  const setMiniCustomPrice = isolateGasStore
    ? setLocalCustomPrice
    : globalGas.setMiniCustomPrice;
  const setFixedCustomGas = globalGas.setFixedCustomGas; // always global

  const resetGasStore = useCallback(() => {
    if (isolateGasStore) {
      setLocalGasLevel('normal');
      setLocalCustomPrice({});
    } else {
      resetGlobalGas();
    }
  }, [isolateGasStore, resetGlobalGas]);

  useEffect(() => {
    resetGasStore();
    return resetGasStore;
  }, [resetGasStore]);

  const previousChainServerIdRef = useRef(chainServerId);
  const signerScopeKey = `${account?.type || ''}:${account?.address || ''}:${
    chainServerId || ''
  }`;
  const previousSignerScopeKeyRef = useRef(signerScopeKey);

  useEffect(() => {
    if (previousSignerScopeKeyRef.current !== signerScopeKey) {
      previousSignerScopeKeyRef.current = signerScopeKey;
      instance.clearManualGasMethod();
    }

    if (!autoResetGasStoreOnChainChange) return;
    if (previousChainServerIdRef.current === chainServerId) return;

    previousChainServerIdRef.current = chainServerId;

    if (miniGasLevel === 'custom') {
      resetGasStore();
    }
  }, [
    autoResetGasStoreOnChainChange,
    chainServerId,
    instance,
    miniGasLevel,
    resetGasStore,
    signerScopeKey,
  ]);

  const updateMiniGasStore = useCallback(
    (params: {
      gasLevel: GasLevelType;
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
      instance.close({ preserveManualGasMethod: true });
      return;
    }

    await instance.prefetch({
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

      return instance.startUI({
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
      return instance.openDirect(
        {
          txs: payload.txs,
          config: payload.signerConfig,
          enableSecurityEngine: false,
          gasSelection: payload.gasSelection,
        },
        { isHideErrorUI: cfg.isHideErrorUI },
      );
    },
  );

  const updateConfig = useMemoizedFn((next: Partial<SimpleSignConfig>) => {
    const partial = toPartialSignerConfig(next);
    instance.updateConfig(partial);
  });

  const close = useMemoizedFn(
    (options?: Parameters<SignatureManager['close']>[0]) =>
      instance.close(options),
  );
  return {
    openDirect,
    openUI,
    prefetch,
    close,
    updateConfig,
    resetGasStore,
    /** The owned SignatureManager instance — pass to SignatureInstanceProvider */
    instance,
  } as const;
};
