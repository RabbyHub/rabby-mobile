import React, { useCallback, useMemo, useRef, useState } from 'react';
import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';

import {
  Dimensions,
  StyleSheet,
  Switch,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
} from 'react-native';
import { useThemeColors } from '@/hooks/theme';

import { RcIconCopyCC, RcIconRightCC } from '@/assets/icons/common';
import { AppColorsVariants } from '@/constant/theme';
import TouchableItem from '@/components/Touchable/TouchableItem';
import {
  KeyringAccountWithAlias,
  usePinAddresses,
  useRemoveAccount,
} from '@/hooks/account';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, Text } from '@/components';
import { RcIconAddressDetailEdit } from '@/assets/icons/address';
import QRCode from 'react-native-qrcode-svg';
import {
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetView,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import { ScrollView } from 'react-native-gesture-handler';
import { useNavigation } from '@react-navigation/native';
import Clipboard from '@react-native-clipboard/clipboard';
import { useWhitelist } from '@/hooks/whitelist';
import { addressUtils } from '@rabby-wallet/base-utils';
import { useAlias } from '@/hooks/alias';
import { splitNumberByStep } from '@/utils/number';

const BottomInput =
  Platform.OS === 'android' ? TextInput : BottomSheetTextInput;

export type AddressDetailScreenProps = NativeStackScreenProps<
  {
    AddressDetail: {
      address: string;
      type: string;
      brandName: string;
      byImport?: string;
    };
  },
  'AddressDetail'
>;

function AddressDetailScreen(props: AddressDetailScreenProps): JSX.Element {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { address, type, brandName } = props.route.params;

  return (
    <NormalScreenContainer>
      <ScrollView style={{ padding: 20, paddingBottom: 100 }}>
        <AddressInfo
          account={
            { address, type, brandName } as unknown as KeyringAccountWithAlias
          }
        />
      </ScrollView>
    </NormalScreenContainer>
  );
}

interface AddressInfoProps {
  account: KeyringAccountWithAlias;
}

const AddressInfo = (props: AddressInfoProps) => {
  const { account } = props;
  const navigation = useNavigation();
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [aliasName, setAliasName] = useAlias(account.address);

  const [aliasPendingName, setAliasPendingName] = useState(aliasName || '');

  const { isAddrOnWhitelist, addWhitelist, removeWhitelist } = useWhitelist();
  const inWhiteList = useMemo(
    () => isAddrOnWhitelist(account.address),
    [account.address, isAddrOnWhitelist],
  );

  const setInWhitelist = useCallback(
    (bool: boolean) => {
      bool ? addWhitelist(account.address) : removeWhitelist(account.address);
    },
    [account.address, addWhitelist, removeWhitelist],
  );

  const { pinAddresses, togglePinAddressAsync } = usePinAddresses();
  const pinned = useMemo(
    () =>
      pinAddresses.some(e =>
        addressUtils.isSameAddress(e.address, account.address),
      ),
    [account.address, pinAddresses],
  );

  const setPinned = useCallback(
    (bool: boolean) => {
      togglePinAddressAsync({
        address: account.address,
        brandName: account.brandName,
        nextPinned: bool,
      });
    },
    [togglePinAddressAsync, account.address, account.brandName],
  );

  const useValue = useMemo(
    () => `$${splitNumberByStep(account.balance?.toFixed(2) || 0)}`,
    [account.balance],
  );

  const codeBottomSheetModalRef = useRef<BottomSheetModal>(null);

  const inputNameBottomSheetModalRef = useRef<BottomSheetModal>(null);

  const deleteBottomSheetModalRef = useRef<BottomSheetModal>(null);

  const handlePresentCodeModalPress = useCallback(() => {
    codeBottomSheetModalRef.current?.present();
  }, []);

  const handlePresentInputModalPress = useCallback(() => {
    inputNameBottomSheetModalRef.current?.present();
  }, []);

  const handlePresentDeleteModalPress = useCallback(() => {
    deleteBottomSheetModalRef.current?.present();
  }, []);

  const handleCloseInputModalPress = useCallback(() => {
    inputNameBottomSheetModalRef.current?.close();
  }, []);

  const handleCloseDeleteModalPress = useCallback(() => {
    deleteBottomSheetModalRef.current?.close();
  }, []);

  const handleCodeSheetChanges = useCallback((index: number) => {
    console.log('handleSheetChanges', index);
  }, []);

  const removeAccount = useRemoveAccount();

  const handleDelete = useCallback(async () => {
    await removeAccount(account);
    handleCloseDeleteModalPress();
    navigation.goBack();
  }, [account, handleCloseDeleteModalPress, navigation, removeAccount]);

  const changeAddressNote = useCallback(() => {
    setAliasName(aliasPendingName);
    console.log('aliasPendingName', aliasPendingName);

    handleCloseInputModalPress();
  }, [aliasPendingName, handleCloseInputModalPress, setAliasName]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
      />
    ),
    [],
  );

  return (
    <View style={{ gap: 20 }}>
      <View style={styles.view}>
        <View
          style={[
            styles.itemView,
            {
              flexDirection: 'column',
              justifyContent: 'flex-start',
              alignItems: 'flex-start',
              paddingVertical: 10,
            },
          ]}>
          <Text style={styles.labelText}>Address</Text>
          <TouchableOpacity
            onPress={() => {
              Clipboard.setString(account.address);
            }}
            style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap' }}>
            <Text>{account.address}</Text>

            <RcIconCopyCC
              color={colors['neutral-foot']}
              height={14}
              width={14}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.itemView}>
          <Text style={styles.labelText}>Address Note</Text>
          <TouchableOpacity
            style={styles.valueView}
            onPress={handlePresentInputModalPress}>
            <Text style={styles.valueText}>{aliasName || ''}</Text>
            <RcIconAddressDetailEdit color={colors['neutral-foot']} />
          </TouchableOpacity>
        </View>

        <View style={styles.itemView}>
          <Text style={styles.labelText}>Assets</Text>
          <View style={styles.valueView}>
            <Text style={styles.valueText}>{useValue}</Text>
          </View>
        </View>

        <View style={styles.itemView}>
          <Text style={styles.labelText}>QR Code</Text>
          <View style={styles.valueView}>
            <TouchableItem onPress={handlePresentCodeModalPress}>
              <QRCode value={account.address} size={30} />
            </TouchableItem>
          </View>
        </View>

        <View style={styles.itemView}>
          <Text style={styles.labelText}>Source</Text>
          <View style={styles.valueView}>
            <Text>{account.brandName}</Text>
          </View>
        </View>

        <BottomSheetModal
          backdropComponent={renderBackdrop}
          ref={codeBottomSheetModalRef}
          snapPoints={[407]}
          onChange={handleCodeSheetChanges}>
          <BottomSheetView
            style={{
              paddingHorizontal: 45,
              paddingVertical: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 18,
            }}>
            <Text
              style={{
                fontSize: 15,
                color: colors['neutral-title-1'],
                textAlign: 'center',
              }}>
              {account.address}
            </Text>
            <View
              style={{
                borderRadius: 12,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: colors['neutral-line'],
                padding: 10,
              }}>
              <QRCode value={account.address} size={235} />
            </View>
          </BottomSheetView>
        </BottomSheetModal>

        <BottomSheetModal
          backdropComponent={renderBackdrop}
          ref={inputNameBottomSheetModalRef}
          snapPoints={[300]}
          onChange={handleCodeSheetChanges}>
          <BottomSheetView
            style={{
              paddingVertical: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 38,
            }}>
            <View
              style={{
                width: '100%',
                paddingHorizontal: 20,
                gap: 20,
              }}>
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: '500',
                  color: colors['neutral-title-1'],
                  textAlign: 'center',
                }}>
                Edit address note
              </Text>
              <BottomInput
                style={{
                  width: '100%',
                  height: 52,
                  borderColor: colors['neutral-line'],
                  borderWidth: StyleSheet.hairlineWidth,
                  borderRadius: 6,
                  paddingHorizontal: 16,
                  fontSize: 14,
                  fontWeight: '500',
                  color: colors['neutral-title-1'],
                  backgroundColor: colors['neutral-card-2'],
                }}
                value={aliasPendingName}
                onChangeText={setAliasPendingName}
              />
            </View>
            <View
              style={{
                width: '100%',
                maxWidth: Dimensions.get('window').width,
                display: 'flex',
                flexDirection: 'row',
                gap: 16,
                justifyContent: 'space-between',
                borderTopColor: colors['neutral-line'],
                borderTopWidth: StyleSheet.hairlineWidth,
                paddingTop: 20,
                paddingHorizontal: 20,
              }}>
              <Button
                onPress={handleCloseInputModalPress}
                title={'Cancel'}
                containerStyle={{
                  flexGrow: 1,
                  display: 'flex',
                  height: 52,
                  justifyContent: 'center',
                  alignItems: 'center',
                  borderBlockColor: colors['blue-default'],
                  borderWidth: StyleSheet.hairlineWidth,
                  borderRadius: 8,
                }}
                titleStyle={{
                  color: colors['blue-default'],
                }}>
                Cancel
              </Button>
              <Button
                title={'Confirm'}
                titleStyle={{
                  color: colors['neutral-title-2'],
                  backgroundColor: colors['blue-default'],
                }}
                onPress={changeAddressNote}
                containerStyle={{
                  flexGrow: 1,
                  display: 'flex',
                  height: 52,
                  justifyContent: 'center',
                  alignItems: 'center',
                  backgroundColor: colors['blue-default'],
                  borderRadius: 8,
                }}>
                Confirm
              </Button>
            </View>
          </BottomSheetView>
        </BottomSheetModal>

        <BottomSheetModal
          backdropComponent={renderBackdrop}
          ref={deleteBottomSheetModalRef}
          snapPoints={[300]}
          onChange={handleCodeSheetChanges}>
          <BottomSheetView
            style={{
              paddingVertical: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 38,
            }}>
            <View
              style={{
                width: '100%',
                paddingHorizontal: 20,
                gap: 20,
              }}>
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: '500',
                  color: colors['neutral-title-1'],
                  textAlign: 'center',
                }}>
                Delete address{' '}
              </Text>
              <Text
                style={{
                  width: '100%',
                  color: colors['neutral-body'],
                  fontSize: 14,
                  fontWeight: '400',
                }}>
                This address is a {account.brandName}, Rabby does not store the
                private key or seed phrase for this address, you can just delete
                it.
              </Text>
            </View>
            <View
              style={{
                width: '100%',
                maxWidth: Dimensions.get('window').width,
                display: 'flex',
                flexDirection: 'row',
                gap: 16,
                justifyContent: 'space-between',
                borderTopColor: colors['neutral-line'],
                borderTopWidth: StyleSheet.hairlineWidth,
                paddingTop: 20,
                paddingHorizontal: 20,
              }}>
              <Button
                onPress={handleCloseDeleteModalPress}
                title={'Cancel'}
                containerStyle={{
                  flexGrow: 1,
                  display: 'flex',
                  height: 52,
                  justifyContent: 'center',
                  alignItems: 'center',
                  borderColor: colors['blue-default'],
                  borderWidth: StyleSheet.hairlineWidth,
                  borderRadius: 8,
                }}
                titleStyle={{
                  color: colors['blue-default'],
                }}>
                Cancel
              </Button>
              <Button
                onPress={handleDelete}
                title={'Confirm'}
                titleStyle={{
                  color: colors['neutral-title-2'],
                  backgroundColor: colors['blue-default'],
                }}
                containerStyle={{
                  flexGrow: 1,
                  display: 'flex',
                  height: 52,
                  justifyContent: 'center',
                  alignItems: 'center',
                  backgroundColor: colors['blue-default'],
                  borderRadius: 8,
                }}>
                Confirm
              </Button>
            </View>
          </BottomSheetView>
        </BottomSheetModal>
      </View>
      <View style={styles.view}>
        <View style={styles.itemView}>
          <Text style={styles.labelText}>Add to Whitelist</Text>
          <View style={styles.valueView}>
            <Switch
              trackColor={{
                false: colors['neutral-line'],
                true: colors['blue-default'],
              }}
              thumbColor={colors['neutral-title-2']}
              onValueChange={setInWhitelist}
              value={inWhiteList}
            />
          </View>
        </View>
      </View>

      <View style={styles.view}>
        <View style={styles.itemView}>
          <Text style={styles.labelText}>Pin in list</Text>
          <View style={styles.valueView}>
            <Switch
              trackColor={{
                false: colors['neutral-line'],
                true: colors['blue-default'],
              }}
              thumbColor={colors['neutral-title-2']}
              onValueChange={setPinned}
              value={pinned}
            />
          </View>
        </View>
      </View>

      <TouchableOpacity
        style={styles.view}
        onPress={handlePresentDeleteModalPress}>
        <View style={styles.itemView}>
          <Text style={[styles.labelText, { color: colors['red-default'] }]}>
            Delete Address{' '}
          </Text>
          <View style={styles.valueView}>
            <RcIconRightCC
              style={{
                width: 20,
                height: 20,
              }}
              color={colors['neutral-foot']}
            />
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
};

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    view: {
      width: '100%',
      height: 'auto',
      backgroundColor: colors['neutral-card-1'],
      paddingHorizontal: 16,
      borderRadius: 8,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
    },
    itemView: {
      minHeight: 60,
      width: '100%',
      display: 'flex',
      flexDirection: 'row',
      // flexWrap: 'wrap',
      justifyContent: 'space-between',
      alignContent: 'center',
      alignItems: 'center',
      // paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors['neutral-line'],
    },
    valueView: {
      display: 'flex',
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    labelText: {
      fontSize: 16,
      fontWeight: '500',
      color: colors['neutral-title-1'],
    },
    valueText: {
      fontSize: 14,
      color: colors['neutral-body'],
    },
    entryItem: {
      borderRadius: 6,
      backgroundColor: '#FFF',
      width: '100%',
      paddingHorizontal: 16,
      paddingVertical: 14,
      flexDirection: 'row',
      alignItems: 'center',
    },
    keyringIcon: {
      width: 28,
      height: 28,
    },
    entryTitle: {
      fontSize: 16,
      fontStyle: 'normal',
      fontWeight: '500',
    },
    entrySubTitle: {
      fontSize: 12,
      fontStyle: 'normal',
      fontWeight: '500',
    },
  });

export default AddressDetailScreen;
