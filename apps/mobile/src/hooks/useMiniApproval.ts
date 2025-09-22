import { Tx } from '@rabby-wallet/rabby-api/dist/types';
import { useMemoizedFn } from 'ahooks';
import { atom, useAtom, useAtomValue, useSetAtom } from 'jotai';
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

export let DirectSubmitReject;

export const miniApprovalAtom = atom<{
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
}>({
  txs: [],
});

const DEFAULT_MINI_SIGN_TX_EXTRA_CONFIG = {
  // autoTriggerPreExecError: false,
  showSimulateChange: false,
  title: null as ReactNode,
  disableSignBtn: false,
  onPreExecChange: noop,
  autoThrowPreExecError: true,
  // onRedirectToDeposit: noop,
};

const miniSignExtraPropsAtom = atom(DEFAULT_MINI_SIGN_TX_EXTRA_CONFIG);

export const useGetMiniSignTxExtraProps = () =>
  useAtomValue(miniSignExtraPropsAtom);

// let globalCurrentApprovalId = uniqueId('mini-approval');
export const useMiniApproval = () => {
  const [state, setState] = useAtom(miniApprovalAtom);
  const setMiniSignExtraProps = useSetAtom(miniSignExtraPropsAtom);
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
          setState(prev => {
            return {
              ...prev,
              id: id || prev.id,
              txs,
              ga,
              visible: directSubmit ? false : true,
              directSubmit: !!directSubmit,
              account,
              onReject: e => {
                setState(prev => ({
                  ...prev,
                  txs: [],
                  visible: false,
                  showMaskLoading: true,
                  transparentMask: false,
                  checkGasFee: false,
                }));
                setMiniSignExtraProps(() => DEFAULT_MINI_SIGN_TX_EXTRA_CONFIG);
                const signingTxId =
                  notificationService.currentMiniApproval?.signingTxId;
                if (signingTxId) {
                  transactionHistoryService.removeSigningTx(signingTxId);
                  notificationService.currentMiniApproval = null;
                }
                reject(e);
              },
              onResolve: res => {
                setState(prev => ({
                  ...prev,
                  txs: [],
                  visible: false,
                  showMaskLoading: true,
                  transparentMask: false,
                  checkGasFee: false,
                }));
                setMiniSignExtraProps(() => DEFAULT_MINI_SIGN_TX_EXTRA_CONFIG);
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
    setMiniSignExtraProps(() => DEFAULT_MINI_SIGN_TX_EXTRA_CONFIG);
  }, [setMiniSignExtraProps]);

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
      setState(prev => {
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
