/* eslint-disable react-native/no-inline-styles */
import { useTheme2024 } from '@/hooks/theme';
import {
  createGetStyles2024,
  makeDebugBorder,
  makeDevOnlyStyle,
} from '@/utils/styles';
import {
  FlatList,
  Pressable as RNPressable,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';

import { default as RcCaretDownCC } from './icons/caret-down-cc.svg';
import React, { useCallback, useEffect, useMemo } from 'react';
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
import { IS_ANDROID, IS_IOS } from '@/core/native/utils';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { BottomSheetFlatList, TouchableHighlight } from '@gorhom/bottom-sheet';
import { useWhitelistVariedAccounts } from '@/screens/Send/hooks/useWhiteListAddress';
import {
  RecentHistoryItem,
  useRecentSend,
} from '@/screens/Send/hooks/useRecentSend';
import { RecentUsedItem } from './RecentUsedItem';
import { isAddrInWhitelist } from '@/hooks/whitelist';
import { filterMyAccounts, makeAccountObject } from '@/utils/account';
import { addressUtils } from '@rabby-wallet/base-utils';
import { WhiteListItemInSheetModal } from './WhiteListItem';
import { AddressItemInSheetModal } from './AddressItem';
import EmptyWhiteListHolder from './EmptyWhiteListHolder';
import { ICONS_COMMON_2024 } from '@/assets2024/icons/common';
import { useAccountSelectModalCtx } from './hooks';
import { touchedFeedback } from '@/utils/touch';
import { RcIconLockCC } from '@/assets/icons/send';
import { default as RcIconUnknownAddressAvatarCC } from '@/screens/Send/icons/unknown-address-avatar-cc.svg';
import { SelectAccountSheetModalSizes } from './layout';

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
  afterNode,
}: {
  isCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  isCollapsable?: boolean;
  title: React.ReactNode;
  afterNode?: React.ReactNode;
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
      {afterNode}
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
  parentVisible = false,
  scene,
  defaultPressItemAction = 'asPress',
}: {
  containerStyle?: StyleProp<ViewStyle>;
  parentVisible: boolean;
  scene?: SelectAccountSheetModalType;
  defaultPressItemAction?: React.ComponentProps<
    typeof AddressItemInSheetModal
  >['defaultPressAction'];
}) {
  const { fnNavTo, cbOnSelectedAccount } = useAccountSelectModalCtx();
  const { styles, colors2024 } = useTheme2024({ getStyle: getPanelStyle });

  const { isPinnedAccount, myAddresses, safeAddresses, watchAddresses } =
    useSortAccountOnSelector();

  // const scrollViewRef = React.useRef<typeof BottomSheetFlatList>(null);
  // const scrollToBottom = useCallback(() => {
  //   // scrollViewRef.current?.scrollToEnd({ animated: true });
  // }, []);

  const [safeAddressNavCollapsed, setSafeAddressNavCollapsed] =
    React.useState(true);
  const [watchAddressNavCollapsed, setWatchAddressNavCollapsed] =
    React.useState(true);
  const { t } = useTranslation();

  const { unionedRecentHistory, runAsync: fetchRecentHistory } = useRecentSend({
    useAllHistory: true,
  });
  const {
    list: whitelistAccounts,
    whitelist,
    myAccounts,
    findAccountWithoutBalance,
  } = useWhitelistVariedAccounts();

  useEffect(() => {
    if (parentVisible) {
      fetchRecentHistory();
    }
  }, [parentVisible, fetchRecentHistory]);

  const recentUsedAddresses = useMemo(() => {
    return unionedRecentHistory.filter(
      item => !isAddrInWhitelist(item.toAddress, whitelist),
    );
  }, [unionedRecentHistory, whitelist]);

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
          title: TxAccountPannelSectionTitle.WatchAddresses,
          data: watchAddresses,
          type: 'watchAddresses' as const,
        },
        {
          title: TxAccountPannelSectionTitle.SafeAddresses,
          data: safeAddresses,
          type: 'safeAddresses' as const,
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

  const renderHeader = useCallback(
    () => (
      <View>
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.searchInputWrapper}
          onPress={() => {
            touchedFeedback();
            fnNavTo('enter-addr');
          }}>
          <View style={styles.placeHolderWrapper}>
            <Text style={styles.placeHolder}>
              {t('page.sendPoly.enterOrSearchAddress')}
            </Text>
          </View>
          <TouchableOpacity
            style={{
              height: '100%',
              justifyContent: 'center',
              paddingRight: SelectAccountSheetModalSizes.sectionPx,
            }}
            onPress={evt => {
              evt.stopPropagation();
              touchedFeedback();
              fnNavTo('scan-qr-code', {
                nextScanFor: 'enter-addr',
              });
            }}>
            <ICONS_COMMON_2024.RcScanner
              color={colors2024['neutral-title-1']}
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </View>
    ),
    [
      fnNavTo,
      colors2024,
      styles.searchInputWrapper,
      styles.placeHolder,
      styles.placeHolderWrapper,
      t,
    ],
  );

  const renderEmpty = useCallback(
    () => <EmptyWhiteListHolder onAddWhitelist={() => {}} />,
    [
      // handleGotoAddWhitelist
    ],
  );

  const ListHeaderComponent = useCallback(
    (title: TxAccountPannelSectionTitle) => {
      switch (title) {
        case TxAccountPannelSectionTitle.Recent:
          return (
            !!recentUsedAddresses.length && (
              <>
                <View style={{ marginTop: 20 }} />
                <SectionCollapsableNav
                  title={t('component.accountSelectModalTx.recentAccounts')}
                />
              </>
            )
          );
        case TxAccountPannelSectionTitle.Whitelist:
          return (
            <View style={{ marginTop: 20 }}>
              <SectionCollapsableNav
                title={t('component.accountSelectModalTx.whitelistAccounts')}
                afterNode={
                  <TouchableOpacity
                    style={{ paddingRight: 8 }}
                    onPress={evt => {
                      evt.stopPropagation();
                      touchedFeedback();
                      fnNavTo('add-new-whitelist-addr');
                    }}>
                    <RcIconAddWhitelist width={20} height={20} />
                  </TouchableOpacity>
                }
              />
              {!whitelistAccounts.length && (
                <View style={styles.addWhitelistHintContainer}>
                  <View style={styles.addWhitelistHintIcon}>
                    <RcIconUnknownAddressAvatarCC
                      style={{
                        width: 24,
                        height: 28,
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                      color={colors2024['green-light-disable']}
                    />
                    <RcIconLockCC
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        right: 0,
                        transform: [{ translateX: 5 }, { translateY: 2 }],
                      }}
                      color={colors2024['green-default']}
                      surroundColor={colors2024['neutral-bg-1']}
                      width={22}
                      height={22}
                    />
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={styles.addWhitelistHintText}>
                      {t(
                        'component.accountSelectModalTx.addTrustedAddress.desc',
                      )}
                    </Text>
                    <TouchableOpacity
                      style={{ marginLeft: 8 }}
                      onPress={() => {
                        fnNavTo('add-new-whitelist-addr');
                      }}>
                      <Text
                        style={[
                          styles.addWhitelistHintText,
                          {
                            color: colors2024['brand-default'],
                            fontWeight: 700,
                          },
                        ]}>
                        {t(
                          'component.accountSelectModalTx.addTrustedAddress.addBtn',
                        )}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          );
        case TxAccountPannelSectionTitle.MyAddresses:
          return (
            !!myAddresses.length && (
              <>
                <View style={{ marginTop: 20 }} />
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
                <View style={{ marginTop: 24 }} />
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
                <View style={{ height: 24 }} />
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
      fnNavTo,
      colors2024,
      styles,
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
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmpty}
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
                            enableMenu
                            isMyImported={myAccounts.some(i =>
                              addressUtils.isSameAddress(
                                i.address,
                                account.address,
                              ),
                            )}
                            onPress={() => {
                              cbOnSelectedAccount?.(account);
                            }}
                          />
                        ) : (
                          <AddressItemInSheetModal
                            ofTitleType={combinedItem.title}
                            recentAddressData={null}
                            addressItemProps={{ account: account }}
                            isPinned={isPinnedAccount(account)}
                            onPressAccount={cbOnSelectedAccount}
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
                              cbOnSelectedAccount?.(account);
                            }}
                            style={[index > 0 && styles.addressItemTopGap]}
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
  const { colors2024 } = ctx;
  return {
    panel: {
      position: 'relative',
      // backgroundColor: ctx.colors2024['neutral-bg-1'],
      // ...makeDevOnlyStyle({
      //   backgroundColor: colors2024['neutral-bg-2'],
      // }),
      width: '100%',
      minHeight: 453,
      maxHeight: '100%',
      flexDirection: 'column',
    },

    /* renderHeader :start */

    searchInputWrapper: {
      position: 'relative',
      backgroundColor: colors2024['neutral-bg-2'],
      borderRadius: 16,
      display: 'flex',
      justifyContent: 'space-between',
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: SelectAccountSheetModalSizes.sectionPx,
      paddingRight: 0,
      gap: 8,
      marginHorizontal: 4,
      height: 58,
    },
    item: {
      marginBottom: 12,
    },
    placeHolderWrapper: {
      flex: 1,
      justifyContent: 'center',
    },
    placeHolder: {
      color: colors2024['neutral-secondary'],
      fontSize: 17,
      lineHeight: 58,
      fontWeight: '400',
      flex: 1,
      fontFamily: 'SF Pro Rounded',
    },
    /* renderHeader :end */

    scrollViewContainer: {
      height: '100%',
      flexShrink: 1,
      // ...makeDebugBorder('red'),
    },
    scrollView: {
      // width: '100%',
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 16,
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
      color: colors2024['neutral-secondary'],
    },

    addWhitelistHintContainer: {
      marginTop: 12,
      height: 106,
      paddingHorizontal: 10,
      paddingVertical: 16,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors2024['neutral-line'],
      backgroundColor: ctx.isLight
        ? colors2024['neutral-bg-1']
        : colors2024['neutral-bg-1'],
      justifyContent: 'center',
      alignItems: 'center',
    },
    addWhitelistHintIcon: {
      marginBottom: 8,
      position: 'relative',
      width: 46,
      height: 46,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors2024['green-light-1'],
      borderRadius: 12,
    },
    addWhitelistHintText: {
      color: colors2024['neutral-secondary'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 16,
      fontWeight: 400,
      lineHeight: 20,
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
