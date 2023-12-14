import React, { useEffect, useMemo } from 'react';
import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';

import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SectionList,
} from 'react-native';
import { useAccounts } from '@/hooks/account';
import { useThemeColors } from '@/hooks/theme';
import TouchableItem from '@/components/Touchable/TouchableItem';
import { removeAddress } from '@/core/apis/address';
import { AddressItem } from './Components/AddressItem';
import { Colors } from '@/constant/theme';
import { RcIconAddressRight } from '@/assets/icons/address';
import { RcIconButtonAddAccount } from '@/assets/icons/home';
import { RootNames } from '@/constant/layout';
import { useNavigation } from '@react-navigation/core';

export default function CurrentAddressScreen(): JSX.Element {
  const { accounts, fetchAccounts } = useAccounts();
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const navigation = useNavigation();

  const gotoBundles = React.useCallback(() => {
    //@ts-ignore
    navigation.push(RootNames.AccountTransaction, {
      screen: RootNames.MyBundle,
      params: {},
    });
  }, [navigation]);
  const gotoAddAddress = React.useCallback(() => {
    //@ts-ignore
    navigation(RootNames.ImportNewAddress);
  }, [navigation]);

  const sectionData = useMemo(() => {
    return [
      {
        title: 'address',
        // data: accounts.filter(e => e.type !== 'Watch Address'),

        data: [
          ...accounts,
          ...accounts,
          ...accounts,
          ...accounts,
          ...accounts,
          ...accounts,
          ...accounts,
          ...accounts,
          ...accounts,
          ...accounts,
          ...accounts,
          ...accounts,
        ],
      },
      {
        title: 'Watch Address',
        data: accounts.filter(e => e.type === 'Watch Address'),
      },
    ];
  }, [accounts]);

  return (
    <NormalScreenContainer>
      <View style={styles.container}>
        {!!accounts[0] && <AddressItem wallet={accounts[0]} isCurrentAddress />}
        <View style={styles.switchTitleBox}>
          <Text style={styles.switchText}>Switch address</Text>
          <TouchableOpacity style={styles.bundlesView} onPress={gotoBundles}>
            <Text style={styles.switchText}>My Bundles</Text>
            <RcIconAddressRight />
          </TouchableOpacity>
        </View>
        <SectionList
          sections={sectionData}
          keyExtractor={item => `${item.address}-${item.brandName}`}
          renderItem={({ item }) => (
            <View style={styles.itemGap}>
              <AddressItem wallet={item} />
            </View>
          )}
          renderSectionHeader={({ section }) => {
            if (section.title === 'address') {
              return null;
            }
            return <View style={styles.watchMargin} />;
          }}
          renderSectionFooter={({ section }) => {
            if (section.title === 'address') {
              return null;
            }
            return (
              <View style={{ paddingBottom: 100 }}>
                <TouchableOpacity
                  style={styles.importView}
                  onPress={gotoAddAddress}>
                  <RcIconButtonAddAccount style={styles.addAddressIcon} />
                  <Text>Import New Address</Text>
                </TouchableOpacity>
              </View>
            );
          }}
        />
      </View>
    </NormalScreenContainer>
  );
}

const getStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      paddingTop: 20,
      paddingHorizontal: 20,
    },

    switchTitleBox: {
      width: '100%',
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 20,
      marginBottom: 8,
    },
    bundlesView: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
    },
    switchText: {
      fontSize: 13,
      fontWeight: '400',
      color: colors['neutral-foot'],
    },

    rightArrow: {
      width: 16,
      height: 16,
    },

    itemGap: {
      marginBottom: 12,
    },

    watchMargin: {
      height: 32,
    },

    importView: {
      marginTop: 32,
      borderRadius: 8,
      backgroundColor: '#fff',
      flex: 1,
      width: '100%',
      height: 56,
      display: 'flex',
      flexDirection: 'row',
      gap: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addAddressIcon: {
      width: 20,
      height: 20,
    },
  });
