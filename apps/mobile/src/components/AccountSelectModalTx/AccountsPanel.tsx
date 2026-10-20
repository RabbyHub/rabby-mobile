/* eslint-disable react-native/no-inline-styles */
import { useTheme2024 } from '@/hooks/theme';
import {
  createGetStyles2024,
  makeDebugBorder,
  makeDevOnlyStyle,
} from '@/utils/styles';
import type { StyleProp, ViewStyle } from 'react-native';
import {
  FlatList,
  Pressable as RNPressable,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';

import { default as RcCaretDownCC } from './icons/caret-down-cc.svg';
import React, { useCallback, useMemo } from 'react';
import { AddressItem } from '@/components2024/AddressItem/AddressItem';
import { RcIconAddWhitelist, RcIconCopy, RcIconQR } from './icons';
import type { Account } from '@/core/startupServices/preference';
import type { KeyringAccountWithAlias } from '@/types/account';
import { trigger } from 'react-native-haptic-feedback';
import { toast } from '@/components2024/Toast';
import { useSortAccountOnSelector } from '@/hooks/accountsSelector';
import { TxAccountPannelSectionTitle } from '@/constant/newStyle';
import { useTranslation } from 'react-i18next';
import { AddressItemShadowView } from '@/screens/Address/components/AddressItemShadowView';
import { ellipsisAddress } from '@/utils/address';
import { IS_ANDROID, IS_IOS } from '@/core/native/utils';
import { useSafeSizes } from '@/hooks/useAppLayout';
import {
  BottomSheetFlatList,
  type BottomSheetFlatListMethods,
  TouchableHighlight,
} from '@gorhom/bottom-sheet';
import { useAnimatedRef } from 'react-native-reanimated';
import Sortable from 'react-native-sortables';
import { useWhitelistVariedAccounts } from '@/screens/Send/hooks/useWhiteListAddress';
import { useRecentSend } from '@/screens/Send/hooks/useRecentSend';
import { RecentUsedItem } from './RecentUsedItem';
import { isAddrInWhitelist } from '@/hooks/whitelist';
import { filterMyAccounts, makeAccountObject } from '@/utils/account';
import { AddressItemInSheetModal } from './AddressItem';
import { ICONS_COMMON_2024 } from '@/assets2024/icons/common';
import { useAccountSelectModalCtx } from './hooks';
import { touchedFeedback } from '@/utils/touch';
import { RcIconLockCC } from '@/assets/icons/send';
import { default as RcIconUnknownAddressAvatarCC } from '@/screens/Send/icons/unknown-address-avatar-cc.svg';
import { SelectAccountSheetModalSizes } from './layout';
import { Text } from '@/components/Typography';
import { SortableWhitelistSection } from './SortableWhitelistSection';

const MY_ADDRESS_LIMIT = 3;
// Roughly one screen of address rows (78px + 12px gap) inside the sheet.
const INITIAL_ROWS_TO_RENDER = 10;

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
export type SelectAccountSheetModalType = 'SendTo' | 'SendFrom';

type AccountSectionTitle =
  | TxAccountPannelSectionTitle.MyAddresses
  | TxAccountPannelSectionTitle.WatchAddresses
  | TxAccountPannelSectionTitle.SafeAddresses;

/**
 * One flat, virtualized row model for the whole panel.
 *
 * The panel used to render one outer row per section, each with a nested,
 * non-virtualized FlatList. Opening the sheet therefore mounted every address
 * row (20-30+ items, each with a native context menu) in the same commit that
 * the sheet needed before it could start animating. Flattening lets the
 * BottomSheetFlatList only mount the rows near the viewport.
 */
type PanelRow =
  | {
      kind: 'recent-title';
      key: string;
    }
  | {
      kind: 'recent';
      key: string;
      account: KeyringAccountWithAlias;
      time: number;
      inWhitelist: boolean;
    }
  | {
      kind: 'whitelist';
      key: string;
    }
  | {
      /** keeps the gap an empty section list used to leave */
      kind: 'spacer';
      key: string;
      size: number;
    }
  | {
      kind: 'section-title';
      key: string;
      title: AccountSectionTitle;
    }
  | {
      kind: 'account';
      key: string;
      title: AccountSectionTitle;
      account: AccountToSelect;
      isPinned: boolean;
    };

const SectionTopSpace = React.memo(function SectionTopSpace({
  size,
}: {
  size: number;
}) {
  return <View style={{ height: size }} />;
});

const RecentRow = React.memo(function RecentRow({
  account,
  time,
  inWhitelist,
  onSelect,
}: {
  account: KeyringAccountWithAlias;
  time: number;
  inWhitelist: boolean;
  onSelect: (account: Account) => void;
}) {
  const { styles } = useTheme2024({ getStyle: getPanelStyle });
  const onPress = useCallback(() => {
    onSelect(account);
  }, [account, onSelect]);

  return (
    <RecentUsedItem
      account={account}
      timeStamp={time}
      inWhiteList={inWhitelist}
      onPress={onPress}
      style={styles.addressItemTopGap}
    />
  );
});

const AccountRow = React.memo(function AccountRow({
  account,
  title,
  isPinned,
  onSelect,
  defaultPressAction,
}: {
  account: AccountToSelect;
  title: AccountSectionTitle;
  isPinned: boolean;
  onSelect: (account: Account) => void;
  defaultPressAction: React.ComponentProps<
    typeof AddressItemInSheetModal
  >['defaultPressAction'];
}) {
  const { styles } = useTheme2024({ getStyle: getPanelStyle });
  const addressItemProps = useMemo(() => ({ account }), [account]);

  return (
    <View style={styles.accountRow}>
      <AddressItemInSheetModal
        ofTitleType={title}
        recentAddressData={null}
        addressItemProps={addressItemProps}
        isPinned={isPinned}
        onPressAccount={onSelect}
        replaceNameWithAliasAddress={false}
        isReceive={false}
        showCopyAndQR={false}
        defaultPressAction={defaultPressAction}
      />
    </View>
  );
});

const WhitelistBlock = React.memo(function WhitelistBlock({
  accounts,
  myAccounts,
  scrollableRef,
  onReorder,
  onSelect,
  onNavTo,
}: {
  accounts: React.ComponentProps<typeof SortableWhitelistSection>['accounts'];
  myAccounts: React.ComponentProps<
    typeof SortableWhitelistSection
  >['myAccounts'];
  scrollableRef: React.ComponentProps<
    typeof SortableWhitelistSection
  >['scrollableRef'];
  onReorder: React.ComponentProps<typeof SortableWhitelistSection>['onReorder'];
  onSelect: (account: Account) => void;
  onNavTo: ReturnType<typeof useAccountSelectModalCtx>['fnNavTo'];
}) {
  const { styles, colors2024 } = useTheme2024({ getStyle: getPanelStyle });
  const { t } = useTranslation();

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
              onNavTo('add-new-whitelist-addr');
            }}>
            <RcIconAddWhitelist width={20} height={20} />
          </TouchableOpacity>
        }
      />
      {!accounts.length ? (
        <View style={styles.addWhitelistHintContainer}>
          <View style={styles.addWhitelistHintIcon}>
            <RcIconUnknownAddressAvatarCC
              style={{
                width: 24,
                height: 28,
                justifyContent: 'center',
                alignItems: 'center',
              }}
              color={colors2024['green-disable']}
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
          <View style={styles.addWhitelistHintContent}>
            <Text style={styles.addWhitelistHintText}>
              {t('component.accountSelectModalTx.addTrustedAddress.desc')}
            </Text>
            <TouchableOpacity
              style={styles.addWhitelistHintButton}
              onPress={() => {
                onNavTo('add-new-whitelist-addr');
              }}>
              <Text
                style={[
                  styles.addWhitelistHintText,
                  {
                    color: colors2024['brand-default'],
                    fontWeight: 700,
                  },
                ]}>
                {t('component.accountSelectModalTx.addTrustedAddress.addBtn')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <SortableWhitelistSection
          accounts={accounts}
          myAccounts={myAccounts}
          scrollableRef={scrollableRef}
          onReorder={onReorder}
          onSelect={onSelect}
        />
      )}
    </View>
  );
});

export function AccountsPanelInSheetModal({
  containerStyle,
  parentVisible = false,
  listReady = true,
  defaultPressItemAction = 'asPress',
}: {
  containerStyle?: StyleProp<ViewStyle>;
  parentVisible: boolean;
  /**
   * When false, only the search header is rendered. The sheet host flips this
   * once its open animation has started so the address rows never block the
   * sheet from appearing.
   *
   * @default true
   */
  listReady?: boolean;
  scene?: SelectAccountSheetModalType;
  defaultPressItemAction?: React.ComponentProps<
    typeof AddressItemInSheetModal
  >['defaultPressAction'];
}) {
  const { fnNavTo, cbOnSelectedAccount } = useAccountSelectModalCtx();
  const { styles, colors2024 } = useTheme2024({ getStyle: getPanelStyle });
  const scrollableRef = useAnimatedRef<FlatList<PanelRow>>();
  const setScrollableRef = useCallback(
    (instance: BottomSheetFlatListMethods | null) => {
      if (instance) {
        // BottomSheetFlatList forwards its underlying animated FlatList at
        // runtime, while its public ref type intentionally exposes only the
        // supported list methods.
        scrollableRef(instance as FlatList<PanelRow>);
      }
    },
    [scrollableRef],
  );

  const { isPinnedAccount, myAddresses, safeAddresses, watchAddresses } =
    useSortAccountOnSelector();

  const [safeAddressNavCollapsed, setSafeAddressNavCollapsed] =
    React.useState(true);
  const [watchAddressNavCollapsed, setWatchAddressNavCollapsed] =
    React.useState(true);
  const { t } = useTranslation();

  // `ready` gates the request: it runs once when the panel mounts visible and
  // again whenever the sheet is re-shown, instead of auto-running on mount and
  // then running a second time from a visibility effect.
  const { unionedRecentHistory } = useRecentSend({
    useAllHistory: true,
    ready: parentVisible,
  });
  const {
    list: whitelistAccounts,
    whitelist,
    myAccounts,
    findAccountWithoutBalance,
    updateWhitelistOrder,
  } = useWhitelistVariedAccounts();

  const onSelectAccount = useCallback(
    (account: Account) => {
      cbOnSelectedAccount?.(account);
    },
    [cbOnSelectedAccount],
  );

  const rows = useMemo<PanelRow[]>(() => {
    if (!listReady) {
      return [];
    }

    const ret: PanelRow[] = [];

    const recentUsedAddresses = unionedRecentHistory.filter(
      item => !isAddrInWhitelist(item.toAddress, whitelist),
    );
    if (recentUsedAddresses.length) {
      ret.push({ kind: 'recent-title', key: 'recent-title' });
      recentUsedAddresses.forEach((history, index) => {
        const { account, inWhitelist } = findAccountWithoutBalance(
          history.toAddress,
        );
        ret.push({
          kind: 'recent',
          key: `recent-${history.toAddress}-${history.time}-${index}`,
          account,
          time: history.time,
          inWhitelist,
        });
      });
    } else {
      ret.push({ kind: 'spacer', key: 'recent-empty', size: SIZES.itemGap });
    }

    ret.push({ kind: 'whitelist', key: 'whitelist' });

    const pushAccountSection = (
      title: AccountSectionTitle,
      accounts: AccountToSelect[],
      expanded: boolean,
    ) => {
      if (!accounts.length) {
        return;
      }
      ret.push({ kind: 'section-title', key: `title-${title}`, title });
      if (!expanded) {
        return;
      }
      accounts.forEach((account, index) => {
        ret.push({
          kind: 'account',
          key: `account-${title}-${account.address}-${account.type}-${account.brandName}-${index}`,
          title,
          account,
          isPinned: isPinnedAccount(account),
        });
      });
    };

    if (myAddresses.length) {
      pushAccountSection(
        TxAccountPannelSectionTitle.MyAddresses,
        myAddresses,
        true,
      );
    } else {
      ret.push({ kind: 'spacer', key: 'my-empty', size: SIZES.itemGap });
    }
    pushAccountSection(
      TxAccountPannelSectionTitle.WatchAddresses,
      watchAddresses,
      !watchAddressNavCollapsed,
    );
    pushAccountSection(
      TxAccountPannelSectionTitle.SafeAddresses,
      safeAddresses,
      !safeAddressNavCollapsed,
    );

    return ret;
  }, [
    listReady,
    unionedRecentHistory,
    whitelist,
    findAccountWithoutBalance,
    myAddresses,
    watchAddresses,
    safeAddresses,
    watchAddressNavCollapsed,
    safeAddressNavCollapsed,
    isPinnedAccount,
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

  const renderSectionTitle = useCallback(
    (title: AccountSectionTitle) => {
      switch (title) {
        case TxAccountPannelSectionTitle.MyAddresses:
          return (
            <>
              <SectionTopSpace size={20} />
              <SectionCollapsableNav
                title={t('component.accountSelectModalTx.importedAccounts')}
              />
            </>
          );
        case TxAccountPannelSectionTitle.WatchAddresses:
          return (
            <>
              <SectionTopSpace size={24} />
              <SectionCollapsableNav
                title={t(
                  'page.addressDetail.addressListScreen.importWatchAddress',
                )}
                isCollapsed={watchAddressNavCollapsed}
                onCollapsedChange={setWatchAddressNavCollapsed}
              />
            </>
          );
        case TxAccountPannelSectionTitle.SafeAddresses:
          return (
            <>
              <SectionTopSpace size={24} />
              <SectionCollapsableNav
                title={t(
                  'page.addressDetail.addressListScreen.importSafeAddress',
                )}
                isCollapsed={safeAddressNavCollapsed}
                onCollapsedChange={setSafeAddressNavCollapsed}
              />
            </>
          );
        default:
          return null;
      }
    },
    [t, watchAddressNavCollapsed, safeAddressNavCollapsed],
  );

  const renderItem = useCallback(
    ({ item }: { item: PanelRow }) => {
      switch (item.kind) {
        case 'recent-title':
          return (
            <>
              <SectionTopSpace size={20} />
              <SectionCollapsableNav
                title={t('component.accountSelectModalTx.recentAccounts')}
              />
            </>
          );
        case 'recent':
          return (
            <RecentRow
              account={item.account}
              time={item.time}
              inWhitelist={item.inWhitelist}
              onSelect={onSelectAccount}
            />
          );
        case 'whitelist':
          return (
            <WhitelistBlock
              accounts={whitelistAccounts}
              myAccounts={myAccounts}
              scrollableRef={scrollableRef}
              onReorder={updateWhitelistOrder}
              onSelect={onSelectAccount}
              onNavTo={fnNavTo}
            />
          );
        case 'spacer':
          return <SectionTopSpace size={item.size} />;
        case 'section-title':
          return renderSectionTitle(item.title);
        case 'account':
          return (
            <AccountRow
              account={item.account}
              title={item.title}
              isPinned={item.isPinned}
              onSelect={onSelectAccount}
              defaultPressAction={defaultPressItemAction}
            />
          );
        default:
          return null;
      }
    },
    [
      t,
      onSelectAccount,
      whitelistAccounts,
      myAccounts,
      scrollableRef,
      updateWhitelistOrder,
      fnNavTo,
      renderSectionTitle,
      defaultPressItemAction,
    ],
  );

  const keyExtractor = useCallback((item: PanelRow) => item.key, []);

  const { safeOffBottom } = useSafeSizes();
  const listFooter = useMemo(
    () => <View style={{ height: 40 + safeOffBottom }} />,
    [safeOffBottom],
  );

  return (
    <View style={[styles.panel, containerStyle]}>
      {/* Keep the active sortable item outside the moving FlatList content so
          auto-scroll does not have to visually cancel the parent scroll. */}
      <Sortable.PortalProvider>
        <View style={styles.scrollViewContainer}>
          <BottomSheetFlatList<PanelRow>
            ref={setScrollableRef}
            style={styles.scrollView}
            data={rows}
            ListHeaderComponent={renderHeader}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            initialNumToRender={INITIAL_ROWS_TO_RENDER}
            maxToRenderPerBatch={INITIAL_ROWS_TO_RENDER}
            ListFooterComponent={listFooter}
          />
        </View>
      </Sortable.PortalProvider>
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
      minHeight: 106,
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
    addWhitelistHintContent: {
      width: '100%',
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'center',
      columnGap: 8,
      rowGap: 4,
    },
    addWhitelistHintButton: {
      maxWidth: '100%',
    },
    addWhitelistHintText: {
      maxWidth: '100%',
      textAlign: 'center',
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
    accountRow: {
      borderRadius: 16,
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
