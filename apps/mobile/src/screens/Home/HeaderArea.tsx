import React, { useCallback, useMemo } from 'react';
import { TouchableOpacity, View } from 'react-native';

import RcIconCopy from '@/assets2024/singleHome/copy.svg';
import RcIconHomeHeaderPenEditAddr from '@/assets2024/icons/common/edit-cc.svg';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024, makeDebugBorder } from '@/utils/styles';

import { Text } from '@/components';
import { toastCopyAddressSuccess } from '@/components/AddressViewer/CopyAddress';
import { WalletIcon } from '@/components2024/WalletIcon/WalletIcon';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import Clipboard from '@react-native-clipboard/clipboard';
import { trigger } from 'react-native-haptic-feedback';
import LoadingCircle from '@/components2024/RotateLoadingCircle';
import {
  apisSingleHome,
  useSingleHomeAccount,
  useSingleHomeAccountAlias,
  useSingleHomeLoading,
} from './hooks/singleHome';
import { navBack } from '@/hooks/navigation';
import { useAlias2 } from '@/hooks/alias';
import { useAliasNameEditModal } from '@/components2024/AliasNameEditModal/useAliasNameEditModal';

export default function HomeHeaderArea({ style }: RNViewProps) {
  const { styles } = useTheme2024({ getStyle: getStyles });

  const {
    aliasExist,
    address: currentAddress,
    brandName,
    nameText,
  } = useSingleHomeAccountAlias();
  const { isLoadingCurve, balanceLoading } = useSingleHomeLoading();

  const { show: showEditAliasName } = useAliasNameEditModal();
  const showEditAliasModal = useCallback(() => {
    const currentAccount = apisSingleHome.getCurrentAccount();
    currentAccount && showEditAliasName(currentAccount);
  }, [showEditAliasName]);

  const handleCopyAddress = useCallback<
    React.ComponentProps<typeof TouchableOpacity>['onPress'] & object
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

  return (
    <View style={[styles.container, style]}>
      <View style={styles.innerBox}>
        <View style={styles.touchBox}>
          <View style={styles.accountBox}>
            <View style={styles.walletIcon}>
              <TouchableOpacity hitSlop={24} onPress={navBack}>
                <WalletIcon
                  type={brandName as KEYRING_TYPE}
                  address={currentAddress}
                  width={22}
                  height={22}
                  borderRadius={6}
                />
              </TouchableOpacity>
            </View>
          </View>
          <TouchableOpacity style={styles.touchBox} onPress={handleCopyAddress}>
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              style={styles.titleText}>
              {nameText}
            </Text>
            {currentAddress && !aliasExist && (
              <TouchableOpacity
                onPress={evt => {
                  evt.stopPropagation();
                  showEditAliasModal();
                }}>
                <RcIconHomeHeaderPenEditAddr style={styles.editIcon} />
              </TouchableOpacity>
            )}
            {isLoadingCurve || balanceLoading ? (
              <LoadingCircle />
            ) : (
              <RcIconCopy style={styles.copy} />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const getStyles = createGetStyles2024(ctx => ({
  container: {
    width: '100%',
    // marginLeft: -10,
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
    borderColor: 'transparent',
    overflow: 'visible',
    // ...makeDebugBorder(),
  },
  walletIcon: {
    position: 'relative',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    // ...makeDebugBorder('yellow'),
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
  editIcon: {
    width: 20,
    height: 20,
    color: ctx.colors2024['neutral-title-1'],
  },
  copy: {
    width: 18,
    height: 18,
  },
}));
