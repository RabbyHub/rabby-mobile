import React from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, View } from 'react-native';

import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import { AddressItem } from '@/components2024/AddressItem/AddressItem';
import { WalletIcon } from '@/components2024/WalletIcon/WalletIcon';
import { preferenceService } from '@/core/services';
import { FontNames } from '@/core/utils/fonts';
import { KeyringAccountWithAlias } from '@/hooks/account';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { useNavigation } from '@react-navigation/native';

const TEST_ACCOUNT: Pick<
  KeyringAccountWithAlias,
  'address' | 'balance' | 'aliasName'
> = {
  address: '0x10B26700B0a2d3F5eF12fA250aba818eE3b43bf4',
  balance: 2039078,
  aliasName: 'Boss',
};

function DevUIAccountShowCase(): JSX.Element {
  const { styles, colors2024, colors } = useTheme2024({
    getStyle: getStyles,
    isLight: true,
  });

  const navigation = useNavigation();

  const currentAccount = preferenceService.getFallbackAccount();

  return (
    <NormalScreenContainer
      style={styles.screen}
      noHeader
      overwriteStyle={{ backgroundColor: colors['neutral-card-1'] }}>
      <ScrollView
        nestedScrollEnabled={true}
        contentContainerStyle={styles.screenScrollableView}
        horizontal={false}>
        <Text style={styles.areaTitle}>Address</Text>

        <View style={styles.showCaseRowsContainer}>
          <Text
            style={[styles.componentName, { fontSize: 24, marginBottom: 12 }]}>
            AddressItem
          </Text>
          <View style={{ flexDirection: 'column' }}>
            <Text style={[styles.propertyDesc, { marginVertical: 12 }]}>
              <Text style={[{ fontSize: 18, fontWeight: '700' }]}>
                Summary{' '.repeat(100)}
              </Text>
              <Text style={{ marginBottom: 12 }}>
                Address basic information component, which can automatically
                query various information by just inputting the address (the
                address must be one that has been imported). It also allows for
                the combination of internal components in a functional manner.
              </Text>
            </Text>

            {/* <View style={{ marginTop: 28 }} /> */}
            {currentAccount?.address && (
              <View style={{ paddingHorizontal: 0, marginBottom: 28 }}>
                <Text style={[styles.propertyDesc, { marginVertical: 12 }]}>
                  Your current address
                </Text>
                <AddressItem address={currentAccount?.address} />
              </View>
            )}

            {Object.entries(KEYRING_TYPE).map(([codeKey, stringValue]) => {
              const krKey = `keyring-${codeKey}`;
              return (
                <View
                  key={krKey}
                  style={{ paddingHorizontal: 0, marginBottom: 28 }}>
                  <Text
                    style={[
                      styles.propertyDesc,
                      {
                        marginVertical: 12,
                        fontFamily: FontNames.sf_pro_rounded_bold,
                        fontSize: 14,
                      },
                    ]}>
                    {`KEYRING_TYPE.${codeKey}`}
                  </Text>
                  <AddressItem
                    account={{
                      ...TEST_ACCOUNT,
                      brandName: KEYRING_TYPE[codeKey],
                      type: KEYRING_TYPE[codeKey],
                    }}
                  />
                </View>
              );
            })}

            <View style={[styles.propertyDesc, { marginVertical: 12 }]}>
              <Text style={styles.propertyType}>
                account.brandName: KEYRING_TYPE {' '.repeat(100)}
              </Text>
              <Text style={styles.propertyType}>
                account.type: KEYRING_TYPE {' '.repeat(100)}
              </Text>

              <Text style={{ marginBottom: 12 }}>
                use `account.brandName` to show brand icon
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.showCaseRowsContainer}>
          <Text
            style={[styles.componentName, { fontSize: 24, marginBottom: 12 }]}>
            WalletIcon
          </Text>
          <View style={{ flexDirection: 'column' }}>
            <Text style={[styles.propertyDesc, { marginVertical: 12 }]}>
              <Text style={[{ fontSize: 18, fontWeight: '700' }]}>
                Summary{' '.repeat(100)}
              </Text>
              <Text style={{ marginBottom: 12 }}>Wallet icon component.</Text>
            </Text>

            <ScrollView
              horizontal
              contentContainerStyle={{
                flexDirection: 'row',
                gap: 8,
                justifyContent: 'flex-start',
                alignItems: 'center',
                // marginBottom: 28,
                flexWrap: 'wrap',
                maxWidth: '100%',
              }}>
              {Object.entries(KEYRING_TYPE).map(([codeKey, stringValue]) => {
                const wiKey = `walleticon-${codeKey}`;
                return (
                  <View
                    key={wiKey}
                    style={{
                      paddingHorizontal: 0,
                      flexShrink: 1,
                      width:
                        Math.floor(Dimensions.get('window').width / 3) - 16,
                      height: 110,
                      marginVertical: 12,
                      // ...makeDebugBorder('red'),
                    }}>
                    <WalletIcon
                      style={{ alignSelf: 'center', marginBottom: 8 }}
                      type={KEYRING_TYPE[codeKey]}
                      address={TEST_ACCOUNT.address}
                      width={64}
                      height={64}
                    />
                    <Text
                      style={[
                        styles.propertyDesc,
                        {
                          textAlign: 'center',
                          fontFamily: FontNames.sf_pro_rounded_bold,
                          fontSize: 16,
                        },
                      ]}>
                      {/* {`${codeKey}`} */}
                      {`${stringValue}`}
                    </Text>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </ScrollView>
    </NormalScreenContainer>
  );
}

const CONTENT_W = Dimensions.get('screen').width - 24;
const getStyles = createGetStyles2024(ctx =>
  StyleSheet.create({
    screen: {
      backgroundColor: 'black',
      flexDirection: 'column',
      justifyContent: 'center',
      height: '100%',
    },
    areaTitle: {
      fontSize: 36,
      marginBottom: 12,
      color: ctx.colors2024['neutral-title-1'],
    },
    screenScrollableView: {
      minHeight: '100%',
      flexDirection: 'column',
      justifyContent: 'flex-start',
      // marginTop: 12,
      paddingHorizontal: 12,
      paddingBottom: 64,
      // ...makeDebugBorder(),
    },
    showCaseRowsContainer: {
      flexDirection: 'column',
      alignItems: 'flex-start',
      justifyContent: 'flex-start',

      paddingTop: 16,
      paddingBottom: 12,
      borderTopWidth: 2,
      borderStyle: 'dotted',
      borderTopColor: ctx.colors2024['neutral-foot'],
    },
    componentName: {
      color: ctx.colors2024['blue-default'],
      textAlign: 'left',
      fontSize: 24,
    },
    propertyDesc: {
      flexDirection: 'row',
      width: '100%',
      maxWidth: CONTENT_W,
      flexWrap: 'wrap',
      alignItems: 'flex-start',
      justifyContent: 'flex-start',
    },
    propertyType: {
      color: ctx.colors2024['blue-default'],
      fontSize: 16,
    },
  }),
);

export default DevUIAccountShowCase;
