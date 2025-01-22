import { AssetAvatar } from '@/components/AssetAvatar';
import { findChain } from '@/utils/chain';
import { BridgeHistory } from '@rabby-wallet/rabby-api/dist/types';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { CommonHistoryItem } from './CommonHistoryItem';
import { ExchangeIcon } from './ExchangeIcon';
import { getTokenAmountText } from './getTokenAmountText';

interface Props {
  data: BridgeHistory;
}

export const BridgeHistoryItem: React.FC<Props> = ({ data }) => {
  const { t } = useTranslation();
  const isPending = data.status === 'pending';
  const fromChainItem = React.useMemo(
    () =>
      findChain({
        serverId: data?.from_token.chain,
      }),
    [data?.from_token.chain],
  );
  const toChainItem = React.useMemo(
    () =>
      findChain({
        serverId: data?.to_token.chain,
      }),
    [data?.to_token.chain],
  );

  return (
    <CommonHistoryItem
      icon={
        <ExchangeIcon
          leftIcon={<AssetAvatar logo={data.from_token.logo_url} size={30} />}
          rightIcon={<AssetAvatar logo={data.to_token.logo_url} size={32} />}
        />
      }
      title={t('page.bridge.bridged')}
      subTitle={`${fromChainItem?.name} -> ${toChainItem?.name}`}
      isPending={isPending}
      payTokenAmount={
        '+' +
        getTokenAmountText({
          amount: data.actual.pay_token_amount,
          token: data.from_token,
        })
      }
      receiveTokenAmount={
        '-' +
        getTokenAmountText({
          amount: data.actual.receive_token_amount,
          token: data.to_token,
        })
      }
    />
  );
};
