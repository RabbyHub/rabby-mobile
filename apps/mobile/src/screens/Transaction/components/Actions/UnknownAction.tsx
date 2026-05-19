import { TransactionGroup } from '@/core/services/transactionHistory';
import { Account } from '@/core/services/preference';
import { useAccounts } from '@/hooks/account';
import { useSortAddressList } from '@/screens/Address/useSortAddressList';
import { findChain } from '@/utils/chain';
import { unionBy } from 'lodash';
import React, { useMemo } from 'react';
import { BalanceChange } from './components/BalanceChange';
import { ActionDetailSection } from './components/ActionDetailSection';

interface Props {
  data: TransactionGroup;
  isSingleAddress?: boolean;
  account?: Account;
}

export const UnknownAction: React.FC<Props> = ({
  data,
  isSingleAddress,
  account,
}) => {
  const { chain } = useMemo(() => {
    const chain =
      findChain({
        id: data.chainId,
      }) || undefined;
    return {
      chain,
    };
  }, [data.chainId]);

  const { accounts } = useAccounts({
    disableAutoFetch: true,
  });
  const list = useSortAddressList(accounts);
  const unionAccounts = useMemo(() => {
    return unionBy(list, account => account.address.toLowerCase());
  }, [list]);

  return (
    <>
      <BalanceChange
        data={data.maxGasTx.explain?.balance_change}
        version={data.maxGasTx.explain?.pre_exec_version || 'v0'}
        isSingleAddress={isSingleAddress}
        account={account}
      />
      <ActionDetailSection data={data} chain={chain} accounts={unionAccounts} />
    </>
  );
};
