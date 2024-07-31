import React, { useCallback, useMemo, useRef, useState } from 'react';
import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';

import { Dimensions, StyleSheet, TouchableOpacity, View } from 'react-native';
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
import { ScrollView, TextInput } from 'react-native-gesture-handler';
import {
  CompositeScreenProps,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import Clipboard from '@react-native-clipboard/clipboard';
import { useWhitelist } from '@/hooks/whitelist';
import { addressUtils } from '@rabby-wallet/base-utils';
import { useAlias } from '@/hooks/alias';
import { splitNumberByStep } from '@/utils/number';
import { getWalletIcon } from '@/utils/walletInfo';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';

import { SessionStatusBar } from '@/components/WalletConnect/SessionStatusBar';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import {
  AddressNavigatorParamList,
  RootStackParamsList,
} from '@/navigation-type';
import { toastCopyAddressSuccess } from '@/components/AddressViewer/CopyAddress';
import { GnosisSafeInfo } from './components/GnosisSafeInfo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { navigate } from '@/utils/navigation';
import { RootNames } from '@/constant/layout';
import { AuthenticationModal } from '@/components/AuthenticationModal/AuthenticationModal';
import { useTranslation } from 'react-i18next';
import { apiMnemonic, apiPrivateKey, apisLock } from '@/core/apis';
import { useAccountInfo } from '@/hooks/useAccountInfo';
import { useEnterPassphraseModal } from '@/hooks/useEnterPassphraseModal';
import { useAddressSource } from '@/hooks/useAddressSource';
import { SeedPhraseBar } from './components/SeedPhraseBar';
import { RefreshAutoLockBottomSheetBackdrop } from '@/components/patches/refreshAutoLockUI';

const BottomInput = BottomSheetTextInput;

type AddressDetailProps = CompositeScreenProps<
  NativeStackScreenProps<AddressNavigatorParamList, 'AddressDetail'>,
  NativeStackScreenProps<RootStackParamsList>
>;

function AddressDetailScreen(): JSX.Element {
  const colors = useThemeColors();
  const { params } = useRoute<AddressDetailProps['route']>();

  const { address, type, brandName } = params;
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
  const navigation = useNavigation<AddressDetailProps['navigation']>();
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [aliasName, setAliasName] = useAlias(account.address);
  const { t } = useTranslation();

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

  const WalletIcon = useMemo(() => getWalletIcon(account.brandName), [account]);

  const codeBottomSheetModalRef = useRef<BottomSheetModal>(null);

  const inputNameBottomSheetModalRef = useRef<BottomSheetModal>(null);

  const inputRef = useRef<TextInput>(null);

  const deleteBottomSheetModalRef = useRef<BottomSheetModal>(null);

  const handlePresentCodeModalPress = useCallback(() => {
    codeBottomSheetModalRef.current?.present();
  }, []);

  const handlePresentInputModalPress = useCallback(() => {
    setAliasPendingName(aliasName || '');
    inputNameBottomSheetModalRef.current?.present();
    setTimeout(() => {
      inputRef.current?.focus();
    }, 10);
  }, [aliasName]);

  const handleCloseInputModalPress = useCallback(() => {
    inputNameBottomSheetModalRef.current?.close();
  }, []);

  const handleCloseDeleteModalPress = useCallback(() => {
    deleteBottomSheetModalRef.current?.close();
  }, []);

  const removeAccount = useRemoveAccount();

  const handleDelete = useCallback(async () => {
    try {
      await removeAccount(account);
      handleCloseDeleteModalPress();
      navigation.goBack();
    } catch (error) {
      console.log('handleDelete', error);
    }
  }, [account, handleCloseDeleteModalPress, navigation, removeAccount]);

  const invokeEnterPassphrase = useEnterPassphraseModal('address');
  const handlePresentDeleteModalPress = useCallback(async () => {
    const count =
      account.type === KEYRING_TYPE.HdKeyring
        ? (await apiMnemonic.getKeyringAccountsByAddress(account.address))
            .length
        : 1;
    const title =
      account.type === KEYRING_TYPE.SimpleKeyring
        ? 'Delete Address and Private Key'
        : account.type === KEYRING_TYPE.HdKeyring && count <= 1
        ? 'Delete Address and Seed Phrase'
        : 'Delete Address';
    const needAuth =
      account.type === KEYRING_TYPE.SimpleKeyring ||
      (account.type === KEYRING_TYPE.HdKeyring && count <= 1);

    AuthenticationModal.show({
      confirmText: t('page.manageAddress.confirm'),
      cancelText: t('page.manageAddress.cancel'),
      title,
      description: needAuth
        ? t('page.addressDetail.delete-desc-needpassword')
        : t('page.addressDetail.delete-desc'),
      checklist: needAuth
        ? [
            t('page.manageAddress.delete-checklist-1'),
            t('page.manageAddress.delete-checklist-2'),
          ]
        : undefined,
      ...(!needAuth
        ? { authType: ['none'] }
        : { authType: ['biometrics', 'password'] }),
      onFinished: handleDelete,
      validationHandler: async (password: string) => {
        await apisLock.throwErrorIfInvalidPwd(password);

        if (account.type === KEYRING_TYPE.HdKeyring) {
          await invokeEnterPassphrase(account.address);
        }
      },
    });
  }, [account, handleDelete, invokeEnterPassphrase, t]);

  const changeAddressNote = useCallback(() => {
    setAliasName(aliasPendingName);
    handleCloseInputModalPress();
  }, [aliasPendingName, handleCloseInputModalPress, setAliasName]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <RefreshAutoLockBottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
      />
    ),
    [],
  );

  const { bottom } = useSafeAreaInsets();

  const handlePressBackupPrivateKey = useCallback(() => {
    let data = '';

    AuthenticationModal.show({
      confirmText: t('global.confirm'),
      cancelText: t('global.Cancel'),
      title: t('page.addressDetail.backup-private-key'),
      validationHandler: async (password: string) => {
        data = await apiPrivateKey.getPrivateKey(password, {
          address: account.address,
          type: account.type,
        });

        if (account.type === KEYRING_TYPE.HdKeyring) {
          await invokeEnterPassphrase(account.address);
        }
      },
      onFinished(ctx) {
        if (ctx.hasSetupCustomPassword && !data) {
          return;
        }
        navigate(RootNames.StackAddress, {
          screen: RootNames.BackupPrivateKey,
          params: {
            data,
          },
        });
      },
    });
  }, [account, invokeEnterPassphrase, t]);

  const handlePressBackupSeedPhrase = useCallback(() => {
    let data = '';

    AuthenticationModal.show({
      confirmText: t('global.confirm'),
      cancelText: t('global.Cancel'),
      title: t('page.addressDetail.backup-seed-phrase'),
      validationHandler: async (password: string) => {
        data = await apiMnemonic.getMnemonics(password, account.address);

        if (account.type === KEYRING_TYPE.HdKeyring) {
          await invokeEnterPassphrase(account.address);
        }
      },
      onFinished(ctx) {
        if (ctx.hasSetupCustomPassword && !data) {
          return;
        }
        navigate(RootNames.StackAddress, {
          screen: RootNames.BackupMnemonic,
          params: {
            data,
          },
        });
      },
    });
  }, [account, invokeEnterPassphrase, t]);

  const accountInfo = useAccountInfo(
    account.type,
    account.address,
    account.brandName,
  );

  const source = useAddressSource({
    type: account.type,
    brandName: account.brandName,
    byImport: (account as any).byImport,
    address: account.address,
  });

  return (
    <View
      style={{
        gap: 20,
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: bottom,
      }}>
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
          <Text style={styles.labelText}>
            {t('page.addressDetail.address')}
          </Text>
          <TouchableOpacity
            onPress={useCallback(() => {
              Clipboard.setString(account.address);
              toastCopyAddressSuccess(account.address);
            }, [account?.address])}
            style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap' }}>
            <Text style={styles.addrText} textBreakStrategy="simple">
              {account.address}
              <View style={styles.textIconWrapper}>
                <RcIconCopyCC
                  color={colors['neutral-foot']}
                  height={14}
                  width={14}
                  style={styles.textCopyIcon}
                />
              </View>
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.itemView}>
          <Text style={styles.labelText}>
            {t('page.addressDetail.address-note')}
          </Text>
          <TouchableOpacity
            style={styles.valueView}
            onPress={handlePresentInputModalPress}>
            <Text style={styles.valueText}>{aliasName || ''}</Text>
            <RcIconAddressDetailEdit color={colors['neutral-foot']} />
          </TouchableOpacity>
        </View>

        <View style={styles.itemView}>
          <Text style={styles.labelText}>{t('page.addressDetail.assets')}</Text>
          <View style={styles.valueView}>
            <Text style={styles.valueText}>{useValue}</Text>
          </View>
        </View>

        <View style={styles.itemView}>
          <Text style={styles.labelText}>
            {t('page.addressDetail.qr-code')}
          </Text>
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
            <Text style={styles.labelText}>
              {t('page.addressDetail.source')}
            </Text>
            <View
              style={StyleSheet.compose(styles.valueView, {
                alignItems: 'center',
              })}>
              <WalletIcon
                width={20}
                height={20}
                style={{ width: 20, height: 20 }}
              />
              <Text
                style={{
                  fontSize: 16,
                  color: colors['neutral-body'],
                }}>
                {source}
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
          {account.type === KEYRING_TYPE.HdKeyring && (
            <View
              style={StyleSheet.flatten([
                styles.itemView,
                {
                  minHeight: 0,
                  paddingBottom: 20,
                  marginBottom: -20,
                },
              ])}>
              <SeedPhraseBar address={account.address} />
            </View>
          )}
          {account.type === KEYRING_TYPE.GnosisKeyring ? (
            <View>
              <GnosisSafeInfo
                address={account.address}
                type={account.type}
                brandName={account.brandName}
              />
            </View>
          ) : null}
        </View>

        {accountInfo && (
          <View style={[styles.itemView, { borderBottomWidth: 0 }]}>
            <Text style={styles.labelText}>
              {t('page.addressDetail.hd-path')}
            </Text>
            <View style={styles.valueView}>
              <Text
                style={
                  styles.valueText
                }>{`${accountInfo.hdPathTypeLabel} #${accountInfo.index}`}</Text>
            </View>
          </View>
        )}

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
                defaultValue={aliasPendingName}
                onChangeText={setAliasPendingName}
                ref={inputRef}
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
        {account.type === KEYRING_TYPE.HdKeyring && (
          <TouchableOpacity
            style={StyleSheet.flatten([styles.itemView])}
            onPress={handlePressBackupSeedPhrase}>
            <Text style={styles.labelText}>
              {t('page.addressDetail.backup-seed-phrase')}
            </Text>
            <View style={styles.valueView}>
              <RcIconRightCC
                style={styles.rightIcon}
                color={colors['neutral-foot']}
              />
            </View>
          </TouchableOpacity>
        )}

        {(account.type === KEYRING_TYPE.SimpleKeyring ||
          account.type === KEYRING_TYPE.HdKeyring) && (
          <TouchableOpacity
            style={StyleSheet.flatten([styles.itemView, styles.noBOrderBottom])}
            onPress={handlePressBackupPrivateKey}>
            <Text style={styles.labelText}>
              {t('page.addressDetail.backup-private-key')}
            </Text>
            <View style={styles.valueView}>
              <RcIconRightCC
                style={styles.rightIcon}
                color={colors['neutral-foot']}
              />
            </View>
          </TouchableOpacity>
        )}
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
          style={StyleSheet.flatten([styles.itemView, styles.noBOrderBottom])}>
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
      gap: 6,
    },
    labelText: {
      fontSize: 16,
      fontWeight: '500',
      color: colors['neutral-title-1'],
    },
    valueText: {
      fontSize: 16,
      color: colors['neutral-body'],
    },
    addrText: {
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
      backgroundColor: 'transparent',
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
    textIconWrapper: {
      width: 18,
      height: 14,
      position: 'relative',
    },
    textCopyIcon: {
      position: 'absolute',
      width: 14,
      height: 14,
      left: 4,
      top: 1,
    },
  });

export default AddressDetailScreen;
