import { toast } from '@/components2024/Toast';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { addressUtils } from '@rabby-wallet/base-utils';
import { Skeleton } from '@rneui/themed';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { Card } from '../Card';
import { AccountListItem, ViewAccount } from './AccountListItem';
import { PlaceholderView } from './PlaceholderView';

const { isSameAddress } = addressUtils;

export interface Props {
  accounts: ViewAccount[];
  currentAccounts: ViewAccount[];
  selectedAccounts: ViewAccount[];
  handleSelectIndex: (address: string, index: number) => void;
  loading?: boolean;
}

export type { ViewAccount } from './AccountListItem';

const FooterComponent = () => <View style={{ height: 84 }} />;

export const AccountListView: React.FC<Props> = ({
  accounts,
  currentAccounts,
  selectedAccounts,
  handleSelectIndex,
  loading,
}) => {
  const { t } = useTranslation();
  const { styles } = useTheme2024({ getStyle });

  return (
    <Card style={styles.root}>
      <FlatList
        style={styles.list}
        data={accounts}
        renderItem={({ item: account }) => {
          const isImported = currentAccounts.some(a =>
            isSameAddress(a.address, account.address),
          );
          const isSelected = selectedAccounts.some(a =>
            isSameAddress(a.address, account.address),
          );

          const onPress = () => {
            if (isImported) {
              toast.success(t('page.newAddress.ledger.imported'));
              return;
            }
            handleSelectIndex(account.address, account.index);
          };

          return (
            <AccountListItem
              account={account}
              key={account.address}
              isImported={isImported}
              isSelected={isSelected}
              onPress={onPress}
            />
          );
        }}
        ListFooterComponent={
          loading ? (
            <PlaceholderView />
          ) : selectedAccounts?.length ? (
            <FooterComponent />
          ) : null
        }
      />
    </Card>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  root: {
    flex: 1,
    marginHorizontal: 20,
    paddingRight: 0,
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  list: {
    width: '100%',
  },
  info: {
    padding: 20,
    alignItems: 'center',
  },
  nameText: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    lineHeight: 24,
    color: colors2024['neutral-title-1'],
    marginTop: 25,
  },
  loading: {
    marginTop: 15,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 17,
    fontWeight: '400',
    fontFamily: 'SF Pro Rounded',
    lineHeight: 22,
    color: colors2024['neutral-secondary'],
  },
}));
