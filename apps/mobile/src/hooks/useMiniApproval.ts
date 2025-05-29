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
}>({
  txs: [],
});

// let globalCurrentApprovalId = uniqueId('mini-approval');
export const useMiniApproval = () => {
  const [state, setState] = useAtom(miniApprovalAtom);
  const { clear } = useClearMiniApprovalTask();

  const _sendMiniTransactions = useMemoizedFn(
    ({
      txs,
      ga,
      id,
      directSubmit,
    }: {
      txs: Tx[];
      ga?: Record<string, any>;
      id?: string;
      directSubmit?: boolean;
    }) => {
      // const currentApprovalId = uniqueId('mini-approval');
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
              onReject: e => {
                setState(prev => ({
                  ...prev,
                  txs: [],
                  visible: false,
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
    ({
      txs,
      ga,
      directSubmit,
    }: {
      txs: Tx[];
      ga?: Record<string, any>;
      directSubmit?: boolean;
    }) => {
      clear();
      return _sendMiniTransactions({
        txs,
        ga,
        directSubmit,
        id: uniqueId('mini-approval'),
      });
    },
  );

  const prepareMiniTransactions = useMemoizedFn(
    ({
      txs,
      ga,
      directSubmit,
    }: {
      txs: Tx[];
      ga?: Record<string, any>;
      directSubmit?: boolean;
    }) => {
      clear();
      setState(prev => {
        return {
          ...prev,
          id: uniqueId('mini-approval'),
          txs,
          ga,
          directSubmit,
        };
      });
    },
  );

  const sendPrepareMiniTransactions = useMemoizedFn(
    async (params?: { directSubmit?: boolean }) => {
      if (state.txs?.length) {
        await _sendMiniTransactions({
          txs: state.txs,
          ga: state.ga,
          directSubmit: !!params?.directSubmit,
        });
      } else {
        throw new Error(
          'txs is empty, please run prepareMiniTransactions first',
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
