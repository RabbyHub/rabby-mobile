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
import { WalletConnectList } from './components/WalletConnectList';
import { WalletHeadline } from './components/WalletHeadline';
import { WalletItem } from './components/WalletItem';
import { ImportAddressList } from './components/ImportAddressList';
import { CreateAddressList } from './components/CreateAddressList';

type AddressStackProps = NativeStackScreenProps<
  RootStackParamsList,
  'StackAddress'
>;
function BottomBlockArea() {
  const navigation = useNavigation<AddressStackProps['navigation']>();

  return (
    <View style={[styles.blockView]}>
      <View style={styles.section}>
        <CreateAddressList />
      </View>
      <View style={styles.section}>
        <ImportAddressList />
      </View>
      <View style={styles.section}>
        <HardwareDeviceList />
      </View>
      <View style={styles.section}>
        <WalletConnectList />
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
        <WalletHeadline>Import Watch-only Address</WalletHeadline>
        <WalletItem
          title="Add Contacts"
          Icon={RcWatchAddress}
          subTitle="You can also use it as watch-only address"
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
        <BottomBlockArea />
      </ScrollView>
    </NormalScreenContainer>
  );
}

const styles = StyleSheet.create({
  blockView: { width: '100%', marginTop: 20 },
  section: {
    marginBottom: 20,
  },
  scrollView: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
});

export default ImportNewAddressScreen;
