import { Tx } from '@rabby-wallet/rabby-api/dist/types';
import { useMemoizedFn } from 'ahooks';
import { atom, useAtom } from 'jotai';
import { useClearMiniApprovalTask } from './useMiniApprovalTask';
import { uniqueId } from 'lodash';
import { sendTransaction } from '@/utils/sendTransaction';

export const miniApprovalAtom = atom<{
  txs?: Tx[];
  visible?: boolean;
  onReject?: (e?: any) => void;
  onResolve?: (res: Awaited<ReturnType<typeof sendTransaction>>[]) => void;
  onVisibleChange?: (v: boolean) => void;
  ga?: Record<string, any>;
}>({
  txs: [],
});

// let globalCurrentApprovalId = uniqueId('mini-approval');
export const useMiniApproval = () => {
  const [state, setState] = useAtom(miniApprovalAtom);
  const { clear } = useClearMiniApprovalTask();

  const sendMiniTransactions = useMemoizedFn(
    ({ txs, ga }: { txs: Tx[]; ga?: Record<string, any> }) => {
      // clear();
      // const currentApprovalId = uniqueId('mini-approval');
      return new Promise<Awaited<ReturnType<typeof sendTransaction>>[]>(
        (resolve, reject) => {
          setState(prev => {
            return {
              ...prev,
              txs,
              ga,
              visible: true,
              onReject: e => {
                setState(prev => ({ ...prev, txs: [], visible: false }));
                reject(e);
              },
              onResolve: res => {
                setState(prev => ({ ...prev, txs: [], visible: false }));
                resolve(res);
              },
            };
          });
        },
      );
    },
  );

  console.log(state);

  const prepareMiniTransactions = useMemoizedFn(
    ({ txs, ga }: { txs: Tx[]; ga?: Record<string, any> }) => {
      setState(prev => {
        return {
          ...prev,
          txs,
          ga,
        };
      });
    },
  );

  const sendPrepareMiniTransactions = useMemoizedFn(async () => {
    if (state.txs?.length) {
      await sendMiniTransactions({
        txs: state.txs,
        ga: state.ga,
      });
    } else {
      throw new Error('txs is empty, please run prepareMiniTransactions first');
    }
  });

  return {
    sendMiniTransactions,
    prepareMiniTransactions,
    sendPrepareMiniTransactions,
  };
};
