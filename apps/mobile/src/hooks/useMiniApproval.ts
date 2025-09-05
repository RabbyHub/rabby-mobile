import { Tx } from '@rabby-wallet/rabby-api/dist/types';
import { useMemoizedFn } from 'ahooks';
import { atom, useAtom } from 'jotai';
import { useClearMiniApprovalTask } from './useMiniApprovalTask';
import { uniqueId } from 'lodash';
import { sendTransaction } from '@/utils/sendTransaction';
import {
  notificationService,
  transactionHistoryService,
} from '@/core/services';
import { sleep } from '@/utils/async';
import { Account } from '@/core/services/preference';

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
}>({
  txs: [],
});

// let globalCurrentApprovalId = uniqueId('mini-approval');
export const useMiniApproval = () => {
  const [state, setState] = useAtom(miniApprovalAtom);
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
                }));
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
                }));
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
    }: {
      txs: Tx[];
      ga?: Record<string, any>;
      directSubmit?: boolean;
      account: Account;
    }) => {
      clear();
      /**
       * wait popup close
       */
      await sleep(600);
      return _sendMiniTransactions({
        txs,
        ga,
        directSubmit,
        id: uniqueId('mini-approval'),
        account,
      });
    },
  );

  const prepareMiniTransactions = useMemoizedFn(
    ({
      txs,
      ga,
      directSubmit,
      account,
      showMaskLoading,
    }: {
      txs: Tx[];
      ga?: Record<string, any>;
      directSubmit?: boolean;
      account: Account;
      showMaskLoading?: boolean;
    }) => {
      clear();
      setState(prev => {
        return {
          ...prev,
          id: uniqueId('mini-approval'),
          txs,
          ga,
          directSubmit,
          account,
          showMaskLoading: showMaskLoading ?? true,
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
  };
};
