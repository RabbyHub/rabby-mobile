import { Chain, CHAINS_ENUM } from '@/constant/chains';
import { ExplainTxResponse } from '@rabby-wallet/rabby-api/dist/types';
import { Result } from '@rabby-wallet/rabby-security-engine';
import React from 'react';
import Actions from '../Actions';
import Loading from '../TxComponents/Loading';
import { findChain } from '@/utils/chain';
import {
  ActionRequireData,
  ParsedActionData,
} from '@rabby-wallet/rabby-action';
import { Account } from '@/core/services/preference';

export const TxTypeComponent = ({
  actionRequireData,
  actionData,
  chain,
  isReady,
  raw,
  onChange,
  isSpeedUp,
  engineResults,
  txDetail,
  origin,
  originLogo,
  account,
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
  account: Account;
}) => {
  if (!isReady) {
    return <Loading />;
  }

  if (actionData && actionRequireData) {
    return (
      <Actions
        account={account}
        data={actionData}
        requireData={actionRequireData}
        chain={
          chain ||
          findChain({
            enum: CHAINS_ENUM.ETH,
          })
        }
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
