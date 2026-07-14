import React, { useLayoutEffect, useMemo, useState } from 'react';
import { AddressItem as InnerAddressItem } from '@/components2024/AddressItem/AddressItem';
import { useGetBinaryMode, useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { Card } from '@/components2024/Card';
import {
  StyleSheet,
  View,
  StyleProp,
  ViewStyle,
  TouchableOpacity,
  Image,
} from 'react-native';
import { KeyringAccountWithAlias } from '@/hooks/account';
import {
  ContextMenuView,
  MenuAction,
} from '@/components2024/ContextMenuView/ContextMenuView';
import { trigger } from 'react-native-haptic-feedback';
import { ellipsisAddress } from '@/utils/address';
import { RcIconLockCC } from '@/assets/icons/send';
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
import { Text } from '@/components/Typography';
import DragHandleSVG from '@/assets2024/icons/whitelist/drag-handle.svg';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Sortable, { useItemContext } from 'react-native-sortables';

const SIZES = {
  dragHandleW: 60,
  dragIcon: 20,
  itemH: 78,
};

interface IProps {
  account: KeyringAccountWithAlias;
  style?: StyleProp<ViewStyle>;
  addrDesc?: AddrDescResponse['desc'];
  inWhiteList?: boolean;
  enableMenu?: boolean;
  isMyImported?: boolean;
  hideBalance?: boolean;
  interactionDisabled?: boolean;
  isActiveDragging?: boolean;
  onPress?: () => void;
  sortable?: boolean;
}

type DragHandleTouchableProps = React.PropsWithChildren<{
  onTouchesDown: () => void;
  onTouchesEnd: () => void;
  style?: StyleProp<ViewStyle>;
}>;

const DragHandleTouchable = ({
  children,
  onTouchesDown,
  onTouchesEnd,
  style,
}: DragHandleTouchableProps) => {
  const { gesture: dragGesture } = useItemContext();
  const touchGesture = useMemo(
    () =>
      Gesture.Manual()
        .simultaneousWithExternalGesture(dragGesture)
        .runOnJS(true)
        .onTouchesDown(onTouchesDown)
        .onTouchesUp(onTouchesEnd)
        .onTouchesCancelled(onTouchesEnd),
    [dragGesture, onTouchesDown, onTouchesEnd],
  );

  return (
    <GestureDetector gesture={touchGesture} userSelect="none">
      <View collapsable={false} style={style}>
        {children}
      </View>
    </GestureDetector>
  );
};

export const WhiteListItemInSheetModal = ({
  account,
  style,
  inWhiteList,
  enableMenu,
  isMyImported,
  hideBalance,
  interactionDisabled = false,
  isActiveDragging = false,
  onPress,
  sortable = false,
}: IProps) => {
  const [cexInfo, setCexInfo] = useState<Cex | undefined>();
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const [isPressing, setIsPressing] = React.useState(false);
  const handleDragHandleTouchesDown = React.useCallback(() => {
    setIsPressing(true);
  }, []);
  const handleDragHandleTouchesEnd = React.useCallback(() => {
    setIsPressing(false);
  }, []);
  const { removeWhitelist } = useWhitelist({
    disableAutoFetch: true,
  });
  const isDarkTheme = useGetBinaryMode() === 'dark';
  const { t } = useTranslation();
  const showCexInfo = useMemo(() => {
    return cexInfo?.id && cexInfo.is_deposit;
  }, [cexInfo?.id, cexInfo?.is_deposit]);

  React.useEffect(() => {
    if (interactionDisabled) {
      handleDragHandleTouchesEnd();
    }
  }, [handleDragHandleTouchesEnd, interactionDisabled]);

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
      ...(inWhiteList
        ? [
            {
              title: t('page.whitelist.removeWhitelist'),
              icon: isDarkTheme
                ? require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_remove_whitelist_dark.png')
                : require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_remove_whitelist.png'),
              androidIconName: 'ic_rabby_menu_remove_whitelist',
              key: 'remove',
              destructive: true,
              action() {
                trigger('impactLight', {
                  enableVibrateFallback: true,
                  ignoreAndroidSystemSettings: false,
                });
                removeWhitelist(account.address);
              },
            },
          ]
        : []),
    ] as MenuAction[];
  }, [account, editAliasName, inWhiteList, isDarkTheme, removeWhitelist, t]);

  const { formatName, hideTail } = useMemo(() => {
    const ellipisName = ellipsisAddress(account.address);
    const name = account.aliasName || ellipisName;
    return {
      formatName: name,
      hideTail: name.toLowerCase() === ellipisName.toLowerCase(),
    };
  }, [account.address, account.aliasName]);

  const handlePress = React.useCallback(() => {
    if (interactionDisabled) {
      return;
    }

    if (inWhiteList || isMyImported) {
      onPress?.();
    } else {
      const id = createGlobalBottomSheetModal2024({
        name: MODAL_NAMES.CONFIRM_ADDRESS,
        account,
        bottomSheetModalProps: {
          enableDynamicSizing: true,
        },
        onCancel: () => {
          removeGlobalBottomSheetModal2024(id);
        },
        onConfirm: () => {
          removeGlobalBottomSheetModal2024(id);
          onPress?.();
        },
      });
    }
  }, [account, inWhiteList, interactionDisabled, isMyImported, onPress]);

  const addressContent = (
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
              <WalletIcon style={styles.walletIcon} width={46} height={46} />
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
            {!hideBalance && <WalletBalance style={styles.itemBalanceText} />}
          </View>
        </View>
      )}
    </InnerAddressItem>
  );

  const cardStyle = StyleSheet.flatten([
    styles.card,
    style,
    enableMenu && (isPressing || isActiveDragging) && styles.cardPressing,
  ]);

  const effectiveMenuActions = interactionDisabled
    ? menuActions.map(action => ({ ...action, disabled: true }))
    : menuActions;

  const pressableItem = (
    <AddressItemShadowView
      style={[
        styles.shadowView,
        !enableMenu && isPressing && styles.rootPressing,
      ]}>
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={() => setIsPressing(true)}
        onPressOut={() => setIsPressing(false)}
        style={StyleSheet.flatten([styles.root])}
        delayLongPress={IS_ANDROID ? 350 : 200} // long press delay
        disabled={interactionDisabled}
        onPress={handlePress}
        onLongPress={() => {
          if (enableMenu) {
            return;
          }
          trigger('impactLight', {
            enableVibrateFallback: true,
            ignoreAndroidSystemSettings: false,
          });
        }}>
        <Card style={cardStyle}>{addressContent}</Card>
      </TouchableOpacity>
    </AddressItemShadowView>
  );

  const itemWithMenu = enableMenu ? (
    <ContextMenuView
      menuConfig={{
        menuTitle: account.address,
        menuActions: effectiveMenuActions,
      }}
      preViewBorderRadius={16}
      triggerProps={{ action: 'longPress' }}>
      {pressableItem}
    </ContextMenuView>
  ) : (
    pressableItem
  );

  if (!sortable) {
    return itemWithMenu;
  }

  return (
    <View style={styles.sortableRoot}>
      {itemWithMenu}
      <Sortable.Handle style={styles.dragHandle}>
        <DragHandleTouchable
          style={styles.dragHandleTouchable}
          onTouchesDown={handleDragHandleTouchesDown}
          onTouchesEnd={handleDragHandleTouchesEnd}>
          <DragHandleSVG height={SIZES.dragIcon} width={SIZES.dragIcon} />
        </DragHandleTouchable>
      </Sortable.Handle>
    </View>
  );
};

const getStyles = createGetStyles2024(({ colors2024, isLight }) => ({
  root: {
    overflow: 'hidden',
  },
  sortableRoot: {
    position: 'relative',
    width: '100%',
  },
  dragHandle: {
    alignItems: 'center',
    height: SIZES.itemH,
    justifyContent: 'center',
    position: 'absolute',
    right: 0,
    top: 0,
    width: SIZES.dragHandleW,
    zIndex: 1,
  },
  dragHandleTouchable: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    width: '100%',
  },
  rootPressing: {
    borderColor: colors2024['brand-light-2'],
  },
  shadowView: {
    borderRadius: 20,
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    position: 'relative',
    width: '100%',
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
