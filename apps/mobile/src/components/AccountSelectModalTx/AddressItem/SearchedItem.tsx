import React, { useLayoutEffect, useMemo, useState } from 'react';
import { AddressItem as InnerAddressItem } from '@/components2024/AddressItem/AddressItem';
import { useGetBinaryMode, useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { Card } from '@/components2024/Card';
import {
  StyleSheet,
  View,
  Text,
  StyleProp,
  ViewStyle,
  TouchableOpacity,
  Pressable,
  Image,
} from 'react-native';
import { KeyringAccountWithAlias } from '@/hooks/account';
import {
  ContextMenuView,
  MenuAction,
} from '@/components2024/ContextMenuView/ContextMenuView';
import { trigger } from 'react-native-haptic-feedback';
import { ellipsisAddress } from '@/utils/address';
import { RcIconLockCC, RcIconSwitchCC } from '@/assets/icons/send';
import { useWhitelist } from '@/hooks/whitelist';
import { AddrDescResponse, Cex } from '@rabby-wallet/rabby-api/dist/types';
import { useTranslation } from 'react-i18next';
import { useAliasNameEditModal } from '@/components2024/AliasNameEditModal/useAliasNameEditModal';
import { AddressItemShadowView } from '@/screens/Address/components/AddressItemShadowView';
import Clipboard from '@react-native-clipboard/clipboard';
import { toastCopyAddressSuccess } from '@/components/AddressViewer/CopyAddress';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { getCexWithLocalCache } from '@/databases/hooks/cex';
import { IS_ANDROID } from '@/core/native/utils';
import { touchedFeedback } from '@/utils/touch';

const SIZES = {
  itemH: 78,
  itemGap: 12,
};

interface IProps {
  account: KeyringAccountWithAlias;
  style?: StyleProp<ViewStyle>;
  addrDesc?: AddrDescResponse['desc'];
  inWhiteList: boolean;
  // isMyImported?: boolean;
  enableMenu?: boolean;
  hideBalance?: boolean;
  onPress?: () => void;
}
export const SearchedAddressItemInSheetModal = ({
  account,
  style,
  inWhiteList,
  // isMyImported,
  enableMenu = false,
  hideBalance = true,
  onPress,
}: IProps) => {
  const [cexInfo, setCexInfo] = useState<Cex | undefined>();
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const [isPressing, setIsPressing] = React.useState(false);
  // const { removeWhitelist } = useWhitelist({
  //   disableAutoFetch: true,
  // });
  const isDarkTheme = useGetBinaryMode() === 'dark';
  const { t } = useTranslation();
  const showCexInfo = useMemo(() => {
    return cexInfo?.id && cexInfo.is_deposit;
  }, [cexInfo?.id, cexInfo?.is_deposit]);

  const editAliasName = useAliasNameEditModal();

  useLayoutEffect(() => {
    if (cexInfo) {
      return;
    }
    getCexWithLocalCache(account.address).then(res => {
      if (res) {
        setCexInfo(res);
      }
    });
  }, [account.address, cexInfo]);

  const menuActions = React.useMemo(() => {
    return [
      {
        title: t('page.whitelist.copyAddress'),
        icon: isDarkTheme
          ? require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_copy_dark.png')
          : require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_copy.png'),
        androidIconName: 'ic_rabby_menu_copy',
        key: 'copy',
        action() {
          Clipboard.setString(account.address);
          toastCopyAddressSuccess(account.address);
        },
      },
      {
        title: t('page.addressDetail.addressListScreen.edit'),
        icon: isDarkTheme
          ? require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_edit_dark.png')
          : require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_edit.png'),
        androidIconName: 'ic_rabby_menu_edit',
        key: 'edit',
        action() {
          editAliasName.show(account);
        },
      },
      // ...(inWhiteList
      //   ? [
      //       {
      //         title: t('page.whitelist.removeWhitelist'),
      //         icon: isDarkTheme
      //           ? require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_remove_whitelist_dark.png')
      //           : require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_remove_whitelist.png'),
      //         androidIconName: 'ic_rabby_menu_remove_whitelist',
      //         key: 'remove',
      //         destructive: true,
      //         action() {
      //           trigger('impactLight', {
      //             enableVibrateFallback: true,
      //             ignoreAndroidSystemSettings: false,
      //           });
      //           removeWhitelist(account.address);
      //         },
      //       },
      //     ]
      //   : []),
    ] as MenuAction[];
  }, [
    account,
    editAliasName,
    /* inWhiteList,  */ isDarkTheme,
    /* removeWhitelist, */ t,
  ]);

  const { formatName, hideTail } = useMemo(() => {
    const ellipisName = ellipsisAddress(account.address);
    const name = account.aliasName || ellipisName;
    return {
      formatName: name,
      // hideTail: name.toLowerCase() === ellipisName.toLowerCase(),
      hideTail: true,
    };
  }, [account.address, account.aliasName]);

  const children = (
    <AddressItemShadowView
      style={[
        styles.shadowView,
        !enableMenu && isPressing && styles.rootPressing,
      ]}>
      <TouchableOpacity
        // activeOpacity={1}
        onPressIn={() => setIsPressing(true)}
        onPressOut={() => setIsPressing(false)}
        style={StyleSheet.flatten([styles.root])}
        delayLongPress={IS_ANDROID ? 350 : 200} // long press delay
        onPress={() => {
          touchedFeedback();
          onPress?.();
          // /* if (inWhiteList || isMyImported) {
          //   onPress?.();
          // } else  */{
          //   const id = createGlobalBottomSheetModal2024({
          //     name: MODAL_NAMES.CONFIRM_ADDRESS,
          //     account,
          //     bottomSheetModalProps: {
          //       enableDynamicSizing: true,
          //     },
          //     onCancel: () => {
          //       removeGlobalBottomSheetModal2024(id);
          //     },
          //     onConfirm: (acc, addressDesc) => {
          //       removeGlobalBottomSheetModal2024(id);
          //       onPress?.();
          //     },
          //   });
          // }
        }}
        onLongPress={() => {
          if (enableMenu) return;

          touchedFeedback();
        }}>
        <Card
          style={StyleSheet.flatten([
            styles.card,
            style,
            enableMenu && isPressing && styles.cardPressing,
          ])}>
          <InnerAddressItem style={styles.rootItem} account={account}>
            {({ WalletIcon, WalletBalance }) => (
              <View style={styles.item}>
                <View style={styles.iconWrapper}>
                  {showCexInfo && cexInfo?.logo_url ? (
                    <Image
                      source={{ uri: cexInfo?.logo_url }}
                      style={styles.walletIcon}
                      width={46}
                      height={46}
                    />
                  ) : (
                    <WalletIcon
                      style={styles.walletIcon}
                      width={46}
                      height={46}
                    />
                  )}
                  {inWhiteList && (
                    <RcIconLockCC
                      style={styles.lockIcon}
                      color={colors2024['green-default']}
                      surroundColor={colors2024['neutral-bg-1']}
                      width={22}
                      height={22}
                    />
                  )}
                </View>
                <View style={styles.itemInfo}>
                  <View
                    style={[
                      styles.itemName,
                      hideBalance && styles.itemNameNoBalance,
                    ]}>
                    <Text
                      style={[
                        styles.itemNameText,
                        {
                          maxWidth: hideTail ? '100%' : '30%',
                        },
                        hideBalance && styles.hideBalanceNameText,
                      ]}
                      numberOfLines={1}
                      ellipsizeMode="tail">
                      {formatName}
                    </Text>
                    {hideBalance ? (
                      <Text style={styles.hideBalanceAddress}>
                        {ellipsisAddress(account.address)}
                      </Text>
                    ) : (
                      !hideTail && (
                        <Text style={styles.address}>
                          {`(${ellipsisAddress(account.address)})`}
                        </Text>
                      )
                    )}
                  </View>
                  {!hideBalance && (
                    <WalletBalance style={styles.itemBalanceText} />
                  )}
                </View>
              </View>
            )}
          </InnerAddressItem>
        </Card>
      </TouchableOpacity>
    </AddressItemShadowView>
  );
  if (!enableMenu) {
    return children;
  }
  return (
    <ContextMenuView
      menuConfig={{
        menuTitle: account.address,
        menuActions: menuActions,
      }}
      preViewBorderRadius={16}
      triggerProps={{ action: 'longPress' }}>
      {children}
    </ContextMenuView>
  );
};

const getStyles = createGetStyles2024(({ colors2024, isLight }) => ({
  root: {
    // borderRadius: 20,
    overflow: 'hidden',
    // backgroundColor: colors2024['neutral-bg-1'],
  },
  rootPressing: {
    // borderColor: colors2024['brand-light-2'],
  },
  shadowView: {
    borderRadius: 20,
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
  },
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderWidth: 0,
    // borderColor: colors2024['neutral-line'],
    borderRadius: 20,
    flex: 1,
    flexGrow: 1,
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    padding: 16,
    paddingRight: 24,
    height: SIZES.itemH,
  },
  rootItem: {
    flexDirection: 'row',
    flex: 1,
    flexGrow: 1,
    marginRight: 12,
  },
  item: {
    flexDirection: 'row',
    gap: 11,
    alignItems: 'center',
  },
  iconWrapper: {
    width: 46,
    height: 46,
    position: 'relative',
  },
  lockIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    transform: [{ translateX: 5 }, { translateY: 2 }],
  },
  itemInfo: {
    gap: 4,
    flexGrow: 1,
    flex: 1,
  },
  itemNameText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
    color: colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
  },
  hideBalanceNameText: {
    maxWidth: '100%',
    color: colors2024['neutral-title-1'],
    fontWeight: '700',
  },
  itemBalanceText: {
    fontSize: 16,
    lineHeight: 20,
    color: colors2024['neutral-title-1'],
    fontWeight: '700',
  },
  itemName: {
    gap: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemNameNoBalance: {
    flexDirection: 'column',
    gap: 4,
    alignItems: 'flex-start',
  },
  address: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
    color: colors2024['neutral-info'],
    fontFamily: 'SF Pro Rounded',
  },
  hideBalanceAddress: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
    color: colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
  },
  cardPressing: {
    backgroundColor: colors2024['brand-light-1'],
    borderRadius: 16,
  },
  walletIcon: {
    borderRadius: 12,
  },
  modalNextButtonText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
    textAlign: 'center',
    color: colors2024['neutral-InvertHighlight'],
    backgroundColor: colors2024['brand-default'],
  },
}));
