import { toast } from '@/components2024/Toast';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { addressUtils } from '@rabby-wallet/base-utils';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, View } from 'react-native';
import { AccountListItem, ViewAccount } from './AccountListItem';
import { PlaceholderView } from './PlaceholderView';
import { Text } from '@/components/Typography';

const { isSameAddress } = addressUtils;

export interface Props {
  accounts: ViewAccount[];
  currentAccounts: ViewAccount[];
  selectedAccounts: ViewAccount[];
  handleSelectIndex: (address: string, index: number) => void;
  loading?: boolean;
  brandName: string;
  seedPhraseIndex?: number;
}

export type { ViewAccount } from './AccountListItem';

const FOOTER_HEIGHT = 120;
const FooterComponent = () => <View style={{ height: FOOTER_HEIGHT }} />;

export const AccountListView: React.FC<Props> = ({
  accounts,
  currentAccounts,
  selectedAccounts,
  handleSelectIndex,
  loading,
  brandName,
}) => {
  const { t } = useTranslation();
  const { styles } = useTheme2024({ getStyle });

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerText}>
          {t('page.manageAddress.seed-phrase')}
        </Text>
      </View>
      <FlatList
        style={styles.list}
        data={accounts}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
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
              brandName={brandName}
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
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  root: {
    flex: 1,
    marginHorizontal: 16,
    borderRadius: 16,
    backgroundColor: colors2024['neutral-bg-1'],
    paddingVertical: 16,
    overflow: 'hidden',
  },
  header: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  headerText: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
  },
  list: {
    width: '100%',
    paddingHorizontal: 12,
  },
  separator: {
    height: 8,
  },
}));
