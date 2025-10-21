/* eslint-disable react-native/no-inline-styles */
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024, makeDevOnlyStyle } from '@/utils/styles';
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
import { RcIconAddWhitelist, RcIconCopy, RcIconQR } from './icons';
import { Account } from '@/core/services/preference';
import { trigger } from 'react-native-haptic-feedback';
import { toast } from '@/components2024/Toast';
import { useSortAccountOnSelector } from '@/hooks/accountsSelector';
import { TxAccountPannelSectionTitle } from '@/constant/newStyle';
import { useTranslation } from 'react-i18next';
import { AddressItemShadowView } from '@/screens/Address/components/AddressItemShadowView';
import { ellipsisAddress } from '@/utils/address';
import { IS_ANDROID } from '@/core/native/utils';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { useWhiteListAddress } from '@/screens/Send/hooks/useWhiteListAddress';
import {
  RecentHistoryItem,
  useRecentSend,
} from '@/screens/Send/hooks/useRecentSend';
import { RecentUsedItem } from './RecentUsedItem';
import { isAddrInWhitelist } from '@/hooks/whitelist';
import { filterMyAccounts } from '@/utils/account';
import { addressUtils } from '@rabby-wallet/base-utils';
import { WhiteListItemInSheetModal } from './WhiteListItem';
import { AddressItemInSheetModal } from './AddressItem';

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

const SectionCollapsableNav = function ({
  isCollapsed = true,
  onCollapsedChange,
  isCollapsable = typeof onCollapsedChange === 'function',
  title,
  onAction,
}: {
  isCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  isCollapsable?: boolean;
  title: React.ReactNode;
  onAction?: (ctx: {
    title: TxAccountPannelSectionTitle.Whitelist;
    action: 'add-whitelist';
  }) => void;
}) {
  const { styles, colors2024 } = useTheme2024({ getStyle: getPanelStyle });

  const tilteNode = useMemo(() => {
    return typeof title === 'string' ? (
      <Text style={styles.sectionTitle}>{title}</Text>
    ) : (
      title
    );
  }, [styles, title]);

  return (
    <TouchableOpacity
      disabled={!isCollapsable}
      style={[
        isCollapsable
          ? styles.collapsableSectionTitleContainer
          : styles.staticSectionTitleContainer,
      ]}
      onPress={() => {
        onCollapsedChange?.(!isCollapsed);
      }}>
      <View
        style={[
          styles.sectionTitleLeftArea,
          isCollapsable &&
            isCollapsed && { justifyContent: 'center', width: '100%' },
        ]}>
        {tilteNode}
        {isCollapsable && (
          <RcCaretDownCC
            style={[
              { marginLeft: 4 },
              !isCollapsed && { transform: [{ rotate: '180deg' }] },
            ]}
            width={18}
            height={18}
            color={colors2024['neutral-secondary']}
          />
        )}
      </View>
      {title === TxAccountPannelSectionTitle.Whitelist && (
        <TouchableOpacity
          onPress={evt => {
            evt.stopPropagation();
            onAction?.({
              title: TxAccountPannelSectionTitle.Whitelist,
              action: 'add-whitelist',
            });
          }}>
          <RcIconAddWhitelist width={20} height={20} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
};

type AccountToSelect = ReturnType<typeof useSortAccountOnSelector>[
  | 'myAddresses'
  | 'safeAddresses'
  | 'watchAddresses'][number];
type CombineDataInterface = {
  title: TxAccountPannelSectionTitle;
  data: AccountToSelect[];
  type:
    | 'myAddresses'
    | 'safeAddresses'
    | 'watchAddresses'
    | 'whitelistAddresses'
    | 'recent';
  recentUsedAddresses?: RecentHistoryItem[];
};
export type SelectAccountSheetModalType = 'SendTo' | 'SendFrom';

function extractMixedItem(item?: RecentHistoryItem | AccountToSelect | null) {
  const ret = {
    account: null as Account | null,
    history: null as RecentHistoryItem | null,
  };

  if (!item) return ret;

  if ('address' in item) {
    ret.account = item;
  } else if ('toAddress' in item) {
    ret.history = item;
  }

  return ret;
}

export function AccountsPanelInSheetModal({
  containerStyle,
  onSelectAccount,
  scene,
  defaultPressItemAction = 'asPress',
}: {
  containerStyle?: StyleProp<ViewStyle>;
  onSelectAccount?: (account: Account | null) => void;
  scene?: SelectAccountSheetModalType;
  defaultPressItemAction?: React.ComponentProps<
    typeof AddressItemInSheetModal
  >['defaultPressAction'];
}) {
  const { styles } = useTheme2024({ getStyle: getPanelStyle });

  // const { whitelist, isAddrOnWhitelist } = useWhitelist({
  //   disableAutoFetch: false,
  // });

  const { isPinnedAccount, myAddresses, safeAddresses, watchAddresses } =
    useSortAccountOnSelector();

  const scrollViewRef = React.useRef<typeof BottomSheetFlatList>(null);
  const scrollToBottom = useCallback(() => {
    // scrollViewRef.current?.scrollToEnd({ animated: true });
  }, []);

  const [safeAddressNavCollapsed, setSafeAddressNavCollapsed] =
    React.useState(true);
  const [watchAddressNavCollapsed, setWatchAddressNavCollapsed] =
    React.useState(true);
  const { t } = useTranslation();

  const { recentHistory } = useRecentSend({ useAllHistory: true });
  const {
    list: whitelistAccounts,
    whitelist,
    myAccounts,
    findAccountWithoutBalance,
  } = useWhiteListAddress();

  const recentUsedAddresses = useMemo(() => {
    return recentHistory.filter(
      item => !isAddrInWhitelist(item.toAddress, whitelist),
    );
  }, [recentHistory, whitelist]);

  // combine data for a entire Flatlist
  const { combinedData } = useMemo(() => {
    const ret = {
      combinedData: [
        {
          title: TxAccountPannelSectionTitle.Recent,
          // filter toAddress in whitelist
          recentUsedAddresses,
          data: [],
          type: 'recent' as const,
        },
        {
          title: TxAccountPannelSectionTitle.Whitelist,
          data: whitelistAccounts,
          type: 'whitelistAddresses' as const,
        },
        {
          title: TxAccountPannelSectionTitle.MyAddresses,
          data: myAddresses,
          type: 'myAddresses' as const,
        },
        {
          title: TxAccountPannelSectionTitle.SafeAddresses,
          data: safeAddresses,
          type: 'safeAddresses' as const,
        },
        {
          title: TxAccountPannelSectionTitle.WatchAddresses,
          data: watchAddresses,
          type: 'watchAddresses' as const,
        },
      ],
    };

    return ret;
  }, [
    recentUsedAddresses,
    whitelistAccounts,
    myAddresses,
    safeAddresses,
    watchAddresses,
  ]);

  const ListHeaderComponent = useCallback(
    (title: TxAccountPannelSectionTitle) => {
      switch (title) {
        case TxAccountPannelSectionTitle.Recent:
          return (
            !!recentUsedAddresses.length && (
              <>
                <View style={{ marginTop: 30 }} />
                <SectionCollapsableNav
                  title={t('component.accountSelectModalTx.recentAccounts')}
                />
              </>
            )
          );
        case TxAccountPannelSectionTitle.Whitelist:
          return (
            !!whitelistAccounts.length && (
              <>
                <View style={{ marginTop: 30 }} />
                <SectionCollapsableNav
                  title={t('component.accountSelectModalTx.whitelistAccounts')}
                />
              </>
            )
          );
        case TxAccountPannelSectionTitle.MyAddresses:
          return (
            !!myAddresses.length && (
              <>
                <View style={{ marginTop: 30 }} />
                <SectionCollapsableNav
                  title={t('component.accountSelectModalTx.importedAccounts')}
                />
              </>
            )
          );
        case TxAccountPannelSectionTitle.SafeAddresses:
          return (
            !!safeAddresses.length && (
              <>
                <View style={{ marginTop: 30 }} />
                <SectionCollapsableNav
                  title={t(
                    'page.addressDetail.addressListScreen.importSafeAddress',
                  )}
                  isCollapsed={safeAddressNavCollapsed}
                  onCollapsedChange={nextVal => {
                    setSafeAddressNavCollapsed(nextVal);
                  }}
                />
              </>
            )
          );

        case TxAccountPannelSectionTitle.WatchAddresses:
          return (
            !!watchAddresses.length && (
              <>
                <View style={{ height: 30 }} />
                <SectionCollapsableNav
                  title={t(
                    'page.addressDetail.addressListScreen.importWatchAddress',
                  )}
                  isCollapsed={watchAddressNavCollapsed}
                  onCollapsedChange={nextVal => {
                    setWatchAddressNavCollapsed(nextVal);
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
      safeAddressNavCollapsed,
      // scrollToBottom,
      myAddresses.length,
      recentUsedAddresses.length,
      whitelistAccounts.length,
      watchAddresses.length,
      safeAddresses.length,
      watchAddressNavCollapsed,
    ],
  );

  const shouldShowDatalist = useCallback(
    (title: TxAccountPannelSectionTitle) => {
      switch (title) {
        case TxAccountPannelSectionTitle.MyAddresses:
        case TxAccountPannelSectionTitle.Recent:
        case TxAccountPannelSectionTitle.Whitelist:
          return true;
        case TxAccountPannelSectionTitle.SafeAddresses:
          return !safeAddressNavCollapsed;
        case TxAccountPannelSectionTitle.WatchAddresses:
          return !watchAddressNavCollapsed;
        default:
          return true;
      }
    },
    [safeAddressNavCollapsed, watchAddressNavCollapsed],
  );

  const { safeOffBottom } = useSafeSizes();

  return (
    <View style={[styles.panel, containerStyle]}>
      <View style={styles.scrollViewContainer}>
        <BottomSheetFlatList<CombineDataInterface>
          style={styles.scrollView}
          data={combinedData}
          // ref={scrollViewRef}
          // contentContainerStyle={styles.scrollViewContentContainer}
          ListHeaderComponent={null}
          renderItem={({
            item: combinedItem,
          }: {
            item: CombineDataInterface;
          }) => {
            const isOfWhitelistSection =
              combinedItem.title === TxAccountPannelSectionTitle.Whitelist;

            return (
              <View style={styles.section}>
                {ListHeaderComponent(combinedItem.title)}
                {shouldShowDatalist(combinedItem.title) && (
                  <FlatList<RecentHistoryItem | AccountToSelect>
                    data={
                      combinedItem.title === TxAccountPannelSectionTitle.Recent
                        ? combinedItem.recentUsedAddresses
                        : combinedItem.data
                    }
                    style={styles.addressListContainer}
                    renderItem={({ item, index }) => {
                      const { account, history } = extractMixedItem(item);

                      if (account) {
                        const Content = isOfWhitelistSection ? (
                          <WhiteListItemInSheetModal
                            account={account}
                            hideBalance
                            inWhiteList
                            isMyImported={myAccounts.some(i =>
                              addressUtils.isSameAddress(
                                i.address,
                                account.address,
                              ),
                            )}
                            onPress={() => {
                              onSelectAccount?.(account);
                            }}
                          />
                        ) : (
                          <AddressItemInSheetModal
                            ofTitleType={combinedItem.title}
                            recentAddressData={null}
                            addressItemProps={{ account: account }}
                            isPinned={isPinnedAccount(account)}
                            onPressAccount={onSelectAccount}
                            replaceNameWithAliasAddress={false}
                            isReceive={false}
                            showCopyAndQR={false}
                            defaultPressAction={defaultPressItemAction}
                          />
                        );
                        return (
                          <View
                            key={`${account.address}-${account.type}-${account.brandName}-${index}`}
                            style={[
                              { borderRadius: 16 },
                              index > 0 && styles.addressItemTopGap,
                            ]}>
                            {Content}
                          </View>
                        );
                      } else if (history) {
                        const { account, inWhitelist } =
                          findAccountWithoutBalance(history.toAddress);

                        return (
                          <RecentUsedItem
                            key={history.time}
                            account={account}
                            timeStamp={history.time}
                            inWhiteList={inWhitelist}
                            onPress={() => {
                              onSelectAccount?.(account);
                            }}
                          />
                        );
                      }

                      return null;
                    }}
                    keyExtractor={(item, index) => {
                      const { account, history } = extractMixedItem(item);

                      if (account) {
                        return `account-${account.address}-${account.brandName}-${index}`;
                      } else if (history) {
                        return `recent-${history.toAddress}-${history.time}-${index}`;
                      }
                      return `empty-${index}`;
                    }}
                    ListFooterComponent={null}
                  />
                )}
              </View>
            );
          }}
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
      backgroundColor: ctx.colors2024['neutral-bg-1'],
      ...makeDevOnlyStyle({
        backgroundColor: ctx.colors2024['neutral-bg-2'],
      }),
      width: '100%',
      minHeight: 453,
      maxHeight: '100%',
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
    collapsableSectionTitleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
    },
    staticSectionTitleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
    },
    sectionTitleLeftArea: {
      flexDirection: 'row',
      justifyContent: 'flex-start',
      maxWidth: '100%',
      flexShrink: 1,
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
