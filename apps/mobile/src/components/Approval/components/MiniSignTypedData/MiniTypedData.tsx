import { Account } from '@/core/services/preference';
import React, { useEffect } from 'react';

import { MiniFooterBar } from '../MiniSignTx/MiniFooterBar';
import { CHAINS } from '@debank/common';
import { INTERNAL_REQUEST_SESSION } from '@/constant';
import { useMemoizedFn } from 'ahooks';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import { sendSignTypedData } from '@/utils/sendTypedData';
import {
  MiniTypedData,
  MiniTypedDataApprovalTaskType,
} from '@/hooks/useMiniSignTypedDataApprovalTask';
import { noop } from 'lodash';

export const MiniSignTypedDate = ({
  txs,
  onReject,
  onResolve,
  onVisibleChange,
  task,
  onSubmitting,
  onSubmitted,
  directSubmit,
  account,
}: {
  txs: MiniTypedData[];
  onReject?: (e?: any) => void;
  onResolve?: (res: Awaited<ReturnType<typeof sendSignTypedData>>[]) => void;
  onVisibleChange?: (v: boolean) => void;
  task: MiniTypedDataApprovalTaskType;
  onSubmitting?: () => void;
  onSubmitted?: (isSuccess: boolean) => void;
  directSubmit?: boolean;
  account: Account;
}) => {
  console.log('MiniSignTypedDate mount');
  const handleAllow = useMemoizedFn(async () => {
    const currentAccount = account;

    if (
      [KEYRING_CLASS.MNEMONIC, KEYRING_CLASS.PRIVATE_KEY].includes(
        currentAccount?.type || ('' as any),
      )
    ) {
      onVisibleChange?.(false);
    }
    onSubmitting?.();
    try {
      const res = await task.start();
      onResolve?.(res || []);
      onSubmitted?.(true);
    } catch (e) {
      console.error(e);
      onSubmitted?.(false);
      throw e;
    }
  });

  const handleInitTask = useMemoizedFn(() => {
    task.init(
      txs.map(item => {
        return {
          tx: item,
          options: {
            account,
          },
          status: 'idle',
        };
      }),
    );
  });

  useEffect(() => {
    handleInitTask();
  }, [handleInitTask, txs]);

  return (
    <>
      <MiniFooterBar
        directSubmit={directSubmit}
        task={task}
        origin={INTERNAL_REQUEST_SESSION.origin}
        originLogo={INTERNAL_REQUEST_SESSION.icon}
        // TODO: REMOVE chain
        chain={CHAINS.ETH}
        onCancel={() => onReject?.()}
        onSubmit={() => handleAllow()}
        enableTooltip={false}
        tooltipContent={null}
        isTestnet={false}
        account={account}
        onIgnoreAllRules={noop}
        disabledProcess={false}
        miniType="typedData"
      />
    </>
  );
};
