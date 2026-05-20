import { TransactionGroup } from '@/core/services/transactionHistory';
import { Account } from '@/core/services/preference';
import { useAccounts } from '@/hooks/account';
import { useSortAddressList } from '@/screens/Address/useSortAddressList';
import { findChain } from '@/utils/chain';
import { unionBy } from 'lodash';
import React, { useMemo } from 'react';
import { ActionDetailSection } from './components/ActionDetailSection';
import { ScrollView } from 'react-native-gesture-handler';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';

interface Props {
  data: TransactionGroup;
  isSingleAddress?: boolean;
  account?: Account;
}

export const DeployContact: React.FC<Props> = ({ data }) => {
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

  return (
    <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
      <ActionDetailSection data={data} chain={chain} accounts={unionAccounts} />
    </ScrollView>
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
