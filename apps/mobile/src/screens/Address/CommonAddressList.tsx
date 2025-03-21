import React from 'react';
import { View, FlatList, Text } from 'react-native';
import { KeyringAccountWithAlias, useAccounts } from '@/hooks/account';
import { useTheme2024 } from '@/hooks/theme';
import { AddressItemEntry } from './components/AddressItem';
import { KeyringTypeName } from '@rabby-wallet/keyring-utils';
import { createGetStyles2024 } from '@/utils/styles';
import { useSortAddressList } from './useSortAddressList';
import { Card } from '@/components2024/Card';
import PlusSVG from '@/assets2024/icons/common/plus-cc.svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Props {
  type: KeyringTypeName;
  footerButtonText: string;
  footerButtonPress: () => void;
}

export const CommonAddressList: React.FC<Props> = ({
  type,
  footerButtonText,
  footerButtonPress,
}) => {
  const { accounts } = useAccounts({
    disableAutoFetch: true,
  });
  const { bottom } = useSafeAreaInsets();

  const { styles, colors2024 } = useTheme2024({ getStyle });
  const filterAccounts = React.useMemo(
    () => [...accounts].filter(a => a.type === type),
    [accounts, type],
  );
  const list = useSortAddressList(filterAccounts);

  return (
    <FlatList
      data={list}
      keyExtractor={item => `${item.address}-${item.type}-${item.brandName}`}
      style={styles.listContainer}
      renderItem={({ item, index }) => (
        <View
          key={`${item.address}-${item.type}-${item.brandName}-${index}`}
          style={styles.itemGap}>
          <AddressItemEntry account={item} />
        </View>
      )}
      ListFooterComponent={
        <>
          <Card style={styles.footer} onPress={footerButtonPress}>
            <View style={styles.footerMain}>
              <PlusSVG
                width={20}
                height={20}
                color={colors2024['neutral-secondary']}
              />
              <Text style={styles.footerText}>{footerButtonText}</Text>
            </View>
          </Card>
          <View style={{ height: bottom }} />
        </>
      }
    />
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  listContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  itemGap: {
    marginBottom: 12,
  },
  footer: {
    backgroundColor: colors2024['neutral-bg-2'],
    padding: 16,
    borderRadius: 20,
  },
  footerMain: {
    height: 46,
    justifyContent: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  footerText: {
    color: colors2024['neutral-secondary'],
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
    fontFamily: 'SF Pro Rounded',
  },
}));
