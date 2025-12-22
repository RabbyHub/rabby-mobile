import { Tx } from '@rabby-wallet/rabby-api/dist/types';
import { useMemoizedFn } from 'ahooks';
import { useClearMiniApprovalTask } from './useMiniApprovalTask';
import { noop, uniqueId } from 'lodash';
import { sendTransaction } from '@/utils/sendTransaction';
import {
  notificationService,
  transactionHistoryService,
} from '@/core/services';
import { sleep } from '@/utils/async';
import { Account } from '@/core/services/preference';
import { ReactNode, useCallback } from 'react';
import { zCreate } from '@/core/utils/reexports';
import { UpdaterOrPartials, resolveValFromUpdater } from '@/core/utils/store';

export let DirectSubmitReject;

// Zustand implementation for miniApproval
type MiniApprovalState = {
  txs?: Tx[];
  visible?: boolean;
  onReject?: (e?: any) => void;
  onResolve?: (res: Awaited<ReturnType<typeof sendTransaction>>[]) => void;
  onVisibleChange?: (v: boolean) => void;
  ga?: Record<string, any>;
  id?: string;
  directSubmit?: boolean;
  account?: Account;
  showMaskLoading?: boolean;
  transparentMask?: boolean;
  checkGasFee?: boolean;
};

const miniApprovalStore = zCreate<MiniApprovalState>(() => ({
  txs: [],
}));

function setMiniApprovalState(valOrFunc: UpdaterOrPartials<MiniApprovalState>) {
  miniApprovalStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev, valOrFunc, {
      strict: false,
    });

    return newVal;
  });
}

const DEFAULT_MINI_SIGN_TX_EXTRA_CONFIG = {
  // autoTriggerPreExecError: false,
  showSimulateChange: false,
  title: null as ReactNode,
  disableSignBtn: false,
  onPreExecChange: noop,
  autoThrowPreExecError: true,
  // onRedirectToDeposit: noop,
};

// Zustand implementation for miniSignExtraProps
type MiniSignExtraPropsState = typeof DEFAULT_MINI_SIGN_TX_EXTRA_CONFIG;

const miniSignExtraPropsStore = zCreate<MiniSignExtraPropsState>(
  () => DEFAULT_MINI_SIGN_TX_EXTRA_CONFIG,
);

function setMiniSignExtraPropsState(
  valOrFunc: UpdaterOrPartials<MiniSignExtraPropsState>,
) {
  miniSignExtraPropsStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev, valOrFunc, {
      strict: false,
    });

    return newVal;
  });
}

export const useGetMiniSignTxExtraProps = () => miniSignExtraPropsStore();

// Hook to replace useAtom(miniApprovalAtom)
export const useMiniApprovalState = () => {
  const state = miniApprovalStore();
  return [state, setMiniApprovalState] as const;
};

// let globalCurrentApprovalId = uniqueId('mini-approval');
export const useMiniApproval = () => {
  const state = miniApprovalStore();
  const setMiniSignExtraProps = useCallback(
    (valOrFunc: UpdaterOrPartials<MiniSignExtraPropsState>) => {
      setMiniSignExtraPropsState(valOrFunc);
    },
    [],
  );
  const { clear } = useClearMiniApprovalTask();

  const _sendMiniTransactions = useMemoizedFn(
    async ({
      txs,
      ga,
      id,
      directSubmit,
      account,
    }: {
      txs: Tx[];
      ga?: Record<string, any>;
      id?: string;
      directSubmit?: boolean;
      account: Account;
    }) => {
      // const currentApprovalId = uniqueId('mini-approval');
      // await sleep(200);
      return new Promise<Awaited<ReturnType<typeof sendTransaction>>[]>(
        (resolve, reject) => {
          if (directSubmit) {
            DirectSubmitReject = directSubmit ? reject : undefined;
          }
          setMiniApprovalState(prev => {
            return {
              ...prev,
              id: id || prev.id,
              txs,
              ga,
              visible: directSubmit ? false : true,
              directSubmit: !!directSubmit,
              account,
              onReject: e => {
                setMiniApprovalState(prev => ({
                  ...prev,
                  txs: [],
                  visible: false,
                  showMaskLoading: true,
                  transparentMask: false,
                  checkGasFee: false,
                }));
                setMiniSignExtraPropsState(
                  () => DEFAULT_MINI_SIGN_TX_EXTRA_CONFIG,
                );
                const signingTxId =
                  notificationService.currentMiniApproval?.signingTxId;
                if (signingTxId) {
                  transactionHistoryService.removeSigningTx(signingTxId);
                  notificationService.currentMiniApproval = null;
                }
                reject(e);
              },
              onResolve: res => {
                setMiniApprovalState(prev => ({
                  ...prev,
                  txs: [],
                  visible: false,
                  showMaskLoading: true,
                  transparentMask: false,
                  checkGasFee: false,
                }));
                setMiniSignExtraPropsState(
                  () => DEFAULT_MINI_SIGN_TX_EXTRA_CONFIG,
                );
                notificationService.currentMiniApproval = null;
                resolve(res);
              },
            };
          });
        },
      );
    },
  );

  const sendMiniTransactions = useMemoizedFn(
    async ({
      txs,
      ga,
      directSubmit,
      account,
      waitTime = 600,
    }: {
      txs: Tx[];
      ga?: Record<string, any>;
      directSubmit?: boolean;
      account: Account;
      waitTime?: number;
    }) => {
      clear();
      /**
       * wait popup close
       */
      await sleep(waitTime);
      return _sendMiniTransactions({
        txs,
        ga,
        directSubmit,
        id: uniqueId('mini-approval'),
        account,
      });
    },
  );

  const resetMiniSignExtraProps = useCallback(() => {
    setMiniSignExtraPropsState(() => DEFAULT_MINI_SIGN_TX_EXTRA_CONFIG);
  }, []);

  const prepareMiniTransactions = useMemoizedFn(
    ({
      txs,
      ga,
      directSubmit,
      account,
      showMaskLoading,
      transparentMask,
      checkGasFee,
    }: {
      txs: Tx[];
      ga?: Record<string, any>;
      directSubmit?: boolean;
      account: Account;
      showMaskLoading?: boolean;
      transparentMask?: boolean;
      checkGasFee?: boolean;
    }) => {
      console.debug('prepareMiniTransactions trigger', ga, txs?.length);
      clear();
      resetMiniSignExtraProps();
      setMiniApprovalState(prev => {
        return {
          ...prev,
          id: uniqueId('mini-approval'),
          txs,
          ga,
          directSubmit,
          account,
          showMaskLoading: showMaskLoading ?? true,
          transparentMask: transparentMask ?? false,
          checkGasFee: checkGasFee ?? false,
        };
      });
    },
  );

  const sendPrepareMiniTransactions = useMemoizedFn(
    async (params?: { directSubmit?: boolean }) => {
      if (state.txs?.length && state.account) {
        return await _sendMiniTransactions({
          txs: state.txs,
          ga: state.ga,
          directSubmit: !!params?.directSubmit,
          account: state.account,
        });
      } else {
        throw new Error(
          'txs  or account is empty, please run prepareMiniTransactions first',
        );
      }
    },
  );

  return {
    sendMiniTransactions,
    prepareMiniTransactions,
    sendPrepareMiniTransactions,
    setMiniSignExtraProps,
    resetMiniSignExtraProps,
  };
};
