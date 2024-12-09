import { useAccounts } from '@/hooks/account';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Image, Text, View } from 'react-native';
import { AddressItem } from '../AddressItem/AddressItem';
import { Button } from '../Button';
import { Card } from '../Card';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  root: {
    alignItems: 'center',
    marginTop: 30,
    height: '100%',
    position: 'relative',
  },
  headline: {
    paddingHorizontal: 20,
  },
  imageWrapper: {
    marginBottom: 14,
  },
  image: {
    width: 60,
    height: 60,
  },
  headlineText: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
    marginBottom: 19,
    textAlign: 'center',
    paddingHorizontal: 50,
  },
  descText: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '400',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-secondary'],
    marginBottom: 27,
    textAlign: 'center',
  },
  list: {
    width: '100%',
    flex: 1,
    flexGrow: 1,
    maxHeight: '80%',
    paddingHorizontal: 20,
  },
  item: {
    width: '100%',
  },
  itemInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  itemInfo: {
    gap: 4,
  },
  footer: {
    position: 'absolute',
    bottom: 56,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
  },
}));

const ItemSeparatorComponent = () => <View style={{ height: 12 }} />;
const ListFooterComponent = () => <View style={{ height: 196 }} />;

export const NoLongerSupports = ({ onDone }) => {
  const { styles } = useTheme2024({ getStyle });
  const { accounts } = useAccounts({
    disableAutoFetch: true,
  });
  const walletConnectAccounts = React.useMemo(
    () =>
      accounts.filter(
        account => account.type === KEYRING_TYPE.WalletConnectKeyring,
      ),
    [accounts],
  );
  const onConfirm = React.useCallback(() => {
    onDone();
  }, [onDone]);
  const { t } = useTranslation();

  return (
    <View style={styles.root}>
      <View style={styles.imageWrapper}>
        <Image
          source={require('@/assets2024/images/notice.png')}
          style={styles.image}
        />
      </View>
      <View style={styles.headline}>
        <Text style={styles.headlineText}>
          {t('component.NoLongerSupports.title')}
        </Text>
        <Text style={styles.descText}>
          {t('component.NoLongerSupports.desc')}
        </Text>
      </View>
      <FlatList
        style={styles.list}
        data={walletConnectAccounts}
        ItemSeparatorComponent={ItemSeparatorComponent}
        ListFooterComponent={ListFooterComponent}
        renderItem={({ item }) => (
          <Card key={`${item.address}_${item.type}`}>
            <AddressItem style={styles.item} account={item}>
              {({ WalletAddress, WalletIcon, WalletName }) => (
                <View style={styles.itemInner}>
                  <WalletIcon />
                  <View style={styles.itemInfo}>
                    <WalletName />
                    <WalletAddress />
                  </View>
                </View>
              )}
            </AddressItem>
          </Card>
        )}
      />
      <View style={styles.footer}>
        <Button
          onPress={onConfirm}
          title={t('component.NoLongerSupports.button')}
          type="primary"
        />
      </View>
    </View>
  );
};
