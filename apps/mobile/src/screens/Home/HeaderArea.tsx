import React, { useCallback, useMemo } from 'react';
import { View } from 'react-native';

import RcIconCopy from '@/assets2024/singleHome/copy.svg';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024, makeDebugBorder } from '@/utils/styles';

import { Text } from '@/components';
import { toastCopyAddressSuccess } from '@/components/AddressViewer/CopyAddress';
import { WalletIcon } from '@/components2024/WalletIcon/WalletIcon';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import Clipboard from '@react-native-clipboard/clipboard';
import { useNavigation } from '@react-navigation/native';
import { trigger } from 'react-native-haptic-feedback';
import { useIsRefreshing } from './hooks/project';
import LoadingCircle from '@/components2024/RotateLoadingCircle';
import { RNTouchableOpacity } from '@/components/customized/reexports';
import {
  apisSingleHome,
  useSingleHomeAccountAlias,
  useSingleHomeLoading,
} from './hooks/singleHome';

export default function HomeHeaderArea() {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const { isRefreshing: refreshing } = useIsRefreshing();

  const {
    address: currentAddress,
    brandName,
    name,
  } = useSingleHomeAccountAlias();
  const { isLoadingCurve, balanceLoading } = useSingleHomeLoading();

  const handleCopyAddress = useCallback<
    React.ComponentProps<typeof RNTouchableOpacity>['onPress'] & object
  >(
    evt => {
      evt.stopPropagation();
      apisSingleHome.setFoldChart(true);
      if (!currentAddress) {
        return;
      }
      trigger('impactLight', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
      Clipboard.setString(currentAddress);
      toastCopyAddressSuccess(currentAddress);
    },
    [currentAddress],
  );

  const nav = useNavigation();
  const goBack = useCallback(() => {
    nav.goBack();
  }, [nav]);

  return (
    <View style={styles.container}>
      <View style={styles.innerBox}>
        <View style={styles.touchBox}>
          <View style={styles.accountBox}>
            <View style={{ position: 'relative' }}>
              <RNTouchableOpacity hitSlop={24} onPress={goBack}>
                <WalletIcon
                  type={brandName as KEYRING_TYPE}
                  address={currentAddress}
                  width={22}
                  height={22}
                  borderRadius={6}
                />
              </RNTouchableOpacity>
            </View>
          </View>
          <RNTouchableOpacity
            style={styles.touchBox}
            onPress={handleCopyAddress}>
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              style={styles.titleText}>
              {name}
            </Text>
            {refreshing || isLoadingCurve || balanceLoading ? (
              <LoadingCircle />
            ) : (
              <RcIconCopy style={styles.copy} />
            )}
          </RNTouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const getStyles = createGetStyles2024(ctx => ({
  container: {
    width: '100%',
    marginLeft: -10,
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
    gap: 6,
  },
  accountBox: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent', // 奇怪的问题，不加这个就会只展示content的内容
    paddingBottom: 4,
    overflow: 'visible',
    // ...makeDebugBorder(),
  },
  titleText: {
    flexShrink: 1,
    color: ctx.colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    flexWrap: 'nowrap',
  },
  copy: {
    width: 18,
    height: 18,
  },
  walletIcon: {
    width: 28,
    height: 28,
    borderRadius: 7,
  },
}));
