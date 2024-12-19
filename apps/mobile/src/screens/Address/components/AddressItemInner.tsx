import { useCallback, useMemo } from 'react';
import { GestureResponderEvent, StyleSheet, View } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import Clipboard from '@react-native-clipboard/clipboard';

import {
  RcIconAddressBoldRight,
  RcIconAddressPinned,
  RcIconAddressWhitelistCC,
} from '@/assets/icons/address';
import { Text } from '@/components';
import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import { RcIconCopyCC, RcIconInfoCC } from '@/assets/icons/common';
import { ellipsisAddress } from '@/utils/address';
import { KeyringAccountWithAlias, usePinAddresses } from '@/hooks/account';
import { useNavigation } from '@react-navigation/native';
import { RootNames } from '@/constant/layout';
import { getWalletIcon } from '@/utils/walletInfo';
import { useWhitelist } from '@/hooks/whitelist';
import { addressUtils } from '@rabby-wallet/base-utils';
import { splitNumberByStep } from '@/utils/number';
import { KEYRING_TYPE } from '../../../../../../packages/keyring-utils/src/types';
import { toastCopyAddressSuccess } from '@/components/AddressViewer/CopyAddress';
import { makeDebugBorder } from '@/utils/styles';

interface AddressItemProps {
  wallet: KeyringAccountWithAlias;
  isCurrentAddress?: boolean;
  isInModal?: boolean;
  isInList?: boolean;
  showUsd?: boolean;
}
export const AddressItemInner = (props: AddressItemProps) => {
  const {
    wallet,
    isCurrentAddress,
    isInModal,
    isInList,
    showUsd = true,
  } = props;
  const { isAddrOnWhitelist } = useWhitelist();

  const themeColors = useThemeColors();
  const styles = useMemo(() => getStyles(themeColors), [themeColors]);
  const navigation = useNavigation<any>();

  const isWalletConnect = wallet?.type === KEYRING_TYPE.WalletConnectKeyring;

  const walletName = wallet?.aliasName || wallet?.brandName;
  const walletNameIndex = '';
  const address = ellipsisAddress(wallet.address);
  const usdValue = `$${splitNumberByStep(wallet.balance?.toFixed(2) || 0)}`;
  const inWhitelist = useMemo(
    () => isAddrOnWhitelist(wallet.address),
    [isAddrOnWhitelist, wallet.address],
  );
  const { pinAddresses } = usePinAddresses({
    disableAutoFetch: false,
  });
  const pinned = useMemo(
    () =>
      pinAddresses.some(
        e =>
          addressUtils.isSameAddress(e.address, wallet.address) &&
          e.brandName === wallet.brandName,
      ),
    [pinAddresses, wallet],
  );

  const WalletIcon = useMemo(() => {
    return getWalletIcon(wallet.brandName, isCurrentAddress);
  }, [wallet.brandName, isCurrentAddress]);

  const copyAddress = useCallback(
    (e?: GestureResponderEvent) => {
      e?.stopPropagation();
      Clipboard.setString(wallet.address);
      toastCopyAddressSuccess(wallet.address);
    },
    [wallet.address],
  );

  const gotoAddressDetail = useCallback(() => {
    navigation.push(RootNames.StackAddress, {
      screen: RootNames.AddressDetail,
      params: {
        address: wallet.address,
        type: wallet.type,
        brandName: wallet.brandName,
      },
    });
  }, [navigation, wallet.address, wallet.type, wallet.brandName]);

  return (
    <View
      style={StyleSheet.compose(
        styles.innerView,
        isCurrentAddress &&
          isWalletConnect && {
            flexShrink: 0,
          },
      )}>
      <View
        style={{
          position: 'relative',
          marginRight: 12,
        }}>
        <WalletIcon
          width={styles.walletLogo.width}
          height={styles.walletLogo.height}
          style={styles.walletLogo}
        />
      </View>
      <View style={styles.centerInner}>
        <View style={styles.titleView}>
          <View style={styles.titleTextArea}>
            <Text
              style={StyleSheet.flatten([
                styles.title,
                isCurrentAddress && styles.currentAddressText,
              ])}
              numberOfLines={1}>
              {walletName}
            </Text>
            {!!walletNameIndex && !isCurrentAddress && (
              <Text style={StyleSheet.flatten([styles.walletIndexText])}>
                #{walletNameIndex}
              </Text>
            )}
          </View>

          <View style={styles.titleIconArea}>
            {inWhitelist && (
              <RcIconAddressWhitelistCC
                style={styles.tagIcon}
                color={
                  isCurrentAddress
                    ? themeColors['neutral-title-2']
                    : themeColors['neutral-foot']
                }
              />
            )}
            {pinned && <RcIconAddressPinned style={styles.tagIcon} />}
          </View>
        </View>

        <View style={styles.addressBox}>
          <TouchableOpacity onPress={copyAddress}>
            <Text
              style={StyleSheet.flatten([
                styles.text,
                isCurrentAddress && styles.currentAddressText,
              ])}>
              {address}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={copyAddress}>
            <RcIconCopyCC
              style={styles.copyIcon}
              color={
                isCurrentAddress
                  ? themeColors['neutral-title-2']
                  : themeColors['neutral-foot']
              }
            />
          </TouchableOpacity>
          {!isCurrentAddress && showUsd && (
            <Text
              style={StyleSheet.flatten([
                styles.text,
                isCurrentAddress && styles.currentAddressText,
              ])}>
              {usdValue}
            </Text>
          )}
        </View>
      </View>
      {isInModal ? null : isCurrentAddress || isInList ? (
        <View style={styles.usdInfoWrapper}>
          <Text
            style={{
              color: isInList
                ? themeColors['neutral-body']
                : themeColors['neutral-title-2'],
              fontSize: 15,
              fontWeight: '500',
            }}>
            {usdValue}
          </Text>
          <RcIconAddressBoldRight
            style={{
              width: 20,
              height: 20,
            }}
          />
        </View>
      ) : (
        <View style={styles.infoIconWrapper}>
          <TouchableOpacity
            style={styles.infoIconWrapper}
            onPress={gotoAddressDetail}>
            <RcIconInfoCC
              style={styles.infoIcon}
              color={themeColors['neutral-foot']}
            />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

export const getStyles = (colors: AppColorsVariants) => {
  return StyleSheet.create({
    swipeContainer: {
      width: '100%',
      borderRadius: 8,
      opacity: 1,
    },
    box: {
      width: '100%',
      paddingLeft: 16,
      paddingRight: 16,
      minHeight: 64,
      backgroundColor: colors['neutral-card-1'],
      justifyContent: 'center',
    },
    innerView: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
    },
    currentAddressView: {
      backgroundColor: colors['blue-default'],
    },
    isWalletConnect: {
      height: 118,
      gap: 16,
    },
    currentAddressText: {
      color: colors['neutral-title-2'],
    },
    walletLogo: {
      width: 32,
      height: 32,
      borderRadius: 32,
    },
    copyIcon: {
      marginLeft: 4,
      marginRight: 12,
      width: 14,
      height: 14,
    },
    usdInfoWrapper: {
      marginLeft: 'auto',
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
    },
    infoIconWrapper: {
      marginLeft: 'auto',
      flexShrink: 0,
      width: 32,
      height: 64,
      justifyContent: 'center',
      alignItems: 'center',
    },
    infoIcon: {
      width: 20,
      height: 20,
      borderRadius: 20,
    },
    tagIcon: {
      width: 16,
      height: 16,
    },
    centerInner: {
      flexShrink: 1,
    },
    titleView: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
      gap: 2,
      flexShrink: 1,
      width: '100%',
      paddingRight: 8,
      // ...makeDebugBorder(),
    },
    titleTextArea: {
      flexShrink: 1,
      maxWidth: '100%',
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'flex-start',
    },
    titleIconArea: {
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'flex-start',
      // ...makeDebugBorder('green'),
    },
    title: {
      fontSize: 15,
      fontWeight: '600',
      maxWidth: '100%',
      color: colors['neutral-title-1'],
      // ...makeDebugBorder('red'),
    },
    walletIndexText: {
      color: colors['neutral-foot'],
      fontSize: 14,
      fontWeight: '400',
      // ...makeDebugBorder('yellow'),
    },
    addressBox: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
      marginTop: 4,
    },
    text: {
      color: colors['neutral-body'],
      fontSize: 13,
      fontWeight: '400',
    },
    actionText: {
      color: 'white',
      fontSize: 16,
      backgroundColor: 'transparent',
      padding: 10,
    },
    actionIcon: {
      width: 24,
      height: 24,
    },
  });
};
