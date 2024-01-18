import { Chain, CHAINS_ENUM } from '@debank/common';
import { CHAINS } from '@/constant/chains';
import { ExplainTxResponse } from '@rabby-wallet/rabby-api/dist/types';
import { Result } from '@rabby-wallet/rabby-security-engine';
import React from 'react';
import { ActionRequireData, ParsedActionData } from '../Actions/utils';
import Actions from '../Actions';
// import Loading from '../TxComponents/Loading';

export const TxTypeComponent = ({
  actionRequireData,
  actionData,
  chain = CHAINS[CHAINS_ENUM.ETH],
  isReady,
  raw,
  onChange,
  isSpeedUp,
  engineResults,
  txDetail,
}: {
  actionRequireData: ActionRequireData;
  actionData: ParsedActionData;
  chain: Chain;
  isReady: boolean;
  txDetail: ExplainTxResponse;
  raw: Record<string, string | number>;
  onChange(data: Record<string, any>): void;
  isSpeedUp: boolean;
  engineResults: Result[];
}) => {
  if (!isReady) {
    // return <Loading />;
    return null;
  }
  if (actionData && actionRequireData) {
    return (
      <Actions
        data={actionData}
        requireData={actionRequireData}
        chain={chain}
        engineResults={engineResults}
        txDetail={txDetail}
        raw={raw}
        onChange={onChange}
        isSpeedUp={isSpeedUp}
      />
    );
  }
  return <></>;
};
