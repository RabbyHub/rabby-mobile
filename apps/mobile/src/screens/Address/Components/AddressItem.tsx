import { useCallback, useMemo, useRef } from 'react';
import { Animated, StyleSheet, TouchableOpacity, View } from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { RectButton } from 'react-native-gesture-handler';
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
import { Colors } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import { RcIconCopyCC, RcIconInfoCC } from '@/assets/icons/common';
import { ellipsisAddress } from '@/utils/address';
import { KeyringAccountWithAlias } from '@/hooks/account';
import { useNavigation } from '@react-navigation/native';
import { RootNames } from '@/constant/layout';

interface AddressItemProps {
  wallet: KeyringAccountWithAlias;
  isCurrentAddress?: boolean;
}
export const AddressItem = (props: AddressItemProps) => {
  const { wallet, isCurrentAddress } = props;
  const themeColors = useThemeColors();
  const styles = useMemo(() => getStyles(themeColors), [themeColors]);
  const navigation = useNavigation<any>();

  const walletName = wallet?.aliasName || wallet?.brandName;
  const walletNameIndex = '';
  const address = ellipsisAddress(wallet.address);
  const usdValue = '$4,332,241';
  const inWhitelist = true;
  const pinned = true;

  const copyAddress = useCallback(() => {
    Clipboard.setString(address);
  }, [address]);

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

  const handleSwitch = useCallback(() => {
    if (isCurrentAddress) {
      gotoAddressDetail();
    } else {
      // TODO:switch account
      // navigation.push(RootNames.AccountTransaction, {
      //   screen: RootNames.MyBundle,
      //   params: {},
      // });
    }
  }, [isCurrentAddress, gotoAddressDetail]);

  const swipeRef = useRef<Swipeable>(null);

  const renderRightAction = (
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
        //TODO:handle delete
      }
      if (type === 'pin') {
        //TODO:handle pin
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
  };
  return (
    <Swipeable
      ref={swipeRef}
      containerStyle={StyleSheet.compose(
        styles.swipeContainer,
        isCurrentAddress && styles.currentAddressView,
      )}
      enableTrackpadTwoFingerGesture
      rightThreshold={40}
      overshootRight={false}
      renderRightActions={
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
            )
      }>
      <TouchableOpacity
        onPress={handleSwitch}
        style={StyleSheet.compose(
          styles.box,
          isCurrentAddress && styles.currentAddressView,
        )}>
        <View style={styles.innerView}>
          <RcIconWatchAddress style={styles.walletLogo} />
          <View>
            <View>
              <View style={styles.titleView}>
                <Text
                  style={StyleSheet.compose(
                    styles.title,
                    isCurrentAddress && styles.currentAddressText,
                  )}>
                  {walletName}
                </Text>
                {!!walletNameIndex && !isCurrentAddress && (
                  <Text
                    style={StyleSheet.compose(
                      styles.walletIndexText,
                      isCurrentAddress && styles.currentAddressText,
                    )}>
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
              <Text
                style={StyleSheet.compose(
                  styles.text,
                  isCurrentAddress && styles.currentAddressText,
                )}>
                {address}
              </Text>
              <RcIconCopyCC
                style={styles.copyIcon}
                onPress={copyAddress}
                color={
                  isCurrentAddress
                    ? themeColors['neutral-title-2']
                    : themeColors['neutral-foot']
                }
              />
              {!isCurrentAddress && (
                <Text
                  style={StyleSheet.compose(
                    styles.text,
                    isCurrentAddress && styles.currentAddressText,
                  )}>
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
                  fontSize: 16,
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
            <TouchableOpacity
              style={styles.infoIcon}
              onPress={gotoAddressDetail}>
              <RcIconInfoCC
                style={styles.infoIcon}
                color={themeColors['neutral-foot']}
              />
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    </Swipeable>
  );
};

const getStyles = (colors: Colors) => {
  return StyleSheet.create({
    swipeContainer: {
      width: '100%',
      borderRadius: 8,
      opacity: 1,
    },
    box: {
      paddingLeft: 16,
      paddingRight: 16,
      minHeight: 64,
      backgroundColor: colors['neutral-card-1'],
    },
    innerView: {
      flex: 1,
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
    },
    currentAddressView: {
      backgroundColor: colors['blue-default'],
    },
    currentAddressText: {
      color: colors['neutral-title-2'],
    },
    walletLogo: {
      width: 32,
      height: 32,
      borderRadius: 32,
      marginRight: 12,
    },
    copyIcon: {
      marginLeft: 4,
      marginRight: 12,
      width: 14,
      height: 14,
    },
    infoIcon: {
      marginLeft: 'auto',
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
      color: colors['neutral-title-1'],
      fontSize: 16,
      fontWeight: '600',
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
    },
    text: {
      color: colors['neutral-body'],
      fontSize: 14,
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
