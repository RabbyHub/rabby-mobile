import { useCallback, useMemo, useRef } from 'react';
import {
  Animated,
  GestureResponderEvent,
  StyleSheet,
  View,
} from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { RectButton, TouchableOpacity } from 'react-native-gesture-handler';
import Clipboard from '@react-native-clipboard/clipboard';

import {
  RcIconAddressBoldRight,
  RcIconAddressDelete,
  RcIconAddressPin,
  RcIconAddressPinned,
  RcIconAddressWhitelistCC,
  RcIconWatchAddress,
} from '@/assets/icons/address';
import { Text } from '@/components';
import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import { RcIconCopyCC, RcIconInfoCC } from '@/assets/icons/common';
import { ellipsisAddress } from '@/utils/address';
import {
  KeyringAccountWithAlias,
  useCurrentAccount,
  usePinAddresses,
  useRemoveAccount,
} from '@/hooks/account';
import { useNavigation } from '@react-navigation/native';
import { RootNames } from '@/constant/layout';
import { getWalletIcon, WALLET_INFO } from '@/utils/walletInfo';
import { useWhitelist } from '@/hooks/whitelist';
import { addressUtils } from '@rabby-wallet/base-utils';
import { splitNumberByStep } from '@/utils/number';
import { navigate } from '@/utils/navigation';
import { CommonSignal } from '@/components/WalletConnect/SessionSignal';
import { KEYRING_TYPE } from '../../../../../../packages/keyring-utils/src/types';
import { SessionStatusBar } from '@/components/WalletConnect/SessionStatusBar';
import { toastCopyAddressSuccess } from '@/components/AddressViewer/CopyAddress';

interface AddressItemProps {
  wallet: KeyringAccountWithAlias;
  isCurrentAddress?: boolean;
}
export const AddressItem = (props: AddressItemProps) => {
  const { wallet, isCurrentAddress } = props;
  const { isAddrOnWhitelist } = useWhitelist();
  const { switchAccount } = useCurrentAccount();

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
  const removeAccount = useRemoveAccount();
  const { pinAddresses, togglePinAddressAsync } = usePinAddresses({
    disableAutoFetch: false,
  });
  const pinned = useMemo(
    () =>
      pinAddresses.some(e =>
        addressUtils.isSameAddress(e.address, wallet.address),
      ),
    [pinAddresses, wallet.address],
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
        // byImport: wallet?.byImport,
      },
    });
  }, [navigation, wallet.address, wallet.type, wallet.brandName]);

  const handleSwitch = useCallback(async () => {
    if (isCurrentAddress) {
      gotoAddressDetail();
    } else {
      switchAccount(wallet);
      navigate(RootNames.StackRoot, { screen: RootNames.Home });
    }
  }, [isCurrentAddress, gotoAddressDetail, switchAccount, wallet]);

  const swipeRef = useRef<Swipeable>(null);

  const renderRightAction = useCallback(
    (
      type: 'pin' | 'delete',
      color: string,
      x: number,
      progress: Animated.AnimatedInterpolation<number>,
    ) => {
      const trans = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [x, 0],
      });
      const pressHandler = () => {
        if (type === 'delete') {
          removeAccount(wallet);
        }
        if (type === 'pin') {
          togglePinAddressAsync({
            address: wallet.address,
            brandName: wallet.brandName,
          });
        }
        swipeRef.current?.close();
      };

      return (
        <Animated.View style={{ flex: 1, transform: [{ translateX: trans }] }}>
          <RectButton
            style={[styles.rightAction, { backgroundColor: color }]}
            onPress={pressHandler}>
            {type === 'pin' && <RcIconAddressPin style={styles.actionIcon} />}
            {type === 'delete' && (
              <RcIconAddressDelete style={styles.actionIcon} />
            )}
          </RectButton>
        </Animated.View>
      );
    },
    [
      styles.rightAction,
      styles.actionIcon,
      removeAccount,
      wallet,
      togglePinAddressAsync,
    ],
  );

  return (
    <Swipeable
      ref={swipeRef}
      containerStyle={StyleSheet.compose(
        styles.swipeContainer,
        isCurrentAddress && styles.currentAddressView,
      )}
      rightThreshold={40}
      overshootRight={false}
      renderRightActions={useMemo(
        () =>
          isCurrentAddress
            ? () => null
            : (
                progress: Animated.AnimatedInterpolation<number>,
                _dragAnimatedValue: Animated.AnimatedInterpolation<number>,
              ) => (
                <View
                  style={{
                    width: 112,
                    flexDirection: 'row',
                  }}>
                  {renderRightAction(
                    'pin',
                    themeColors['blue-default'],
                    112,
                    progress,
                  )}
                  {renderRightAction(
                    'delete',
                    themeColors['red-default'],
                    56,
                    progress,
                  )}
                </View>
              ),
        [isCurrentAddress, renderRightAction, themeColors],
      )}>
      <TouchableOpacity
        onPress={handleSwitch}
        style={StyleSheet.compose(
          styles.box,
          StyleSheet.compose(
            isCurrentAddress && styles.currentAddressView,
            isCurrentAddress && isWalletConnect && styles.isWalletConnect,
          ),
        )}>
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
            <CommonSignal
              address={wallet.address}
              brandName={wallet.brandName}
              type={wallet.type}
            />
          </View>
          <View>
            <View>
              <View style={styles.titleView}>
                <Text
                  style={StyleSheet.flatten([
                    styles.title,
                    isCurrentAddress && styles.currentAddressText,
                  ])}>
                  {walletName}
                </Text>
                {!!walletNameIndex && !isCurrentAddress && (
                  <Text
                    style={StyleSheet.flatten([
                      styles.walletIndexText,
                      isCurrentAddress && styles.currentAddressText,
                    ])}>
                    #{walletNameIndex}
                  </Text>
                )}

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
              {!isCurrentAddress && (
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
          {isCurrentAddress ? (
            <View
              style={{
                marginLeft: 'auto',
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
              }}>
              <Text
                style={{
                  color: themeColors['neutral-title-2'],
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

        {isCurrentAddress && isWalletConnect && (
          <SessionStatusBar
            address={wallet.address}
            brandName={wallet.brandName}
          />
        )}
      </TouchableOpacity>
    </Swipeable>
  );
};

const getStyles = (colors: AppColorsVariants) => {
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
    infoIconWrapper: {
      marginLeft: 'auto',
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
    titleView: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    title: {
      fontSize: 15,
      fontWeight: '600',
      color: colors['neutral-title-1'],
    },
    walletIndexText: {
      color: colors['neutral-foot'],
      fontSize: 14,
      fontWeight: '400',
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
    rightAction: {
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center',
    },
    actionIcon: {
      width: 24,
      height: 24,
    },
  });
};
