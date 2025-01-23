import { AssetAvatar } from '@/components/AssetAvatar';
import { findChain } from '@/utils/chain';
import { SwapItem } from '@rabby-wallet/rabby-api/dist/types';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { CommonHistoryItem } from './CommonHistoryItem';
import { ExchangeIcon } from './ExchangeIcon';
import { getTokenAmountText } from './getTokenAmountText';

interface Props {
  data: SwapItem;
}

export const SwapHistoryItem: React.FC<Props> = ({ data }) => {
  const { t } = useTranslation();
  const isPending = data.status === 'Pending';
  const chainItem = React.useMemo(
    () =>
      findChain({
        serverId: data?.chain,
      }),
    [data.chain],
  );
  const chainName = chainItem?.name || '';

  return (
    <CommonHistoryItem
      icon={
        <ExchangeIcon
          leftIcon={<AssetAvatar logo={data.pay_token.logo_url} size={30} />}
          rightIcon={
            <AssetAvatar logo={data.receive_token.logo_url} size={32} />
          }
        />
      }
      title={t('page.swap.swapped')}
      subTitle={chainName}
      isPending={isPending}
      payTokenAmount={
        '+' +
        getTokenAmountText({
          amount: data.actual.receive_token_amount,
          token: data.receive_token,
        })
      }
      receiveTokenAmount={
        '-' +
        getTokenAmountText({
          amount: data.actual.pay_token_amount,
          token: data.pay_token,
        })
      }
    />
  );
};
