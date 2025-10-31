import React, { useLayoutEffect, useMemo, useState } from 'react';
import { AddressItem as InnerAddressItem } from '@/components2024/AddressItem/AddressItem';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { Card } from '@/components2024/Card';
import {
  StyleSheet,
  View,
  Text,
  StyleProp,
  ViewStyle,
  TouchableOpacity,
  Image,
} from 'react-native';
import { KeyringAccountWithAlias } from '@/hooks/account';
import { trigger } from 'react-native-haptic-feedback';
import { ellipsisAddress } from '@/utils/address';
import { RcIconLockCC } from '@/assets/icons/send';
import { Cex } from '@rabby-wallet/rabby-api/dist/types';
import { useSendRoutes } from '@/hooks/useSendRoutes';
import { AddressItemShadowView } from '@/screens/Address/components/AddressItemShadowView';
import { getCexWithLocalCache } from '@/databases/hooks/cex';
import { fromNow } from '@/utils/time';
import { useTranslation } from 'react-i18next';
import {
  ContextMenuView,
  MenuAction,
} from '@/components2024/ContextMenuView/ContextMenuView';
import { toastCopyAddressSuccess } from '@/components/AddressViewer/CopyAddress';
import Clipboard from '@react-native-clipboard/clipboard';
import { useAliasNameEditModal } from '@/components2024/AliasNameEditModal/useAliasNameEditModal';
import { touchedFeedback } from '@/utils/touch';

interface IProps {
  account: KeyringAccountWithAlias;
  style?: StyleProp<ViewStyle>;
  timeStamp?: number;
  inWhiteList?: boolean;
  enableMenu?: boolean;
  onPress?: () => void;
}
export const RecentUsedItem = ({
  account,
  style,
  timeStamp,
  inWhiteList,
  enableMenu = true,
  onPress,
}: IProps) => {
  const [cexInfo, setCexInfo] = useState<Cex | undefined>();
  const { styles, colors2024, isLight } = useTheme2024({ getStyle: getStyles });

  const showCexInfo = useMemo(() => {
    return cexInfo?.id && cexInfo.is_deposit;
  }, [cexInfo?.id, cexInfo?.is_deposit]);
  const { t } = useTranslation();

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

  const { formatName } = useMemo(() => {
    const ellipisName = ellipsisAddress(account.address);
    const name = account.aliasName || ellipisName;
    return {
      formatName: name,
    };
  }, [account.address, account.aliasName]);

  const timStr = useMemo(() => {
    // if less one hour then xx mins ago, else xx hours ago
    return timeStamp ? `${fromNow(timeStamp, undefined, true)} ago` : '';
  }, [timeStamp]);

  const editAliasName = useAliasNameEditModal();

  const menuActions = React.useMemo(() => {
    return [
      {
        title: t('page.whitelist.copyAddress'),
        icon: !isLight
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
        icon: !isLight
          ? require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_edit_dark.png')
          : require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_edit.png'),
        androidIconName: 'ic_rabby_menu_edit',
        key: 'edit',
        action() {
          editAliasName.show(account);
        },
      },
    ] as MenuAction[];
  }, [account, editAliasName, isLight, t]);

  const children = (
    <AddressItemShadowView style={[styles.shadow, style]}>
      <TouchableOpacity
        style={StyleSheet.flatten([styles.root])}
        delayLongPress={200} // long press delay
        onPress={onPress}
        onLongPress={() => {
          if (!enableMenu) return;
          touchedFeedback();
        }}>
        <Card style={StyleSheet.flatten([styles.card])}>
          <InnerAddressItem style={styles.rootItem} account={account}>
            {({ WalletIcon }) => (
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
                      color={colors2024['brand-default']}
                      surroundColor={colors2024['neutral-bg-1']}
                      width={22}
                      height={22}
                    />
                  )}
                </View>
                <View style={styles.itemInfo}>
                  <View style={styles.itemName}>
                    <Text
                      style={[styles.itemNameText]}
                      numberOfLines={1}
                      ellipsizeMode="tail">
                      {formatName}
                    </Text>
                    <Text style={styles.address}>
                      {ellipsisAddress(account.address)}
                    </Text>
                  </View>
                  <Text style={styles.itemBalanceText}>{timStr}</Text>
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

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  shadow: {
    borderRadius: 20,
    backgroundColor: colors2024['neutral-bg-1'],
  },
  root: {
    overflow: 'hidden',
    borderRadius: 20,
    height: 78,
    // backgroundColor: colors2024['neutral-bg-1'],
  },
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderWidth: 0,
    borderRadius: 20,
    flex: 1,
    flexGrow: 1,
    backgroundColor: colors2024['neutral-bg-1'],
    padding: 16,
  },
  rootItem: {
    flexDirection: 'row',
    flex: 1,
    flexGrow: 1,
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
    flexDirection: 'row',
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemNameText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  itemBalanceText: {
    fontSize: 16,
    lineHeight: 20,
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontWeight: '500',
  },
  itemName: {
    gap: 4,
    flexDirection: 'column',
  },
  address: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
    color: colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
  },
  walletIcon: {
    borderRadius: 12,
  },
}));
