import React from 'react';
import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';

import { StyleSheet, View, Text } from 'react-native';

import { default as RcWatchAddress } from '@/assets/icons/address/watch.svg';
import TouchableItem from '@/components/Touchable/TouchableItem';
import { apisAddress } from '@/core/apis';
import { useAccounts } from '@/hooks/account';
import { WalletConnectList } from './components/WalletConnectList';
import { WalletItem } from './components/WalletItem';
import { WalletHeadline } from './components/WalletHeadline';

const TEST_ADDR = '0x10b26700b0a2d3f5ef12fa250aba818ee3b43bf4';
function TestBlock() {
  const { fetchAccounts } = useAccounts();

  return (
    <View style={{ padding: 20 }}>
      <TouchableItem
        onPress={() => {
          apisAddress.addWatchAddress(TEST_ADDR);
          setTimeout(fetchAccounts, 500);
        }}>
        <>
          <Text>Add Address hongbo.eth:</Text>
          <Text>({TEST_ADDR})</Text>
        </>
      </TouchableItem>
    </View>
  );
}

function BottomBlockArea() {
  return (
    <View style={[styles.blockView]}>
      <View style={styles.section}>
        <WalletHeadline>Import Watch-only Address</WalletHeadline>
        <WalletItem
          title="Add Contacts"
          Icon={RcWatchAddress}
          subTitle="You can also use it as a watch-only address"
          onPress={() => {}}
        />
      </View>
      <View style={styles.section}>
        <WalletConnectList />
      </View>
    </View>
  );
}

function ImportNewAddressScreen(): JSX.Element {
  return (
    <NormalScreenContainer style={{ padding: 20 }}>
      <View style={[{ flex: 1 }]}>
        <TestBlock />
        <BottomBlockArea />
      </View>
    </NormalScreenContainer>
  );
}

const styles = StyleSheet.create({
  blockView: { width: '100%' },
  section: {
    marginBottom: 20,
  },
});

export default ImportNewAddressScreen;
