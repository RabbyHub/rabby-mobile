import { useMemoizedFn } from 'ahooks';
import { useClearMiniApprovalTask } from './useMiniApprovalTask';
import { uniqueId } from 'lodash';
import {
  notificationService,
  transactionHistoryService,
} from '@/core/services';
import { Account } from '@/core/services/preference';
import { MiniTypedData } from './useMiniSignTypedDataApprovalTask';
import { sendSignTypedData } from '@/utils/sendTypedData';
import { zCreate } from '@/core/utils/reexports';
import { UpdaterOrPartials, resolveValFromUpdater } from '@/core/utils/store';

export let DirectSubmitReject;

// Zustand implementation for miniApproval
type MiniApprovalState = {
  txs?: MiniTypedData[];
  onReject?: (e?: any) => void;
  onResolve?: (res: Awaited<ReturnType<typeof sendSignTypedData>>[]) => void;
  onVisibleChange?: (v: boolean) => void;
  ga?: Record<string, any>;
  id?: string;
  directSubmit?: boolean;
  account?: Account;
  autoSign?: boolean;
};

const miniApprovalStore = zCreate<MiniApprovalState>(() => ({
  txs: [],
}));

function setMiniApprovalState(valOrFunc: UpdaterOrPartials<MiniApprovalState>) {
  miniApprovalStore.setState(prev => {
    const { newVal, changed } = resolveValFromUpdater(prev, valOrFunc, {
      strict: false,
    });

    return newVal;
  });
}

export const useMiniSignTypedDataApprovalState = () => {
  return miniApprovalStore();
};

export const useSendMiniSignTypedData = () => {
  const state = miniApprovalStore();
  const { clear } = useClearMiniApprovalTask();

  const _sendMiniTransactions = useMemoizedFn(
    async ({
      txs,
      ga,
      id,
      account,
    }: {
      txs: MiniTypedData[];
      ga?: Record<string, any>;
      id?: string;
      account: Account;
    }) => {
      return new Promise<Awaited<ReturnType<typeof sendSignTypedData>>[]>(
        (resolve, reject) => {
          const directSubmit = true;
          if (directSubmit) {
            DirectSubmitReject = directSubmit ? reject : undefined;
          }
          setMiniApprovalState(prev => {
            return {
              ...prev,
              id: id || prev.id,
              txs,
              ga,
              directSubmit: !!directSubmit,
              account,
              onReject: e => {
                setMiniApprovalState(prev => ({
                  ...prev,
                  txs: [],
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
                setMiniApprovalState(prev => ({
                  ...prev,
                  txs: [],
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

  const sendMiniSignTypedData = useMemoizedFn(
    async ({
      txs,
      ga,
      account,
      autoSign = true,
    }: {
      txs: MiniTypedData[];
      ga?: Record<string, any>;
      account: Account;
      autoSign?: boolean;
    }) => {
      clear();
      setMiniApprovalState(prev => {
        return {
          ...prev,
          id: uniqueId('mini-approval'),
          txs,
          ga,
          account,
          autoSign,
        };
      });
      return _sendMiniTransactions({
        txs,
        ga,
        id: uniqueId('mini-signTypedData-approval'),
        account,
      });
    },
  );

  return sendMiniSignTypedData;
};
