/* eslint-disable react-native/no-inline-styles */
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import type { StyleProp, ViewStyle } from 'react-native';
import { FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import Clipboard from '@react-native-clipboard/clipboard';

import { default as RcCaretDownCC } from './icons/caret-down-cc.svg';
import React, { useCallback, useMemo } from 'react';
import {
  AddressItem,
  WalletPin,
} from '@/components2024/AddressItem/AddressItem';
import { RcIconCopy, RcIconQR } from './icons';
import type { Account } from '@/core/startupServices/preference';
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
import { Text } from '@/components/Typography';

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
  const { t } = useTranslation();
  const { styles, colors2024, isLight } = useTheme2024({
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
    toast.success(t('global.copiedSuccessfully'));
  };

  const handleRowFeedbackLongPress = useCallback(() => {
    trigger('impactLight', {
      enableVibrateFallback: true,
      ignoreAndroidSystemSettings: false,
    });
  }, []);
  const rowFeedbackLongPressProps = useMemo<
    Pick<
      React.ComponentProps<typeof TouchableOpacity>,
      'delayLongPress' | 'onLongPress'
    >
  >(() => {
    if (isReceive) {
      return {};
    }

    return {
      delayLongPress: 200,
      onLongPress: handleRowFeedbackLongPress,
    };
  }, [handleRowFeedbackLongPress, isReceive]);

  return (
    <AddressItemShadowView
      style={[
        isReceive && styles.receiveAddressItemShadow,
        isCurrent || isPressing ? styles.active : null,
      ]}>
      <TouchableOpacity
        style={StyleSheet.flatten([
          styles.addressItemContainer,
          isReceive && styles.receiveAddressItemContainer,
          style,
          isCurrent && styles.addressItemContainerCurrent,
          isPressing && styles.containerPressing,
        ])}
        activeOpacity={1}
        onPressIn={() => setIsPressing(true)}
        onPressOut={() => setIsPressing(false)}
        {...rowFeedbackLongPressProps}
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
                          backgroundColor={
                            !isReceive || isLight
                              ? colors2024['neutral-bg-2']
                              : colors2024['neutral-bg-1']
                          }
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            );
          }}
        </AddressItem>
        {isPinned ? (
          <WalletPin style={isReceive ? styles.receiveWalletPin : undefined} />
        ) : null}
      </TouchableOpacity>
    </AddressItemShadowView>
  );
}

const getAddressItemInPanelStyle = createGetStyles2024(ctx => {
  return {
    receiveAddressItemShadow: {
      borderRadius: 20,
    },
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
      overflow: 'hidden',
      padding: 16,
      paddingRight: 24,
      position: 'relative',
      height: SIZES.itemH,
    },
    receiveAddressItemContainer: {
      borderRadius: 20,
      backgroundColor: ctx.isLight
        ? ctx.colors2024['neutral-bg-1']
        : ctx.colors2024['neutral-bg-2'],
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
    receiveWalletPin: {
      top: -1,
      right: -1,
      borderTopRightRadius: 20,
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

// Roughly one screen of address rows (78px + 12px gap).
const INITIAL_ROWS_TO_RENDER = 10;
const GAS_ACCOUNT_ITEM_STYLE: ViewStyle = { backgroundColor: 'transparent' };

const PanelAddressRow = React.memo(function PanelAddressRow({
  account,
  isPinned,
  isReceive,
  isGasAccount,
  withTopGap,
  defaultPressAction,
  onSelectAccount,
}: {
  account: Account;
  isPinned: boolean;
  isReceive: boolean;
  isGasAccount: boolean;
  withTopGap: boolean;
  defaultPressAction: React.ComponentProps<
    typeof AddressItemInSheetModal
  >['defaultPressAction'];
  onSelectAccount?: (account: Account | null) => void;
}) {
  const { styles } = useTheme2024({ getStyle: getPanelStyle });
  const addressItemProps = useMemo(() => ({ account }), [account]);

  const content = (
    <AddressItemInSheetModal
      addressItemProps={addressItemProps}
      isPinned={isPinned}
      onPressAccount={onSelectAccount}
      replaceNameWithAliasAddress={isReceive}
      isReceive={isReceive}
      showCopyAndQR={!isGasAccount}
      defaultPressAction={defaultPressAction}
      style={isGasAccount ? GAS_ACCOUNT_ITEM_STYLE : undefined}
    />
  );

  return (
    <View
      style={[
        isReceive ? styles.receiveAddressRow : styles.addressRow,
        withTopGap && styles.addressItemTopGap,
      ]}>
      {isReceive ? (
        <AddressItemContextMenu account={account} actions={['copy', 'edit']}>
          {content}
        </AddressItemContextMenu>
      ) : (
        content
      )}
    </View>
  );
});

/**
 * One flat, virtualized row model shared by the receive screen and sheet.
 *
 * The screen variant used to render one outer row per section, each with a
 * nested, non-virtualized FlatList, so opening it mounted every address row
 * (each with a native context menu) at once.
 */
type PanelRow =
  | {
      kind: 'sectionHeader';
      title: AccountPannelSectionTitle;
      key: string;
    }
  | {
      kind: 'account';
      account: Account;
      isPinned: boolean;
      withTopGap: boolean;
      key: string;
    };

export function AccountsPanelInSheetModal({
  containerStyle,
  onSelectAccount,
  scene,
  defaultPressItemAction = 'asPress',
  isReceiveSheet = false,
}: {
  containerStyle?: StyleProp<ViewStyle>;
  onSelectAccount?: (account: Account | null) => void;
  scene?: 'GasAccount' | 'receive' | 'Lending' | 'TokenDetail' | undefined;
  defaultPressItemAction?: React.ComponentProps<
    typeof AddressItemInSheetModal
  >['defaultPressAction'];
  isReceiveSheet?: boolean;
}) {
  const { styles } = useTheme2024({ getStyle: getPanelStyle });

  const isGasAccount = scene === 'GasAccount';
  const isReceive = scene === 'receive';
  const { isPinnedAccount, myAddresses, safeAddresses, watchAddresses } =
    useSortAccountOnSelector();

  const scrollViewRef = React.useRef<FlatList<PanelRow>>(null);
  const scrollToBottom = useCallback(() => {
    if (isReceiveSheet) {
      return;
    }
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [isReceiveSheet]);

  // NOTE: despite the name, `true` means the section list is shown.
  const [safeAddressNavCollapsed, setSafeAddressNavCollapsed] = React.useState(
    !isGasAccount && !isReceive,
  );
  const [watchAddressNavCollapsed, setWatchAddressNavCollapsed] =
    React.useState(!isGasAccount && !isReceive);
  const { t } = useTranslation();

  const renderSectionHeader = useCallback(
    (title: AccountPannelSectionTitle) => {
      switch (title) {
        case AccountPannelSectionTitle.SafeAddresses:
          return (
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
          );

        case AccountPannelSectionTitle.WatchAddresses:
          return (
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
          );

        default:
          return null;
      }
    },
    [t, safeAddressNavCollapsed, scrollToBottom, watchAddressNavCollapsed],
  );

  const { safeOffBottom } = useSafeSizes();

  const rows = useMemo<PanelRow[]>(() => {
    const items: PanelRow[] = [];

    const pushAccounts = (
      sectionTitle: AccountPannelSectionTitle,
      accounts: Account[],
    ) => {
      accounts.forEach((account, index) => {
        // The screen spaces every section's first row from what is above it;
        // the sheet has no gap before the very first address.
        const withFirstGap = isReceiveSheet
          ? sectionTitle !== AccountPannelSectionTitle.MyAddresses
          : true;
        items.push({
          kind: 'account',
          account,
          isPinned: isPinnedAccount(account),
          withTopGap: index > 0 || withFirstGap,
          key: `${sectionTitle}-${account.address}-${account.type}-${account.brandName}-${index}`,
        });
      });
    };

    pushAccounts(AccountPannelSectionTitle.MyAddresses, myAddresses);

    if (safeAddresses.length && !isGasAccount) {
      items.push({
        kind: 'sectionHeader',
        title: AccountPannelSectionTitle.SafeAddresses,
        key: 'safeAddresses-section',
      });
      if (safeAddressNavCollapsed) {
        pushAccounts(AccountPannelSectionTitle.SafeAddresses, safeAddresses);
      }
    }

    if (watchAddresses.length && !isGasAccount) {
      items.push({
        kind: 'sectionHeader',
        title: AccountPannelSectionTitle.WatchAddresses,
        key: 'watchAddresses-section',
      });
      if (watchAddressNavCollapsed) {
        pushAccounts(AccountPannelSectionTitle.WatchAddresses, watchAddresses);
      }
    }

    return items;
  }, [
    isReceiveSheet,
    isGasAccount,
    isPinnedAccount,
    myAddresses,
    safeAddresses,
    watchAddresses,
    safeAddressNavCollapsed,
    watchAddressNavCollapsed,
  ]);

  const renderItem = useCallback(
    ({ item }: { item: PanelRow }) => {
      if (item.kind === 'sectionHeader') {
        return (
          <View style={styles.section}>{renderSectionHeader(item.title)}</View>
        );
      }

      return (
        <PanelAddressRow
          account={item.account}
          isPinned={item.isPinned}
          isReceive={isReceive}
          isGasAccount={isGasAccount}
          withTopGap={item.withTopGap}
          defaultPressAction={defaultPressItemAction}
          onSelectAccount={onSelectAccount}
        />
      );
    },
    [
      styles.section,
      renderSectionHeader,
      isReceive,
      isGasAccount,
      defaultPressItemAction,
      onSelectAccount,
    ],
  );

  const keyExtractor = useCallback((item: PanelRow) => item.key, []);

  const listFooter = useMemo(
    () => <View style={{ height: 40 + safeOffBottom }} />,
    [safeOffBottom],
  );

  if (isReceiveSheet) {
    return (
      <View style={[styles.panel, styles.receiveSheetPanel, containerStyle]}>
        <View style={styles.scrollViewContainer}>
          <BottomSheetFlatList<PanelRow>
            style={styles.receiveSheetList}
            contentContainerStyle={[
              styles.receiveSheetListContentContainer,
              { paddingBottom: 40 + safeOffBottom },
            ]}
            data={rows}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            initialNumToRender={INITIAL_ROWS_TO_RENDER}
            maxToRenderPerBatch={INITIAL_ROWS_TO_RENDER}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.panel, containerStyle]}>
      <View style={styles.scrollViewContainer}>
        <FlatList<PanelRow>
          style={styles.scrollView}
          data={rows}
          ref={scrollViewRef}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          initialNumToRender={INITIAL_ROWS_TO_RENDER}
          maxToRenderPerBatch={INITIAL_ROWS_TO_RENDER}
          ListFooterComponent={listFooter}
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
    receiveSheetPanel: {
      backgroundColor: 'transparent',
      minHeight: 0,
      maxHeight: '100%',
    },
    receiveSheetList: {
      flex: 1,
    },
    receiveSheetListContentContainer: {
      paddingHorizontal: 20,
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
    addressRow: {
      borderRadius: 16,
    },
    receiveAddressRow: {
      borderRadius: 20,
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
