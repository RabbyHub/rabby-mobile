import React, { useEffect, useState } from 'react';
import { View, FlatList } from 'react-native';
import { KeyringAccountWithAlias, useAccounts } from '@/hooks/account';
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
  useApprovalsCount,
  useApprovalAlertCounts,
} from '@/screens/Home/hooks/approvals';
import { AddressItemContextMenu } from './components/AddressItemContextMenu';

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
  const { address2Count, getAllApprovalCount } = useApprovalsCount();
  const { alertInfo } = useApprovalAlertCounts(10 * 60 * 1000);
  const { styles } = useTheme2024({ getStyle });

  const displayAccounts: AccountWithApprovalInofItem[] = accounts
    .filter(acc => !FILTER_ACCOUNT_TYPES.includes(acc.type))
    .map(item => ({
      ...item,
      approvalCount: address2Count?.[item.address],
      alertCount: alertInfo.address2count?.[item.address],
    }))
    .sort((a, b) => b.approvalCount - a.approvalCount)
    .sort((a, b) => b.alertCount - a.alertCount);

  const navigation = useNavigation<CurrentAddressProps['navigation']>();

  const isInitialLoadRef = React.useRef(true);
  const hasVisitedDetailRef = React.useRef(false);

  React.useEffect(() => {
    if (isInitialLoadRef.current) {
      getAllApprovalCount(displayAccounts);
      isInitialLoadRef.current = false;
    }

    return () => {
      isInitialLoadRef.current = true;
      hasVisitedDetailRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      if (hasVisitedDetailRef.current && !isInitialLoadRef.current) {
        getAllApprovalCount(displayAccounts);
      }

      return () => {
        hasVisitedDetailRef.current = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const handleSelect = (account: KeyringAccountWithAlias) => {
    navigation.push(RootNames.StackTransaction, {
      screen: RootNames.Approvals,
      params: {
        account,
      },
    });
  };

  useFocusEffect(
    // keep same with multi address home
    React.useCallback(() => {
      fetchAccounts();
    }, [fetchAccounts]),
  );

  return (
    <NormalScreenContainer2024 style={styles.root}>
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
            <AddressItemContextMenu account={item} actions={['copy', 'edit']}>
              <AddressItemEntry
                account={item}
                alertCount={alertInfo.address2count?.[item.address]}
                approvalCount={address2Count?.[item.address]}
                onSelect={() => handleSelect(item)}
              />
            </AddressItemContextMenu>
          </View>
        )}
        ListEmptyComponent={AddressEmptyContainer}
      />
    </NormalScreenContainer2024>
  );
}

const getStyle = createGetStyles2024(() => ({
  root: {},
  listContainer: {
    flex: 1,
    paddingHorizontal: 20,
    gap: 12,
  },
  itemGap: {
    marginBottom: 12,
  },
}));
