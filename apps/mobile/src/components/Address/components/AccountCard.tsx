import { View, Text, TouchableOpacity } from 'react-native';

import { useThemeStyles } from '@/hooks/theme';
import { createGetStyles, makeDebugBorder } from '@/utils/styles';
import { IDisplayedAccountWithBalance } from '@/hooks/accountToDisplay';
import { formatUsdValue } from '@/utils/number';
import { formatAddressToShow } from '@/utils/address';
import {
  RcIconCheckedFilledCC,
  RcIconUncheckCC,
  RcIconCopyCC,
} from '@/assets/icons/common';
import { RcIconAddressWhitelistCC } from '@/assets/icons/address';
import TouchableView from '@/components/Touchable/TouchableView';
import { WalletBrandImage } from '@/components/WalletBrandImage';
import Clipboard from '@react-native-clipboard/clipboard';
import { useCallback } from 'react';
import { toastCopyAddressSuccess } from '@/components/AddressViewer/CopyAddress';

export default function AccountCard({
  account,
  isEditing = false,
  inWhitelist = false,
  style,
  onPress,
}: RNViewProps & {
  account: IDisplayedAccountWithBalance;
  isEditing?: boolean;
  inWhitelist?: boolean;
  // disabled?: boolean;
  onPress?: (account: IDisplayedAccountWithBalance) => void;
}) {
  const { styles, colors, isLight } = useThemeStyles(getStyles);

  const handleCopyAddress = useCallback<
    React.ComponentProps<typeof TouchableOpacity>['onPress'] & object
  >(
    evt => {
      evt.stopPropagation();
      Clipboard.setString(account.address);
      toastCopyAddressSuccess(account.address);
    },
    [account?.address],
  );

  if (!account) {
    console.warn('AccountCard: account is null');
    return null;
  }

  const disabled = !inWhitelist && !isEditing;

  const Checkbox = inWhitelist ? RcIconCheckedFilledCC : RcIconUncheckCC;

  return (
    <TouchableView
      style={[styles.container, disabled && styles.notInWhitelist, style]}
      disabled={disabled}
      onPress={() => {
        onPress?.(account);
      }}>
      {isEditing && (
        <Checkbox
          color={isLight ? colors['blue-default'] : colors['neutral-foot']}
          style={styles.checkbox}
        />
      )}
      <View style={[styles.main]}>
        <View style={[styles.leftCol]}>
          <WalletBrandImage brandType={account.brandName} size={32} />

          <View style={styles.leftTextInfos}>
            <View style={styles.leftInnerLine}>
              <Text style={styles.name} numberOfLines={1}>
                {account.aliasName}
              </Text>
              {inWhitelist && (
                <RcIconAddressWhitelistCC
                  color={colors['neutral-foot']}
                  style={{ marginLeft: 4 }}
                />
              )}
            </View>
            <View style={styles.leftInnerLine}>
              <Text style={styles.addressText}>
                {formatAddressToShow(account.address)}
              </Text>

              <TouchableOpacity onPress={handleCopyAddress}>
                <RcIconCopyCC
                  color={colors['neutral-foot']}
                  style={{ marginLeft: 4 }}
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={[styles.rightCol]}>
          <Text style={styles.balanceText}>
            {formatUsdValue(account.balance)}
          </Text>
        </View>
      </View>
    </TouchableView>
  );
}

const getStyles = createGetStyles(colors => {
  return {
    container: {
      flexDirection: 'row',
      alignItems: 'center',
    },

    notInWhitelist: {
      opacity: 0.5,
    },

    checkbox: {
      width: 24,
      height: 24,

      marginRight: 12,
      flexShrink: 0,
    },

    main: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderRadius: 8,
      backgroundColor: colors['neutral-card2'],

      paddingVertical: 12,
      paddingHorizontal: 16,
      flexShrink: 1,
      width: '100%',
      // ...makeDebugBorder('green'),
    },

    leftCol: {
      flexDirection: 'row',
      alignItems: 'center',
      flexShrink: 1,
      maxWidth: '100%',
      // ...makeDebugBorder('yellow'),
    },

    leftTextInfos: {
      flexDirection: 'column',
      marginLeft: 12,
      flexShrink: 1,
      // ...makeDebugBorder(),
    },
    leftInnerLine: {
      marginTop: 4,
      flexDirection: 'row',
      alignItems: 'center',
      width: '100%',
      paddingRight: 8,
    },

    name: {
      // color: var(--r-neutral-title1, #192945);
      color: colors['neutral-title1'],
      fontSize: 16,
      fontStyle: 'normal',
      fontWeight: '500',
      maxWidth: '100%',
      flexShrink: 1,
    },

    addressText: {
      fontSize: 14,
      fontStyle: 'normal',
      fontWeight: '400',
      color: colors['neutral-body'],
    },

    rightCol: {
      flexShrink: 0,
      // ...makeDebugBorder('red'),
    },
    balanceText: {
      color: colors['neutral-title1'],
      textAlign: 'right',
      fontSize: 15,
      fontStyle: 'normal',
      fontWeight: '500',
    },
  };
});
