import React from 'react';
import { findChainByID } from '@/utils/chain';
import { noop } from 'lodash';
import { INTERNAL_REQUEST_SESSION } from '@/constant';

import { normalizeTxParams } from '@/components/Approval/components/SignTx/util';
import { TxTypeComponent } from '@/components/Approval/components/SignTx/TxTypeComponent';

import type { ExplainTxResponse, Tx } from '@rabby-wallet/rabby-api/dist/types';
import type { Account } from '@/core/services/preference';
import type { SecurityResult } from '../domain';

export const MiniSecurityHeader: React.FC<{
  engineResults?: SecurityResult;
  tx: Tx;
  txDetail: ExplainTxResponse;
  session?: typeof INTERNAL_REQUEST_SESSION;
  account: Account;
  isReady: boolean;
}> = ({
  engineResults,
  tx,
  txDetail,
  session = INTERNAL_REQUEST_SESSION,
  account,
  isReady,
}) => {
  if (!account) return null;

  const {
    parsedTransactionActionData,
    actionRequireData,
    parsedTransactionActionDataList,
    actionRequireDataList,
    engineResultList,
    engineResult,
  } = engineResults || {};

  const chain = findChainByID(tx.chainId)!;
  const { isSpeedUp } = normalizeTxParams(tx);

  return (
    <TxTypeComponent
      account={account}
      isReady={isReady}
      actionData={parsedTransactionActionData || {}}
      actionRequireData={actionRequireData || {}}
      chain={chain}
      txDetail={txDetail}
      raw={{ ...tx }}
      onChange={noop}
      isSpeedUp={isSpeedUp}
      engineResults={engineResult || engineResultList?.[0] || []}
      origin={session.origin}
      originLogo={session.icon}
      multiAction={
        engineResultList
          ? {
              actionList: parsedTransactionActionDataList!,
              requireDataList: actionRequireDataList!,
              engineResultList: engineResultList!,
            }
          : undefined
      }
      inDappAction
    />
  );
};
