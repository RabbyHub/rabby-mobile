import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import React from 'react';

import { ScrollView, StyleSheet, View } from 'react-native';

import { default as RcWatchAddress } from '@/assets/icons/address/watch.svg';
import { default as RcBuilding } from '@/assets/icons/address/building-cc.svg';
import { default as RcSafe } from '@/assets/icons/address/icon-safe.svg';
import { RootNames } from '@/constant/layout';
import { RootStackParamsList } from '@/navigation-type';
import { matomoRequestEvent } from '@/utils/analytics';
import { KEYRING_CATEGORY, KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import { useNavigation } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { HardwareDeviceList } from './components/HardwareDeviceList';
import { WalletHeadline } from './components/WalletHeadline';
import { WalletItem } from './components/WalletItem';
import { ImportAddressList } from './components/ImportAddressList';
import { CreateAddressList } from './components/CreateAddressList';
import { APP_FEATURE_SWITCH } from '@/constant';
import { makeDebugBorder } from '@/utils/styles';

type AddressStackProps = NativeStackScreenProps<
  RootStackParamsList,
  'StackAddress'
>;
function MainListBlocks() {
  const navigation = useNavigation<AddressStackProps['navigation']>();

  return (
    <View style={[styles.blockView]}>
      {APP_FEATURE_SWITCH.customizePassword && (
        <>
          <View style={styles.section}>
            <CreateAddressList />
          </View>
          <View style={styles.section}>
            <ImportAddressList />
          </View>
        </>
      )}
      <View style={styles.section}>
        <HardwareDeviceList />
      </View>
      <View style={styles.section}>
        <WalletHeadline Icon={RcBuilding}>Institutional Wallets</WalletHeadline>
        <WalletItem
          title="Safe"
          Icon={RcSafe}
          onPress={() => {
            navigation.push(RootNames.StackAddress, {
              screen: RootNames.ImportSafeAddress,
            });
            matomoRequestEvent({
              category: 'Import Address',
              action: `Begin_Import_${KEYRING_CATEGORY.Contract}`,
              label: KEYRING_CLASS.GNOSIS,
            });
          }}
        />
      </View>
      <View style={styles.section}>
        <WalletHeadline>Import Watch-Only Wallet</WalletHeadline>
        <WalletItem
          title="Add Contacts"
          Icon={RcWatchAddress}
          subTitle="You can also use it as watch-only wallet"
          onPress={() => {
            navigation.push(RootNames.StackAddress, {
              screen: RootNames.ImportWatchAddress,
            });
            matomoRequestEvent({
              category: 'Import Address',
              action: `Begin_Import_${KEYRING_CATEGORY.WatchMode}`,
              label: KEYRING_CLASS.WATCH,
            });
          }}
        />
      </View>
    </View>
  );
}

function ImportNewAddressScreen(): JSX.Element {
  return (
    <NormalScreenContainer>
      <ScrollView style={styles.scrollView}>
        <MainListBlocks />
      </ScrollView>
    </NormalScreenContainer>
  );
}

const styles = StyleSheet.create({
  blockView: { width: '100%', marginTop: 0 },
  section: {
    marginBottom: 20,
  },
  scrollView: {
    paddingHorizontal: 20,
    marginBottom: 20,
    // ...makeDebugBorder()
  },
});

export default ImportNewAddressScreen;
