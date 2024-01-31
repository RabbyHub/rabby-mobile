import React from 'react';
import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';

import { ScrollView, StyleSheet, View } from 'react-native';

import { default as RcWatchAddress } from '@/assets/icons/address/watch.svg';
import { WalletConnectList } from './components/WalletConnectList';
import { WalletItem } from './components/WalletItem';
import { WalletHeadline } from './components/WalletHeadline';
import { RootNames } from '@/constant/layout';
import { HardwareDeviceList } from './components/HardwareDeviceList';
import { RootStackParamsList } from '@/navigation-type';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';

type AddressStackProps = NativeStackScreenProps<
  RootStackParamsList,
  'StackAddress'
>;
function BottomBlockArea() {
  const navigation = useNavigation<AddressStackProps['navigation']>();
  return (
    <View style={[styles.blockView]}>
      <View style={styles.section}>
        <HardwareDeviceList />
      </View>
      <View style={styles.section}>
        <WalletConnectList />
      </View>
      <View style={styles.section}>
        <WalletHeadline>Import Watch-only Address</WalletHeadline>
        <WalletItem
          title="Add Contacts"
          Icon={RcWatchAddress}
          subTitle="You can also use it as a watch-only address"
          onPress={() => {
            navigation.push(RootNames.StackAddress, {
              screen: RootNames.ImportWatchAddress,
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
