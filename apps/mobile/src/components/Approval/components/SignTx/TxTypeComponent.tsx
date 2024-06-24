import { Chain, CHAINS_ENUM } from '@/constant/chains';
import { CHAINS } from '@/constant/chains';
import { ExplainTxResponse } from '@rabby-wallet/rabby-api/dist/types';
import { Result } from '@rabby-wallet/rabby-security-engine';
import React from 'react';
import { ActionRequireData, ParsedActionData } from '../Actions/utils';
import Actions from '../Actions';
import Loading from '../TxComponents/Loading';

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
  origin,
  originLogo,
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
  origin?: string;
  originLogo?: string;
}) => {
  if (!isReady) {
    return <Loading />;
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
        origin={origin}
        originLogo={originLogo}
      />
    );
  }
  return <></>;
};
