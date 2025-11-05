/* eslint-disable react-native/no-inline-styles */
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import {
  FlatList,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';

import { default as RcCaretDownCC } from './icons/caret-down-cc.svg';
import React, { useCallback, useMemo } from 'react';
import { AddressItem } from '@/components2024/AddressItem/AddressItem';
import { RcIconCopy, RcIconQR } from './icons';
import { Account } from '@/core/services/preference';
import { trigger } from 'react-native-haptic-feedback';
import { toast } from '@/components2024/Toast';
import { useSortAccountOnSelector } from '@/hooks/accountsSelector';
import { AccountPannelSectionTitle } from '@/constant/newStyle';
import { useTranslation } from 'react-i18next';
import { AddressItemShadowView } from '@/screens/Address/components/AddressItemShadowView';
import { ellipsisAddress } from '@/utils/address';
import { IS_ANDROID } from '@/core/native/utils';
import { AddressItemContextMenu } from '@/screens/Address/components/AddressItemContextMenu';
import { QrCircleCC } from '@/assets2024/icons/address';
import { useSafeSizes } from '@/hooks/useAppLayout';

interface CombineDataInterface {
  title: AccountPannelSectionTitle;
  data: ReturnType<typeof useSortAccountOnSelector>[
    | 'myAddresses'
    | 'safeAddresses'
    | 'watchAddresses'];
  type: string;
}

const MY_ADDRESS_LIMIT = 3;

const SIZES = {
  itemH: 78,
  itemGap: 12,
  get myAddressesAreaVisiableH() {
    return (
      SIZES.itemH * MY_ADDRESS_LIMIT + SIZES.itemGap * (MY_ADDRESS_LIMIT - 1)
    );
  },
};

const triggerLight = () => {
  trigger('impactLight', {
    enableVibrateFallback: true,
    ignoreAndroidSystemSettings: false,
  });
};

type AddressItemProps = React.ComponentProps<typeof AddressItem>;
function AddressItemInSheetModal({
  style,
  addressItemProps,
  isCurrent,
  isPinned,
  showCopyAndQR,
  replaceNameWithAliasAddress,
  defaultPressAction = showCopyAndQR ? 'copy' : 'asPress',
  onPressAccount: proponPressAddress,
  isReceive,
}: {
  addressItemProps: AddressItemProps & { account: Account };
  isCurrent?: boolean;
  /** @deprecated */
  isPinned?: boolean;
  showCopyAndQR?: boolean;
  /** @deprecated */
  replaceNameWithAliasAddress?: boolean;
  defaultPressAction?: 'copy' | 'asPress';
  onPressAccount?: (account: Account) => void;
  /** @deprecated */
  isReceive?: boolean;
} & RNViewProps) {
  const { styles, colors2024 } = useTheme2024({
    getStyle: getAddressItemInPanelStyle,
  });

  const [isPressing, setIsPressing] = React.useState(false);

  const { account } = addressItemProps;
  const onPressAccount = useCallback(() => {
    proponPressAddress?.(account);
  }, [account, proponPressAddress]);

  const handleCopyAddress = () => {
    triggerLight();
    if (!account?.address) {
      return;
    }
    Clipboard.setString(account.address);
    toast.success('Copied successfully');
  };

  return (
    <AddressItemShadowView
      style={isCurrent || isPressing ? styles.active : null}>
      <TouchableOpacity
        style={StyleSheet.flatten([
          styles.addressItemContainer,
          style,
          isCurrent && styles.addressItemContainerCurrent,
          isPressing && styles.containerPressing,
        ])}
        activeOpacity={1}
        onPressIn={() => setIsPressing(true)}
        onPressOut={() => setIsPressing(false)}
        delayLongPress={200}
        onLongPress={() => {
          trigger('impactLight', {
            enableVibrateFallback: true,
            ignoreAndroidSystemSettings: false,
          });
        }}
        onPress={() => {
          triggerLight();
          defaultPressAction === 'copy'
            ? handleCopyAddress?.()
            : onPressAccount?.();
        }}>
        <AddressItem {...addressItemProps}>
          {({
            WalletIcon,
            WalletAddress,
            WalletBalance,
            WalletName,
            walletName,
          }) => {
            const hasAlias =
              walletName?.toLowerCase() !==
              ellipsisAddress(account.address).toLowerCase();
            return (
              <View style={styles.addressItemInner}>
                <WalletIcon style={styles.walletIcon} />
                <View style={styles.centerInfo}>
                  <View style={styles.nameAndAddress}>
                    <Text style={styles.addressAlias} numberOfLines={1}>
                      {hasAlias ? (
                        <>
                          <WalletName style={styles.addressAlias} />
                          <Text style={styles.addressTruncate}>
                            ({ellipsisAddress(account.address)})
                          </Text>
                        </>
                      ) : (
                        <Text style={styles.addressAlias}>
                          {ellipsisAddress(account.address)}
                        </Text>
                      )}
                    </Text>
                  </View>
                  <WalletBalance
                    style={[
                      styles.addressUsdValue,
                      isCurrent && styles.addressUsdValueCurrent,
                    ]}
                  />
                </View>
                {showCopyAndQR && (
                  <View style={styles.rightArea}>
                    <View style={styles.iconList}>
                      {/* <TouchableOpacity
                      onPress={handleCopyAddress}
                      style={styles.iconWrapper}>
                      <RcIconCopy style={styles.icon} />
                    </TouchableOpacity> */}
                      <TouchableOpacity
                        onPress={evt => {
                          evt.stopPropagation();
                          onPressAccount();
                        }}
                        style={styles.iconWrapper}>
                        <QrCircleCC
                          color={colors2024['neutral-body']}
                          backgroundColor={colors2024['neutral-bg-2']}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            );
          }}
        </AddressItem>
      </TouchableOpacity>
    </AddressItemShadowView>
  );
}

const getAddressItemInPanelStyle = createGetStyles2024(ctx => {
  return {
    active: {
      borderColor: ctx.colors2024['brand-light-2'],
    },
    containerPressing: {
      borderColor: ctx.colors2024['brand-light-2'],
      backgroundColor: ctx.colors2024['brand-light-1'],
    },
    addressItemContainer: {
      borderRadius: 16,
      backgroundColor: ctx.colors2024['neutral-bg-1'],
      padding: 16,
      paddingRight: 24,
      height: SIZES.itemH,
    },
    addressItemContainerCurrent: {
      backgroundColor: ctx.colors2024['brand-light-1'],
    },
    addressItemInner: {
      flexDirection: 'row',
      alignItems: 'center',
      width: '100%',
    },
    walletIcon: { marginRight: 8, width: 46, height: 46, borderRadius: 12 },
    centerInfo: {
      flex: 1,
      flexShrink: 1,
      flexDirection: 'column',
      marginRight: 20,
    },
    nameAndAddress: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
    },
    addressTruncate: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 16,
      fontStyle: 'normal',
      fontWeight: '500',
      color: ctx.colors2024['neutral-info'],
      lineHeight: 20,
    },
    addressAlias: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 16,
      fontStyle: 'normal',
      fontWeight: '500',
      lineHeight: 20,
      color: ctx.colors2024['neutral-foot'],
      flexGrow: IS_ANDROID ? 1 : 0,
    },
    addressUsdValue: {
      marginTop: 6,
      fontFamily: 'SF Pro Rounded',
      fontSize: 17,
      fontStyle: 'normal',
      fontWeight: '700',
      lineHeight: 20,
      color: ctx.colors2024['neutral-title-1'],
    },
    addressUsdValueCurrent: {
      color: ctx.colors2024['neutral-title-1'],
      fontWeight: '700',
    },

    pinnedWrapper: {
      width: 33,
      height: 20,
      marginLeft: 4,
      borderRadius: 6,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: ctx.colors2024['brand-light-1'],
      flexWrap: 'nowrap',
    },
    pinText: {
      color: ctx.colors2024['brand-default'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 14,
      fontStyle: 'normal',
      fontWeight: '700',
      lineHeight: 18,
    },
    pinIcon: {
      color: ctx.colors2024['brand-default'],
    },

    rightArea: {
      // width: 72,
    },
    iconList: {
      display: 'flex',
      flexDirection: 'row',
      gap: 12,
    },
    iconWrapper: {
      width: 26,
      height: 26,
      borderRadius: 100,
      // backgroundColor: ctx.colors2024['neutral-bg-2'],
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
    },
    icon: {
      width: 13,
      height: 13,
    },
  };
});

const SectionCollapsableNav = function ({
  isCollapsed = false,
  title,
  onCollapsedChange,
}: {
  isCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  title: React.ReactNode;
}) {
  const { styles, colors2024 } = useTheme2024({ getStyle: getPanelStyle });

  const tilteNode = useMemo(() => {
    return typeof title === 'string' ? (
      <Text style={styles.sectionTitle}>{title}</Text>
    ) : (
      title
    );
  }, [styles, title]);

  // React.useImperativeHandle(ref, () => ({
  //   isCollapsed: () => {
  //     return !collapsed;
  //   },
  // }));

  return (
    <TouchableOpacity
      style={styles.sectionTitleContainer}
      onPress={() => {
        onCollapsedChange?.(!isCollapsed);
      }}>
      {tilteNode}
      <RcCaretDownCC
        style={[
          { marginLeft: 4 },
          isCollapsed && { transform: [{ rotate: '180deg' }] },
        ]}
        width={18}
        height={18}
        color={colors2024['neutral-secondary']}
      />
    </TouchableOpacity>
  );
};

export function AccountsPanelInSheetModal({
  containerStyle,
  onSelectAccount,
  scene,
  defaultPressItemAction = 'asPress',
}: {
  containerStyle?: StyleProp<ViewStyle>;
  onSelectAccount?: (account: Account | null) => void;
  scene?: 'GasAccount' | 'receive' | 'Lending' | 'TokenDetail' | undefined;
  defaultPressItemAction?: React.ComponentProps<
    typeof AddressItemInSheetModal
  >['defaultPressAction'];
}) {
  const { styles } = useTheme2024({ getStyle: getPanelStyle });

  const isGasAccount = scene === 'GasAccount';
  const isReceive = scene === 'receive';
  const { isPinnedAccount, myAddresses, safeAddresses, watchAddresses } =
    useSortAccountOnSelector();

  const scrollViewRef = React.useRef<FlatList>(null);
  const scrollToBottom = useCallback(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, []);

  const [safeAddressNavCollapsed, setSafeAddressNavCollapsed] = React.useState(
    !isGasAccount && !isReceive,
  );
  const [watchAddressNavCollapsed, setWatchAddressNavCollapsed] =
    React.useState(!isGasAccount && !isReceive);
  const { t } = useTranslation();

  // combine data for a entire Flatlist
  const combinedData = [
    {
      title: AccountPannelSectionTitle.MyAddresses,
      data: myAddresses,
      type: 'myAddresses',
    },
    {
      title: AccountPannelSectionTitle.SafeAddresses,
      data: safeAddresses,
      type: 'safeAddresses',
    },
    {
      title: AccountPannelSectionTitle.WatchAddresses,
      data: watchAddresses,
      type: 'watchAddresses',
    },
  ] as CombineDataInterface[];

  const ListHeaderComponent = useCallback(
    (title: AccountPannelSectionTitle) => {
      switch (title) {
        case AccountPannelSectionTitle.MyAddresses:
          return null;
        case AccountPannelSectionTitle.SafeAddresses:
          return (
            !!safeAddresses.length &&
            !isGasAccount && (
              <>
                <View style={{ marginTop: 30 }} />
                <SectionCollapsableNav
                  title={t(
                    'page.addressDetail.addressListScreen.importSafeAddress',
                  )}
                  isCollapsed={safeAddressNavCollapsed}
                  onCollapsedChange={nextVal => {
                    setSafeAddressNavCollapsed(nextVal);
                    scrollToBottom();
                  }}
                />
              </>
            )
          );

        case AccountPannelSectionTitle.WatchAddresses:
          return (
            !!watchAddresses.length &&
            !isGasAccount && (
              <>
                <View style={{ height: 30 }} />
                <SectionCollapsableNav
                  title={t(
                    'page.addressDetail.addressListScreen.importWatchAddress',
                  )}
                  isCollapsed={watchAddressNavCollapsed}
                  onCollapsedChange={nextVal => {
                    setWatchAddressNavCollapsed(nextVal);
                    scrollToBottom();
                  }}
                />
              </>
            )
          );

        default:
          break;
      }
    },
    [
      t,
      isGasAccount,
      safeAddressNavCollapsed,
      scrollToBottom,
      watchAddresses,
      safeAddresses,
      watchAddressNavCollapsed,
    ],
  );

  const shouldShowDatalist = useCallback(
    (title: AccountPannelSectionTitle) => {
      switch (title) {
        case AccountPannelSectionTitle.MyAddresses:
          return true;
        case AccountPannelSectionTitle.SafeAddresses:
          return safeAddressNavCollapsed && !isGasAccount;
        case AccountPannelSectionTitle.WatchAddresses:
          return watchAddressNavCollapsed && !isGasAccount;
        default:
          return true;
      }
    },
    [safeAddressNavCollapsed, isGasAccount, watchAddressNavCollapsed],
  );

  const { safeOffBottom } = useSafeSizes();

  return (
    <View style={[styles.panel, containerStyle]}>
      <View style={styles.scrollViewContainer}>
        <FlatList
          style={styles.scrollView}
          data={combinedData}
          ref={scrollViewRef}
          // contentContainerStyle={styles.scrollViewContentContainer}
          ListHeaderComponent={null}
          renderItem={({
            item: combinedItem,
          }: {
            item: CombineDataInterface;
          }) => (
            <View style={styles.section}>
              {ListHeaderComponent(combinedItem.title)}
              {shouldShowDatalist(combinedItem.title) && (
                <FlatList
                  data={combinedItem.data}
                  style={styles.addressListContainer}
                  renderItem={({ item, index }) => {
                    const Content = (
                      <AddressItemInSheetModal
                        addressItemProps={{ account: item }}
                        isPinned={isPinnedAccount(item)}
                        onPressAccount={onSelectAccount}
                        replaceNameWithAliasAddress={isReceive}
                        isReceive={isReceive}
                        showCopyAndQR={!isGasAccount}
                        defaultPressAction={defaultPressItemAction}
                        style={
                          isGasAccount ? { backgroundColor: 'transparent' } : {}
                        }
                      />
                    );
                    return (
                      <View
                        key={`${item.address}-${item.type}-${item.brandName}-${index}`}
                        style={[
                          { borderRadius: 16 },
                          index > 0 && styles.addressItemTopGap,
                        ]}>
                        {isReceive ? (
                          <AddressItemContextMenu
                            account={item}
                            actions={['copy', 'edit']}>
                            {Content}
                          </AddressItemContextMenu>
                        ) : (
                          Content
                        )}
                      </View>
                    );
                  }}
                  keyExtractor={(account, index) =>
                    `account-${account.address}-${account.brandName}-${index}`
                  }
                  ListFooterComponent={null}
                />
              )}
            </View>
          )}
          keyExtractor={(item, index) => `${item.type}-${index}`}
          ListFooterComponent={<View style={{ height: 40 + safeOffBottom }} />}
        />
      </View>
    </View>
  );
}
const getPanelStyle = createGetStyles2024(ctx => {
  return {
    panel: {
      position: 'relative',
      backgroundColor: ctx.colors2024['neutral-bg-2'],
      width: '100%',
      minHeight: 453,
      maxHeight: '80%',
      flexDirection: 'column',
    },
    scrollViewContainer: {
      height: '100%',
      flexShrink: 1,
      // ...makeDebugBorder('red'),
    },
    scrollView: {
      // width: '100%',
      padding: 16,
    },
    scrollViewContentContainer: {
      alignItems: 'flex-start',
      justifyContent: 'flex-start',
      paddingBottom: 20 + 40,
    },
    section: {
      flexDirection: 'column',
      // width: '100%',
      // padding: 16,
      // ...makeDebugBorder('red'),
    },
    sectionTitleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      // paddingLeft: 4,
    },
    sectionTitle: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 16,
      fontWeight: '500',
      lineHeight: 20,
      paddingLeft: 4,
      color: ctx.colors2024['neutral-secondary'],
    },
    addressListContainer: {
      flexDirection: 'column',
      marginTop: 12,
      // maxHeight: SIZES.myAddressesAreaVisiableH,
      width: '100%',
    },
    addressItemTopGap: {
      marginTop: SIZES.itemGap,
    },
    bottomBarContainer: {
      width: '100%',
      height: 31,
      flexShrink: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bottomBarStyle: {
      backgroundColor: '#d1d4db',
      height: 6,
      width: 50,
      borderRadius: 104,
    },
  };
});
