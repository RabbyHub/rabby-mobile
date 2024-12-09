import React, { useCallback, useMemo } from 'react';
import { View, TouchableOpacity } from 'react-native';

import RcIconCopy from '@/assets2024/singleHome/copy.svg';

import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';

import TouchableView from '@/components/Touchable/TouchableView';
import { useCurrentAccount } from '@/hooks/account';
import { Text } from '@/components';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import Clipboard from '@react-native-clipboard/clipboard';
import { toastCopyAddressSuccess } from '@/components/AddressViewer/CopyAddress';
import { WalletIcon } from '@/components2024/WalletIcon/WalletIcon';

export default function HomeHeaderArea() {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const { currentAccount } = useCurrentAccount();

  const name = useMemo(
    () => currentAccount?.aliasName || currentAccount?.brandName,
    [currentAccount],
  );

  const handleCopyAddress = useCallback<
    React.ComponentProps<typeof TouchableOpacity>['onPress'] & object
  >(
    evt => {
      evt.stopPropagation();
      if (!currentAccount?.address) {
        return;
      }
      Clipboard.setString(currentAccount.address);
      toastCopyAddressSuccess(currentAccount.address);
    },
    [currentAccount?.address],
  );

  return (
    <View style={styles.container}>
      <View style={styles.innerBox}>
        <TouchableView style={styles.touchBox} onPress={handleCopyAddress}>
          <View style={styles.accountBox}>
            <View className="relative">
              <WalletIcon
                type={currentAccount?.type as KEYRING_TYPE}
                width={styles.walletIcon.width}
                height={styles.walletIcon.height}
                style={styles.walletIcon}
              />
            </View>
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              style={styles.titleText}>
              {name}
            </Text>
          </View>
          <RcIconCopy style={styles.copy} />
        </TouchableView>
      </View>
    </View>
  );
}

const getStyles = createGetStyles2024(ctx => ({
  container: {
    width: '100%',
    marginLeft: 0,
  },
  innerBox: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexShrink: 0,
  },
  touchBox: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  accountBox: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  titleText: {
    flexShrink: 1,
    color: ctx.colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
    flexWrap: 'nowrap',
  },
  copy: {
    width: 17,
    height: 17,
  },
  walletIcon: {
    width: 28,
    height: 28,
    borderRadius: 7,
  },
}));
