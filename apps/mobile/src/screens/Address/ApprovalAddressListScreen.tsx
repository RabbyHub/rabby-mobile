import React from 'react';
import { View, FlatList } from 'react-native';
import {
  KeyringAccountWithAlias,
  useAccounts,
  useCurrentAccount,
} from '@/hooks/account';
import { useTheme2024 } from '@/hooks/theme';
import { AddressItemEntry } from './components/ApprovalAddressItem';
import { useFocusEffect, useNavigation } from '@react-navigation/core';
import { RootStackParamsList } from '@/navigation-type';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { createGetStyles2024 } from '@/utils/styles';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { AddressEmptyContainer } from './components/AddressEmptyContainer';
import { trigger } from 'react-native-haptic-feedback';
import { RootNames } from '@/constant/layout';
import {
  FILTER_ACCOUNT_TYPES,
  useApprovalAlertCounts,
} from '@/screens/Home/hooks/approvals';

type CurrentAddressProps = NativeStackScreenProps<
  RootStackParamsList,
  'StackAddress'
>;

interface AccountWithApprovalInofItem extends KeyringAccountWithAlias {
  alertCount?: number;
  approvalCount?: number;
}
export function ApprovalAddressListScreen(): JSX.Element {
  const { accounts, fetchAccounts } = useAccounts({
    disableAutoFetch: true,
  });
  const { appprovalAlertInfo } = useApprovalAlertCounts();
  const { styles } = useTheme2024({ getStyle });

  const displayAccounts: AccountWithApprovalInofItem[] = accounts
    .filter(acc => !FILTER_ACCOUNT_TYPES.includes(acc.type))
    .map(item => ({
      ...item,
      // TODO: add approval account
      alertCount: appprovalAlertInfo?.address2count?.[item.address],
    }))
    .sort((a, b) => {
      // TODO: sort by alertCount desc then approval count
      return b.alertCount - a.alertCount;
    });

  const { switchAccount } = useCurrentAccount();

  const navigation = useNavigation<CurrentAddressProps['navigation']>();

  const handleSelect = (account: KeyringAccountWithAlias) => {
    trigger('impactLight', {
      enableVibrateFallback: true,
      ignoreAndroidSystemSettings: false,
    });
    // set =>> currentAccountAtom
    switchAccount(account);
    navigation.push(RootNames.StackTransaction, {
      screen: RootNames.Approvals,
    });
  };

  useFocusEffect(
    // keep same with multi address home
    React.useCallback(() => {
      fetchAccounts();
    }, [fetchAccounts]),
  );

  return (
    <NormalScreenContainer2024>
      <FlatList
        data={displayAccounts}
        keyExtractor={item => `${item.address}-${item.type}-${item.brandName}`}
        style={styles.listContainer}
        renderItem={({ item, index }) => (
          <View
            key={`${item.address}-${item.type}-${item.brandName}-${index}`}
            style={
              index < displayAccounts.length - 1 ? styles.itemGap : undefined
            }>
            <AddressItemEntry
              account={item}
              alertCount={appprovalAlertInfo.address2count[item.address]}
              onSelect={() => handleSelect(item)}
            />
          </View>
        )}
        ListEmptyComponent={AddressEmptyContainer}
      />
    </NormalScreenContainer2024>
  );
}

const getStyle = createGetStyles2024(() => ({
  listContainer: {
    flex: 1,
    paddingHorizontal: 16,
    gap: 12,
  },
  itemGap: {
    marginBottom: 12,
  },
}));
