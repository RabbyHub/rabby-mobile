import { useCallback, useMemo, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { RectButton, TouchableOpacity } from 'react-native-gesture-handler';

import { RcIconAddressDelete, RcIconAddressPin } from '@/assets/icons/address';
import { useThemeColors } from '@/hooks/theme';
import {
  KeyringAccountWithAlias,
  useCurrentAccount,
  usePinAddresses,
  useRemoveAccount,
} from '@/hooks/account';
import { useNavigation } from '@react-navigation/native';
import { RootNames } from '@/constant/layout';
import { navigate } from '@/utils/navigation';
import { KEYRING_TYPE } from '../../../../../../packages/keyring-utils/src/types';
import { SessionStatusBar } from '@/components/WalletConnect/SessionStatusBar';
import { AddressItemInner, getStyles } from './AddressItemInner';

interface AddressItemProps {
  wallet: KeyringAccountWithAlias;
  isCurrentAddress?: boolean;
  isInModal?: boolean;
}
export const AddressItem = (props: AddressItemProps) => {
  const { wallet, isCurrentAddress, isInModal } = props;
  const { switchAccount } = useCurrentAccount();

  const themeColors = useThemeColors();
  const styles = useMemo(() => getStyles(themeColors), [themeColors]);
  const navigation = useNavigation<any>();

  const isWalletConnect = wallet?.type === KEYRING_TYPE.WalletConnectKeyring;

  const removeAccount = useRemoveAccount();
  const { togglePinAddressAsync } = usePinAddresses({
    disableAutoFetch: false,
  });

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

  const disableDeleteButton =
    wallet.type === KEYRING_TYPE.SimpleKeyring ||
    wallet.type === KEYRING_TYPE.HdKeyring;

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
                    width: disableDeleteButton ? 56 : 112,
                    flexDirection: 'row',
                  }}>
                  {renderRightAction(
                    'pin',
                    themeColors['blue-default'],
                    112,
                    progress,
                  )}
                  {!disableDeleteButton &&
                    renderRightAction(
                      'delete',
                      themeColors['red-default'],
                      56,
                      progress,
                    )}
                </View>
              ),
        [disableDeleteButton, isCurrentAddress, renderRightAction, themeColors],
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
        <AddressItemInner
          wallet={wallet}
          isCurrentAddress={isCurrentAddress}
          isInModal={isInModal}
        />

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
