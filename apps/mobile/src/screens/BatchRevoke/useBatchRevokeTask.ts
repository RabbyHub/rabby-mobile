import { Tx } from '@rabby-wallet/rabby-api/dist/types';
import BigNumber from 'bignumber.js';
import PQueue from 'p-queue';
import React from 'react';
import {
  ApprovalSpenderItemToBeRevoked,
  AssetApprovalSpender,
} from '../Approvals/useApprovalsPage';
import { apiApprovals } from '@/core/apis';
import { FailedCode, sendTransaction } from '@/utils/sendTransaction';
import { t } from 'i18next';
import { useGasAccountSign } from '../GasAccount/hooks/atom';
import { findIndexRevokeList } from './utils';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { useMiniApproval } from '@/hooks/useMiniApproval';
import { Account } from '@/core/services/preference';

export async function buildTx(
  item: ApprovalSpenderItemToBeRevoked,
  account: Account,
) {
  // generate tx
  let tx: Tx;
  if (item.permit2Id) {
    const data = await apiApprovals.lockdownPermit2(
      {
        id: item.permit2Id,
        chainServerId: item.chainServerId,
        tokenSpenders: [
          {
            token: item.tokenId!,
            spender: item.spender,
          },
        ],
        account,
      },
      true,
    );
    tx = data.params[0];
  } else if ('nftTokenId' in item) {
    const data = await apiApprovals.revokeNFTApprove(
      { ...item, account },
      undefined,
      true,
    );
    tx = data.params[0];
  } else {
    const data = await apiApprovals.approveToken({
      chainServerId: item.chainServerId,
      id: item.id,
      spender: item.spender,
      amount: 0,
      $ctx: {
        ga: {
          category: 'Security',
          source: 'tokenApproval',
        },
      },
      gasPrice: undefined,
      extra: undefined,
      isBuild: true,
      account,
    });
    tx = data.params[0];
  }

  return tx;
}

export const FailReason = {
  [FailedCode.GasNotEnough]: t('page.approvals.revokeModal.gasNotEnough'),
  [FailedCode.GasTooHigh]: t('page.approvals.revokeModal.gasTooHigh'),
  [FailedCode.SubmitTxFailed]: t('page.approvals.revokeModal.submitTxFailed'),
  [FailedCode.DefaultFailed]: t('page.approvals.revokeModal.defaultFailed'),
  [FailedCode.SimulationFailed]: t(
    'page.approvals.revokeModal.simulationFailed',
  ),
};

export type AssetApprovalSpenderWithStatus = AssetApprovalSpender & {
  $status?:
    | {
        status: 'pending';
        isGasAccount?: boolean;
      }
    | {
        status: 'fail';
        failedCode: FailedCode;
        failedReason?: string;
        gasCost?: {
          gasCostUsd: BigNumber;
        };
      }
    | {
        status: 'success';
        txHash: string;
        gasCost: {
          gasCostUsd: BigNumber;
          gasCostAmount: BigNumber;
          nativeTokenSymbol: string;
        };
      };
};

const updateAssetApprovalSpender = (
  list: AssetApprovalSpender[],
  item: AssetApprovalSpender,
) => {
  const index = list.findIndex(data => {
    if (
      data.id === item.id &&
      data.$assetParent?.id === item.$assetParent?.id
    ) {
      return true;
    }
  });

  if (index >= 0) {
    list[index] = item;
  }

  return [...list];
};

const cloneAssetApprovalSpender = (item: AssetApprovalSpender) => {
  const cloneItem: AssetApprovalSpenderWithStatus = {
    ...item,
    $status: {
      status: 'pending',
    },
  };
  const cloneProperty = (key: keyof AssetApprovalSpender) => {
    const descriptor = Object.getOwnPropertyDescriptor(item, key);
    if (descriptor) {
      Object.defineProperty(cloneItem, key, descriptor);
    }
  };

  cloneProperty('$assetContract');
  cloneProperty('$assetToken');
  cloneProperty('$assetParent');

  return cloneItem;
};

export const useBatchRevokeTask = ({
  account: currentAccount,
}: {
  account: Account;
}) => {
  const { sendMiniTransactions } = useMiniApproval();
  const gasAccount = useGasAccountSign();
  const queueRef = React.useRef(
    new PQueue({ concurrency: 1, autoStart: true }),
  );
  const [list, setList] = React.useState<AssetApprovalSpenderWithStatus[]>([]);
  const [revokeList, setRevokeList] = React.useState<
    ApprovalSpenderItemToBeRevoked[]
  >([]);
  const [status, setStatus] = React.useState<
    'idle' | 'active' | 'paused' | 'completed'
  >('idle');
  const [txStatus, setTxStatus] = React.useState<'sended' | 'signed' | 'idle'>(
    'idle',
  );
  const currentApprovalRef = React.useRef<AssetApprovalSpender>();

  const pause = React.useCallback(() => {
    queueRef.current.pause();
    setStatus('paused');
  }, []);

  const addRevokeTask = React.useCallback(
    async (
      item: AssetApprovalSpender,
      priority: number = -1,
      ignoreGasCheck = false,
    ) => {
      return queueRef.current.add(
        async () => {
          currentApprovalRef.current = item;
          const cloneItem = cloneAssetApprovalSpender(item);
          const revokeItem =
            revokeList[
              findIndexRevokeList(revokeList, {
                item: item.$assetContract!,
                spenderHost: item.$assetToken!,
                assetApprovalSpender: item,
              })
            ];

          cloneItem.$status!.status = 'pending';
          setList(prev => updateAssetApprovalSpender(prev, cloneItem));
          try {
            const tx = await buildTx(revokeItem, currentAccount);
            if (
              currentAccount?.type === KEYRING_TYPE.SimpleKeyring ||
              currentAccount?.type === KEYRING_TYPE.HdKeyring
            ) {
              const result = await sendTransaction({
                tx,
                ignoreGasCheck,
                chainServerId: revokeItem.chainServerId,
                gasAccount: {
                  sig: gasAccount.sig,
                  accountId: gasAccount.accountId,
                },
                autoUseGasAccount: true,
                onProgress: status => {
                  if (status === 'builded') {
                    setTxStatus('sended');
                  } else if (status === 'signed') {
                    setTxStatus('signed');
                  }
                },
                onUseGasAccount: () => {
                  // update status
                  cloneItem.$status = {
                    status: 'pending',
                    isGasAccount: true,
                  };
                  setList(prev => updateAssetApprovalSpender(prev, cloneItem));
                },
                ga: {
                  category: 'Security',
                  source: 'tokenApproval',
                },
                account: currentAccount,
              });
              // update status
              cloneItem.$status = {
                status: 'success',
                txHash: result.txHash,
                gasCost: result.gasCost,
              };
            } else {
              const [result] = await sendMiniTransactions({
                txs: [tx],
                account: currentAccount!,
              });

              // update status
              cloneItem.$status = {
                status: 'success',
                txHash: result.txHash,
                gasCost: result.gasCost,
              };
            }
          } catch (e: any) {
            let failedCode = FailedCode.SubmitTxFailed;
            if (FailedCode[e?.name]) {
              failedCode = e.name;
            }

            console.error(e);
            cloneItem.$status = {
              status: 'fail',
              failedCode: failedCode,
              failedReason: e?.message ?? e,
              gasCost: e?.gasCost,
            };

            if (e === 'PRESS_BACKDROP') {
              pause();
            }
          } finally {
            setList(prev => updateAssetApprovalSpender(prev, cloneItem));
            setTxStatus('idle');
          }
        },
        { priority },
      );
    },
    [
      revokeList,
      currentAccount,
      gasAccount.sig,
      gasAccount.accountId,
      sendMiniTransactions,
      pause,
    ],
  );

  const start = React.useCallback(() => {
    setStatus('active');
    for (const item of list) {
      addRevokeTask(item);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, revokeList]);

  const init = React.useCallback(
    (
      dataSource: AssetApprovalSpender[],
      _revokeList: ApprovalSpenderItemToBeRevoked[],
    ) => {
      queueRef.current.clear();
      setList(dataSource);
      setRevokeList(_revokeList);
      setStatus('idle');
    },
    [],
  );

  const handleContinue = React.useCallback(() => {
    queueRef.current.start();
    setStatus('active');
  }, []);

  React.useEffect(() => {
    queueRef.current.on('error', error => {
      console.error('Queue error:', error);
    });

    queueRef.current.on('idle', () => {
      setStatus('completed');
    });

    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      queueRef.current.clear();
    };
  }, []);

  const totalApprovals = React.useMemo(() => {
    return revokeList.length;
  }, [revokeList]);

  const revokedApprovals = React.useMemo(() => {
    return list.filter(item => item.$status?.status === 'success').length;
  }, [list]);

  const currentApprovalIndex = React.useMemo(() => {
    return list.findIndex(item => item.$status?.status === 'pending');
  }, [list]);

  const resetCurrent = React.useCallback(() => {
    if (currentApprovalRef.current) {
      addRevokeTask(currentApprovalRef.current, 0);
    }
  }, [addRevokeTask]);

  return {
    list,
    init,
    start,
    continue: handleContinue,
    pause,
    status,
    txStatus,
    addRevokeTask,
    totalApprovals,
    revokedApprovals,
    currentApprovalIndex,
    currentApprovalRef,
    resetCurrent,
  };
};

export type BatchRevokeTaskType = ReturnType<typeof useBatchRevokeTask>;
