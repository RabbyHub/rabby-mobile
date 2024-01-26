import React, { useCallback, useMemo, useRef, useState } from 'react';
import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';

import {
  Dimensions,
  StyleSheet,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useThemeColors } from '@/hooks/theme';

import { RcIconCopyCC, RcIconRightCC } from '@/assets/icons/common';
import { AppColorsVariants } from '@/constant/theme';
import TouchableItem from '@/components/Touchable/TouchableItem';
import {
  KeyringAccountWithAlias,
  useAccounts,
  usePinAddresses,
  useRemoveAccount,
} from '@/hooks/account';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppSwitch, Button, Text } from '@/components';
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
import { getWalletIcon } from '@/utils/walletInfo';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';

import { SessionStatusBar } from '@/components/WalletConnect/SessionStatusBar';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { Pressable } from 'react-native';

const BottomInput = BottomSheetTextInput;

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
  const { address, type, brandName } = props.route.params;
  const { accounts } = useAccounts();
  const account = useMemo(
    () =>
      accounts.find(
        e =>
          addressUtils.isSameAddress(e.address, address) &&
          e.brandName === brandName &&
          e.type === type,
      ),
    [accounts, address, type, brandName],
  );

  return (
    <NormalScreenContainer>
      <ScrollView style={{ backgroundColor: colors['neutral-bg-2'] }}>
        {account && <AddressInfo account={account} />}
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
  // const { width, height } = useWindowDimensions();
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

  const WalletIcon = useMemo(() => getWalletIcon(account), [account]);

  const codeBottomSheetModalRef = useRef<BottomSheetModal>(null);

  const inputNameBottomSheetModalRef = useRef<BottomSheetModal>(null);

  const deleteBottomSheetModalRef = useRef<BottomSheetModal>(null);

  const handlePresentCodeModalPress = useCallback(() => {
    codeBottomSheetModalRef.current?.present();
  }, []);

  const handlePresentInputModalPress = useCallback(() => {
    setAliasPendingName(aliasName || '');
    inputNameBottomSheetModalRef.current?.present();
  }, [aliasName]);

  const handlePresentDeleteModalPress = useCallback(() => {
    deleteBottomSheetModalRef.current?.present();
  }, []);

  const handleCloseInputModalPress = useCallback(() => {
    inputNameBottomSheetModalRef.current?.close();
  }, []);

  const handleCloseDeleteModalPress = useCallback(() => {
    deleteBottomSheetModalRef.current?.close();
  }, []);

  const removeAccount = useRemoveAccount();

  const handleDelete = useCallback(async () => {
    await removeAccount(account);
    handleCloseDeleteModalPress();
    navigation.goBack();
  }, [account, handleCloseDeleteModalPress, navigation, removeAccount]);

  const changeAddressNote = useCallback(() => {
    setAliasName(aliasPendingName);
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
    <View style={{ gap: 20, paddingHorizontal: 20, paddingTop: 8 }}>
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
            <Text style={styles.valueText} textBreakStrategy="simple">
              {account.address}
              <Text>
                <RcIconCopyCC
                  color={colors['neutral-foot']}
                  height={14}
                  width={14}
                />
              </Text>
            </Text>
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
        <View
          style={{
            flex: 1,
            width: '100%',
            paddingVertical: 20,
            gap: 10,
          }}>
          <View
            style={[styles.itemView, styles.noBOrderBottom, { minHeight: 0 }]}>
            <Text style={styles.labelText}>Source</Text>
            <View
              style={StyleSheet.compose(styles.valueView, {
                alignItems: 'center',
              })}>
              <WalletIcon style={{ width: 20, height: 20, marginRight: 6 }} />
              <Text
                style={{
                  fontSize: 16,
                  color: colors['neutral-body'],
                }}>
                {account.brandName}
              </Text>
            </View>
          </View>
          {account.type === KEYRING_TYPE.WalletConnectKeyring && (
            <View>
              <SessionStatusBar
                address={account.address}
                brandName={account.brandName}
                bgColor={colors['neutral-card2']}
                textColor={colors['neutral-title-1']}
              />
            </View>
          )}
        </View>

        <AppBottomSheetModal
          backdropComponent={renderBackdrop}
          ref={codeBottomSheetModalRef}
          snapPoints={[407]}>
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
        </AppBottomSheetModal>

        <AppBottomSheetModal
          backdropComponent={renderBackdrop}
          ref={inputNameBottomSheetModalRef}
          keyboardBlurBehavior="restore"
          snapPoints={[300]}>
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
                buttonStyle={[styles.buttonStyle]}
                titleStyle={styles.btnCancelTitle}
                containerStyle={[
                  styles.btnContainer,
                  styles.btnCancelContainer,
                ]}>
                Cancel
              </Button>
              <Button
                title={'Confirm'}
                buttonStyle={[
                  styles.buttonStyle,
                  { backgroundColor: colors['blue-default'] },
                ]}
                titleStyle={styles.btnConfirmTitle}
                onPress={changeAddressNote}
                containerStyle={[
                  styles.btnContainer,
                  styles.btnConfirmContainer,
                ]}>
                Confirm
              </Button>
            </View>
          </BottomSheetView>
        </AppBottomSheetModal>

        <AppBottomSheetModal
          backdropComponent={renderBackdrop}
          ref={deleteBottomSheetModalRef}
          snapPoints={[300]}>
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
                Delete Address{' '}
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
                buttonStyle={[styles.buttonStyle]}
                titleStyle={styles.btnCancelTitle}
                containerStyle={[
                  styles.btnContainer,
                  styles.btnCancelContainer,
                ]}>
                Cancel
              </Button>
              <Button
                onPress={handleDelete}
                title={'Confirm'}
                buttonStyle={[
                  styles.buttonStyle,
                  { backgroundColor: colors['red-default'] },
                ]}
                titleStyle={styles.btnConfirmTitle}
                containerStyle={[
                  styles.btnContainer,
                  styles.btnConfirmContainer,
                ]}>
                Confirm
              </Button>
            </View>
          </BottomSheetView>
        </AppBottomSheetModal>
      </View>
      <View style={styles.view}>
        <View
          style={StyleSheet.flatten([styles.itemView, styles.noBOrderBottom])}>
          <Text style={styles.labelText}>Add to Whitelist</Text>
          <View style={styles.valueView}>
            <AppSwitch onValueChange={setInWhitelist} value={inWhiteList} />
          </View>
        </View>
      </View>

      <View style={styles.view}>
        <View
          style={StyleSheet.compose(styles.itemView, styles.noBOrderBottom)}>
          <Text style={styles.labelText}>Pin in list</Text>
          <View style={styles.valueView}>
            <AppSwitch onValueChange={setPinned} value={pinned} />
          </View>
        </View>
      </View>

      <TouchableOpacity
        style={styles.view}
        onPress={handlePresentDeleteModalPress}>
        <View
          style={StyleSheet.compose(styles.itemView, styles.noBOrderBottom)}>
          <Text
            style={StyleSheet.flatten([styles.labelText, styles.deleteColor])}>
            Delete Address{' '}
          </Text>
          <View style={styles.valueView}>
            <RcIconRightCC
              style={styles.rightIcon}
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
      justifyContent: 'space-between',
      alignContent: 'center',
      alignItems: 'center',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors['neutral-line'],
    },
    deleteColor: {
      color: colors['red-default'],
    },
    noBOrderBottom: {
      borderBottomWidth: 0,
    },
    valueView: {
      display: 'flex',
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 2,
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
    rightIcon: {
      width: 20,
      height: 20,
    },
    btnContainer: {
      flexShrink: 1,
      display: 'flex',
      height: 52,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 8,
    },
    buttonStyle: {
      width: '100%',
      height: '100%',
    },
    btnCancelContainer: {
      borderColor: colors['blue-default'],
      borderWidth: StyleSheet.hairlineWidth,
    },
    btnCancelTitle: {
      color: colors['blue-default'],
      flex: 1,
    },
    btnConfirmContainer: {},
    btnConfirmTitle: {
      color: colors['neutral-title-2'],
      flex: 1,
    },
  });

export default AddressDetailScreen;
