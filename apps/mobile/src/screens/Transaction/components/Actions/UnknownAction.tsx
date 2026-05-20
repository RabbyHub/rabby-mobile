import { TransactionGroup } from '@/core/services/transactionHistory';
import { Account } from '@/core/services/preference';
import { useAccounts } from '@/hooks/account';
import { useSortAddressList } from '@/screens/Address/useSortAddressList';
import { findChain } from '@/utils/chain';
import { unionBy } from 'lodash';
import React, { useMemo } from 'react';
import { BalanceChange } from './components/BalanceChange';
import { ActionDetailSection } from './components/ActionDetailSection';
import { createGetStyles2024 } from '@/utils/styles';
import { ScrollView } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import { ProjectItemInDetail } from '../ProjectItemInDetail';
import { useTranslation } from 'react-i18next';

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

  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  console.log('UnknownAction render', {
    data,
    chain,
  });

  return (
    <>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}>
        <BalanceChange
          data={data.maxGasTx?.explain?.balance_change}
          version={data.maxGasTx?.explain?.pre_exec_version || 'v0'}
          isSingleAddress={isSingleAddress}
          account={account}
        />
        <ActionDetailSection data={data} chain={chain} accounts={unionAccounts}>
          <ProjectItemInDetail
            title={t('page.transactions.detail.InteractedContract')}
            address={data?.maxGasTx?.rawTx?.to}
            chain={chain}
          />
        </ActionDetailSection>
      </ScrollView>
    </>
  );
};

const getStyle = createGetStyles2024(
  ({ colors2024, isLight, safeAreaInsets }) => ({
    scrollView: {
      paddingHorizontal: 16,
      paddingBottom: Math.max(safeAreaInsets.bottom, 24),
    },
  }),
);
