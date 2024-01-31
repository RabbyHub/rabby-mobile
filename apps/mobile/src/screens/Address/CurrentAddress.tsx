import React, { useMemo } from 'react';
import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';

import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  SectionList,
} from 'react-native';
import { useNavigationState } from '@react-navigation/native';
import {
  useAccounts,
  useCurrentAccount,
  usePinAddresses,
} from '@/hooks/account';
import { useThemeColors } from '@/hooks/theme';
import { AddressItem } from './components/AddressItem';
import { AppColorsVariants } from '@/constant/theme';
import { RcIconAddressRight } from '@/assets/icons/address';
import { RcIconButtonAddAccount } from '@/assets/icons/home';
import { RootNames } from '@/constant/layout';
import { useNavigation } from '@react-navigation/core';
import { addressUtils } from '@rabby-wallet/base-utils';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import groupBy from 'lodash/groupBy';
import { sortAccountsByBalance } from '@/utils/account';
import { useOpenDappView } from '../Dapps/hooks/useDappView';

export default function CurrentAddressScreen(): JSX.Element {
  const { accounts } = useAccounts();
  const { currentAccount } = useCurrentAccount();
  const { pinAddresses: highlightedAddresses } = usePinAddresses();

  const { openUrlAsDapp } = useOpenDappView();

  const navState = useNavigationState(
    s => s.routes.find(r => r.name === RootNames.CurrentAddress)?.params,
  ) as
    | {
        backToDappOnClose?: string | undefined;
      }
    | undefined;

  React.useEffect(() => {
    return () => {
      if (navState?.backToDappOnClose) {
        openUrlAsDapp(navState?.backToDappOnClose);
      }
    };
  }, [navState, openUrlAsDapp]);

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
    navigation.push(RootNames.StackAddress, {
      screen: RootNames.ImportNewAddress,
    });
  }, [navigation]);

  const sectionData = useMemo(() => {
    const restAccounts = [...accounts];
    let highlightedAccounts: typeof accounts = [];
    let watchModeHighlightedAccounts: typeof accounts = [];

    highlightedAddresses.forEach(highlighted => {
      const idx = restAccounts.findIndex(
        account =>
          addressUtils.isSameAddress(account.address, highlighted.address) &&
          account.brandName === highlighted.brandName,
      );
      if (idx > -1) {
        if (restAccounts[idx].type === KEYRING_CLASS.WATCH) {
          watchModeHighlightedAccounts.push(restAccounts[idx]);
        } else {
          highlightedAccounts.push(restAccounts[idx]);
        }
        restAccounts.splice(idx, 1);
      }
    });
    const data = groupBy(restAccounts, e =>
      e.type === KEYRING_CLASS.WATCH ? '1' : '0',
    );
    highlightedAccounts = sortAccountsByBalance(highlightedAccounts);
    watchModeHighlightedAccounts = sortAccountsByBalance(
      watchModeHighlightedAccounts,
    );

    const normalAccounts = highlightedAccounts
      .concat(sortAccountsByBalance(data['0'] || []))
      .filter(e => !!e);
    const watchModeAccounts = watchModeHighlightedAccounts
      .concat(sortAccountsByBalance(data['1'] || []))
      .filter(e => !!e);

    return [
      {
        title: 'address',
        data: normalAccounts,
      },
      {
        title: 'Watch Address',
        data: watchModeAccounts,
      },
    ];
  }, [accounts, highlightedAddresses]);

  return (
    <NormalScreenContainer style={styles.screenContainer}>
      <View style={styles.headerContainer}>
        {!!currentAccount && (
          <AddressItem wallet={currentAccount} isCurrentAddress />
        )}
        <View style={styles.switchTitleBox}>
          <Text style={styles.switchText}>Switch address</Text>
          <TouchableOpacity style={styles.bundlesView} onPress={gotoBundles}>
            <Text style={styles.switchText}>My Bundles</Text>
            <RcIconAddressRight />
          </TouchableOpacity>
        </View>
      </View>
      <SectionList
        initialNumToRender={15}
        sections={sectionData}
        keyExtractor={React.useCallback(
          item => `${item.address}-${item.type}-${item.brandName}`,
          [],
        )}
        style={styles.listContainer}
        renderItem={React.useCallback(
          ({ item, index, section }) => (
            <View
              key={`${item.address}-${item.type}-${item.brandName}-${index}`}
              style={
                index < section.data.length - 1 ? styles.itemGap : undefined
              }>
              <AddressItem wallet={item} />
            </View>
          ),
          [styles.itemGap],
        )}
        renderSectionHeader={React.useCallback(
          ({ section }) => {
            if (section.title === 'address') {
              return null;
            }
            return (
              <View
                style={sectionData?.[0]?.data.length ? styles.watchMargin : {}}
              />
            );
          },
          [sectionData, styles.watchMargin],
        )}
        renderSectionFooter={React.useCallback(
          ({ section }) => {
            if (section.title === 'address') {
              return null;
            }
            return (
              <View style={styles.footer}>
                <TouchableOpacity
                  style={styles.importView}
                  onPress={gotoAddAddress}>
                  <RcIconButtonAddAccount style={styles.addAddressIcon} />
                  <Text style={styles.importText}>Import New Address</Text>
                </TouchableOpacity>
              </View>
            );
          },
          [
            gotoAddAddress,
            styles.addAddressIcon,
            styles.footer,
            styles.importText,
            styles.importView,
          ],
        )}
      />
    </NormalScreenContainer>
  );
}

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    screenContainer: {
      backgroundColor: colors['neutral-bg-2'],
      flex: 1,
    },
    headerContainer: {
      paddingTop: 8,
      paddingHorizontal: 20,
    },
    listContainer: {
      flex: 1,
      paddingHorizontal: 20,
    },

    footer: {
      paddingBottom: 30,
    },

    importText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors['blue-default'],
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
