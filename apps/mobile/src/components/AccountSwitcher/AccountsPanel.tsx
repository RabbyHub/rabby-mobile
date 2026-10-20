/* eslint-disable react-native/no-inline-styles */
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import type { StyleProp, ViewStyle } from 'react-native';
import { Dimensions, TouchableOpacity, View } from 'react-native';
import {
  BottomSheetFlatList,
  type BottomSheetFlatListMethods,
} from '@gorhom/bottom-sheet';
import { useRefreshAutoLockPanResponder } from '../AutoLockView';

import { default as RcCaretDownCC } from './icons/caret-down-cc.svg';
import TouchableView from '../Touchable/TouchableView';
import {
  isSameAccount,
  useSceneAccountInfo,
  useSwitchSceneCurrentAccount,
} from '@/hooks/accountsSwitcher';
import type { AccountSwitcherAopProps } from './hooks';
import { useAccountSceneVisible } from './hooks';
import React, { useCallback, useEffect, useMemo } from 'react';
import type { Account } from '@/core/startupServices/preference';
import { LinearGradientContainer } from '@/components2024/ScreenContainer/LinearGradientContainer';
import {
  AddressItemInPanel,
  AddressItemInPanelForTokenDetail,
  AddressItemSizes,
} from './AddressItemInPanel';
import { UseAllAccountsItemInPanel } from './AddressItemUseAll';
import { ScreenWithAccountSwitcherLayouts } from '@/constant/layout';
import { useTranslation } from 'react-i18next';
import { IS_ANDROID } from '@/core/native/utils';
import { WalletIcon } from '@/components2024/WalletIcon/WalletIcon';
import { useCreationWithShallowCompare } from '@/hooks/common/useMemozied';
import { AbstractPortfolioToken } from '@/screens/Home/types';
import type { ITokenItem } from '@/store/tokens';
import { Text } from '@/components/Typography';

export type AccountDisabledTipsResolver = (
  account: Account,
) => string | undefined;

const SectionCollapsableNav = function ({
  isCollapsed = false,
  title,
  onCollapsedChange,
}: {
  isCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  title: React.ReactNode;
}) {
  const { styles, colors2024 } = useTheme2024({
    getStyle: getPanelStyle,
  });

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
    <TouchableView
      style={styles.sectionTitleContainer}
      onPress={() => {
        onCollapsedChange?.(!isCollapsed);
      }}>
      {tilteNode}
      <RcCaretDownCC
        style={[
          { marginLeft: 4 },
          !isCollapsed && { transform: [{ rotate: '180deg' }] },
        ]}
        width={18}
        height={18}
        color={colors2024['neutral-secondary']}
      />
    </TouchableView>
  );
};

// Roughly one screen of address rows (78px + 12px gap) inside the sheet.
const INITIAL_ROWS_TO_RENDER = 10;
const PANEL_MIN_CONTENT_H = 364;

type PanelSectionType = 'safe' | 'watch';

/**
 * One flat, virtualized row model for the whole panel.
 *
 * The panel used to `.map()` every address into a `BottomSheetScrollView`, so
 * opening the switcher mounted all rows (each with a native context menu) in
 * the same commit the sheet needed before it could animate in.
 */
type PanelRow =
  | {
      kind: 'account';
      key: string;
      account: Account;
      /** only the "my addresses" rows honor the scene's hide-token flag */
      isMyAddress: boolean;
      isCurrent: boolean;
      disabledTips?: string;
      withTopGap: boolean;
    }
  | {
      /** "not included in transactions" divider + collapse toggle */
      kind: 'more-wallets';
      key: string;
    }
  | {
      kind: 'group-title';
      key: string;
      title: string;
    }
  | {
      kind: 'collapsable-title';
      key: string;
      section: PanelSectionType;
    };

const PanelAccountRow = React.memo(function PanelAccountRow({
  ItemRenderItem,
  account,
  isCurrent,
  token,
  isHideToken,
  disabledTips,
  withTopGap,
  onPressAddress,
}: {
  ItemRenderItem:
    | typeof AddressItemInPanel
    | typeof AddressItemInPanelForTokenDetail;
  account: Account;
  isCurrent: boolean;
  token?: ITokenItem;
  isHideToken?: boolean;
  disabledTips?: string;
  withTopGap: boolean;
  onPressAddress: (account: Account) => void;
}) {
  const { styles } = useTheme2024({ getStyle: getPanelStyle });
  const addressItemProps = useMemo(() => ({ account }), [account]);

  return (
    <ItemRenderItem
      token={token}
      addressItemProps={addressItemProps}
      isCurrent={isCurrent}
      isHideToken={isHideToken}
      disabledTips={disabledTips}
      onPressAddress={onPressAddress}
      style={withTopGap ? styles.addressItemWithTopGap : styles.addressItem}
    />
  );
});

const MoreWalletsToggle = React.memo(function MoreWalletsToggle({
  avatarAccounts,
  expanded,
  onToggle,
}: {
  avatarAccounts: Account[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const { styles, colors2024 } = useTheme2024({ getStyle: getPanelStyle });
  const { t } = useTranslation();

  return (
    <View style={[styles.section, { marginTop: 30 }]}>
      <View style={styles.moreWalletsHintContainer}>
        <View style={styles.horizontalLine} />
        <Text style={styles.moreWalletsHint}>
          {t('page.addressDetail.addressListScreen.notIncludedInTransactions')}
        </Text>
        <View style={styles.horizontalLine} />
      </View>
      <TouchableOpacity
        style={styles.moreWalletsButtonContent}
        onPress={onToggle}>
        <View
          style={[
            styles.moreWalletsButtonIcon,
            {
              marginLeft:
                avatarAccounts.length === 2
                  ? -20
                  : avatarAccounts.length === 1
                  ? -38
                  : 0,
            },
          ]}>
          {avatarAccounts.map((account, index) => {
            const iconCount = avatarAccounts.length;
            // calculate the total width of the icon group
            const totalIconsWidth =
              iconCount === 1 ? 22 : 22 + (iconCount - 1) * 16;
            // container width
            const containerWidth = 62;
            // calculate the start offset, make the icon group centered, but slightly right
            const startOffset = Math.max(
              0,
              containerWidth - totalIconsWidth - 4,
            );

            return (
              <View
                key={account.address}
                style={[
                  styles.stackedIcon,
                  {
                    zIndex: index + 1,
                    left: startOffset + index * 16,
                    top: -2,
                  },
                ]}>
                <WalletIcon
                  address={account.address}
                  type={account.type}
                  width={22}
                  height={22}
                  borderRadius={8}
                />
              </View>
            );
          })}
        </View>
        <Text style={styles.moreWalletsButtonText}>
          {t('page.addressDetail.addressListScreen.moreWallets')}
        </Text>
        <RcCaretDownCC
          style={[
            { marginLeft: 4 },
            expanded && {
              transform: [{ rotate: '180deg' }],
            },
          ]}
          width={18}
          height={18}
          color={colors2024['neutral-secondary']}
        />
      </TouchableOpacity>
    </View>
  );
});

export function AccountsPanelInModal({
  allowNullCurrentAccount,
  forScene,
  containerStyle,
  linearContainerProps,
  onSwitchSceneAccount,
  token,
  getAccountDisabledTips,
}: AccountSwitcherAopProps<{
  containerStyle?: StyleProp<ViewStyle>;
  linearContainerProps?: React.ComponentProps<typeof LinearGradientContainer>;
  onSwitchSceneAccount?: (ctx: {
    switchAction: () => Promise<void>;
    sceneAccount: Account;
  }) => void;
  token?: ITokenItem;
  getAccountDisabledTips?: AccountDisabledTipsResolver;
}>) {
  const { styles, isLight } = useTheme2024({
    getStyle: getPanelStyle,
  });
  const { panResponder } = useRefreshAutoLockPanResponder();

  const listRef = React.useRef<BottomSheetFlatListMethods>(null);
  const scrollToBottom = useCallback(() => {
    listRef.current?.scrollToEnd({ animated: true });
  }, []);

  const { toggleSceneVisible } = useAccountSceneVisible(forScene);

  const ItemRenderItem = token
    ? AddressItemInPanelForTokenDetail
    : AddressItemInPanel;

  const {
    sceneCurrentAccount,
    finalSceneCurrentAccount,

    isSceneSupportAllAccounts,
    isSceneUsingAllAccounts,

    myAddresses,
    safeAddresses,
    watchAddresses,
    shouldSafeAddressesExpanded,
    shouldWatchAddressesExpanded,
    isHideToken,
  } = useSceneAccountInfo({
    forScene,
  });

  const notTop10Accounts = useMemo(() => {
    return myAddresses.slice(10);
  }, [myAddresses]);

  const notMatterAddresses = useMemo(() => {
    return [...notTop10Accounts, ...safeAddresses, ...watchAddresses];
  }, [notTop10Accounts, safeAddresses, watchAddresses]);

  const finalCurrentAccount =
    allowNullCurrentAccount && !sceneCurrentAccount
      ? null
      : finalSceneCurrentAccount;

  const { switchSceneCurrentAccount, toggleUseAllAccountsOnScene } =
    useSwitchSceneCurrentAccount();

  const [navsCollapsed, setNavsCollapsed] = React.useState({
    safe: !shouldSafeAddressesExpanded,
    watch: !shouldWatchAddressesExpanded,
  });

  const changeCollapsed = useCallback(
    (type: keyof typeof navsCollapsed, nextCollapsed: boolean) => {
      if (type === 'safe') {
        setNavsCollapsed(prev => ({ ...prev, safe: nextCollapsed }));
      } else {
        setNavsCollapsed(prev => ({ ...prev, watch: nextCollapsed }));
      }
      if (!isSceneUsingAllAccounts) {
        scrollToBottom();
      }
    },
    [scrollToBottom, isSceneUsingAllAccounts],
  );

  useEffect(() => {
    if (shouldSafeAddressesExpanded) {
      changeCollapsed('safe', false);
    }
  }, [changeCollapsed, shouldSafeAddressesExpanded]);
  useEffect(() => {
    if (shouldWatchAddressesExpanded) {
      changeCollapsed('watch', false);
    }
  }, [changeCollapsed, shouldWatchAddressesExpanded]);

  const shouldRemainAddressesCollapsed = useMemo(() => {
    return (
      notMatterAddresses.findIndex(account =>
        isSameAccount(account, finalSceneCurrentAccount),
      ) > -1 && !isSceneUsingAllAccounts
    );
  }, [notMatterAddresses, finalSceneCurrentAccount, isSceneUsingAllAccounts]);

  const [remainAddressesCollapsed, setRemainAddressesCollapsed] =
    React.useState(shouldRemainAddressesCollapsed);

  useEffect(() => {
    if (shouldRemainAddressesCollapsed) {
      setRemainAddressesCollapsed(true);
      scrollToBottom();
    }
  }, [scrollToBottom, shouldRemainAddressesCollapsed]);

  const toggleRemainAddresses = useCallback(() => {
    setRemainAddressesCollapsed(prev => !prev);
  }, []);

  const switchSceneAction = useCallback(
    async (account: Account | null) => {
      await switchSceneCurrentAccount(forScene, account);
      toggleSceneVisible(forScene, false);
    },
    [forScene, switchSceneCurrentAccount, toggleSceneVisible],
  );

  const handlePressAccount = useCallback(
    async (account: Account) => {
      if (typeof onSwitchSceneAccount === 'function') {
        const switchAction = async () => {
          await switchSceneAction(account);
        };
        onSwitchSceneAccount({ sceneAccount: account, switchAction });
      } else {
        await switchSceneAction(account);
      }
    },
    [switchSceneAction, onSwitchSceneAccount],
  );

  const handlePressUseAll = useCallback(() => {
    toggleUseAllAccountsOnScene(forScene, true);
    toggleSceneVisible(forScene, false);
  }, [forScene, toggleUseAllAccountsOnScene, toggleSceneVisible]);

  const { t } = useTranslation();

  const notMatterAvatarList = useMemo(() => {
    return notMatterAddresses.slice(0, 3);
  }, [notMatterAddresses]);

  const myAddressesList = useCreationWithShallowCompare(() => {
    return isSceneSupportAllAccounts ? myAddresses.slice(0, 10) : myAddresses;
  }, [myAddresses, isSceneSupportAllAccounts]);

  const rows = useMemo<PanelRow[]>(() => {
    const ret: PanelRow[] = [];

    const pushAccounts = (
      group: string,
      accounts: Account[],
      currentAccount: Account | null,
      firstWithTopGap: boolean,
    ) => {
      accounts.forEach((account, index) => {
        ret.push({
          kind: 'account',
          key: `${group}-${account.address}-${account.type}-${account.brandName}-${index}`,
          account,
          isMyAddress: group === 'my',
          isCurrent:
            !isSceneUsingAllAccounts && isSameAccount(account, currentAccount),
          disabledTips: getAccountDisabledTips?.(account),
          withTopGap: index > 0 || firstWithTopGap,
        });
      });
    };

    pushAccounts('my', myAddressesList, finalCurrentAccount, false);

    if (isSceneSupportAllAccounts) {
      if (!notMatterAddresses.length) {
        return ret;
      }
      ret.push({ kind: 'more-wallets', key: 'more-wallets' });
      if (!remainAddressesCollapsed) {
        return ret;
      }
      const pushGroup = (group: string, accounts: Account[], title: string) => {
        if (!accounts.length) {
          return;
        }
        ret.push({ kind: 'group-title', key: `title-${group}`, title });
        pushAccounts(group, accounts, finalSceneCurrentAccount, false);
      };
      pushGroup(
        'notTop10',
        notTop10Accounts,
        t('page.addressDetail.notMatterAddressDialog.notTop10Address'),
      );
      pushGroup(
        'safe',
        safeAddresses,
        t('page.addressDetail.notMatterAddressDialog.safeWallet'),
      );
      pushGroup(
        'watch',
        watchAddresses,
        t('page.addressDetail.notMatterAddressDialog.watchOnlyWallet'),
      );
      return ret;
    }

    const pushCollapsableSection = (
      section: PanelSectionType,
      accounts: Account[],
    ) => {
      if (!accounts.length) {
        return;
      }
      ret.push({
        kind: 'collapsable-title',
        key: `collapsable-${section}`,
        section,
      });
      if (!navsCollapsed[section]) {
        pushAccounts(section, accounts, finalSceneCurrentAccount, true);
      }
    };
    pushCollapsableSection('safe', safeAddresses);
    pushCollapsableSection('watch', watchAddresses);

    return ret;
  }, [
    t,
    myAddressesList,
    finalCurrentAccount,
    finalSceneCurrentAccount,
    isSceneSupportAllAccounts,
    isSceneUsingAllAccounts,
    notMatterAddresses.length,
    remainAddressesCollapsed,
    notTop10Accounts,
    safeAddresses,
    watchAddresses,
    navsCollapsed,
    getAccountDisabledTips,
  ]);

  const renderItem = useCallback(
    ({ item }: { item: PanelRow }) => {
      switch (item.kind) {
        case 'account':
          return (
            <PanelAccountRow
              ItemRenderItem={ItemRenderItem}
              account={item.account}
              isCurrent={item.isCurrent}
              token={token}
              isHideToken={item.isMyAddress ? isHideToken : undefined}
              disabledTips={item.disabledTips}
              withTopGap={item.withTopGap}
              onPressAddress={handlePressAccount}
            />
          );
        case 'more-wallets':
          return (
            <MoreWalletsToggle
              avatarAccounts={notMatterAvatarList}
              expanded={remainAddressesCollapsed}
              onToggle={toggleRemainAddresses}
            />
          );
        case 'group-title':
          return (
            <View style={styles.sectionTitleContainerNew}>
              <Text style={styles.sectionTitle}>{item.title}</Text>
            </View>
          );
        case 'collapsable-title':
          return (
            <View style={[styles.section, { marginTop: 30 }]}>
              <SectionCollapsableNav
                title={t(
                  item.section === 'safe'
                    ? 'page.addressDetail.addressListScreen.importSafeAddress'
                    : 'page.addressDetail.addressListScreen.importWatchAddress',
                )}
                isCollapsed={navsCollapsed[item.section]}
                onCollapsedChange={nextVal => {
                  changeCollapsed(item.section, nextVal);
                }}
              />
            </View>
          );
        default:
          return null;
      }
    },
    [
      t,
      ItemRenderItem,
      token,
      isHideToken,
      handlePressAccount,
      notMatterAvatarList,
      remainAddressesCollapsed,
      toggleRemainAddresses,
      navsCollapsed,
      changeCollapsed,
      styles.section,
      styles.sectionTitle,
      styles.sectionTitleContainerNew,
    ],
  );

  const keyExtractor = useCallback((item: PanelRow) => item.key, []);

  const listHeader = useMemo(
    () => (
      <>
        <View style={styles.header}>
          <Text style={styles.title}>{t('global.Wallets')}</Text>
        </View>
        {isSceneSupportAllAccounts && (
          <UseAllAccountsItemInPanel
            style={{
              marginBottom: AddressItemSizes.itemGap,
              height: AddressItemSizes.useAllItemH,
            }}
            allAccounts={myAddresses}
            onPress={handlePressUseAll}
            isSelected={isSceneUsingAllAccounts}
          />
        )}
        {!!token && (
          <View style={styles.tokenHeader}>
            <Text style={styles.headerBalanceText}>
              {t('page.tokenDetail.headerBalanceText')}{' '}
            </Text>
            <Text style={styles.headerTokenValueText}>
              {t('page.tokenDetail.headerTokenValueText')}
            </Text>
          </View>
        )}
      </>
    ),
    [
      t,
      styles,
      isSceneSupportAllAccounts,
      myAddresses,
      handlePressUseAll,
      isSceneUsingAllAccounts,
      token,
    ],
  );

  return (
    <LinearGradientContainer
      type={isLight ? 'bg0' : 'bg1'}
      {...linearContainerProps}
      style={[styles.panel, containerStyle]}>
      <BottomSheetFlatList<PanelRow>
        {...panResponder.panHandlers}
        ref={listRef}
        data={rows}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={listHeader}
        contentContainerStyle={styles.listContentContainer}
        initialNumToRender={INITIAL_ROWS_TO_RENDER}
        maxToRenderPerBatch={INITIAL_ROWS_TO_RENDER}
      />
    </LinearGradientContainer>
  );
}

export function getAccountsPanelInModalMaxHeight() {
  const winInfo = Dimensions.get('window');

  return winInfo.height - ScreenWithAccountSwitcherLayouts.modalBottomSpace;
}
const getPanelStyle = createGetStyles2024(ctx => {
  return {
    moreWalletsButtonContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
    },
    moreWalletsButtonText: {
      fontSize: 16,
      fontWeight: '500',
      lineHeight: 20,
      fontFamily: 'SF Pro Rounded',
      color: ctx.colors2024['neutral-secondary'],
    },
    moreWalletsButtonIcon: {
      position: 'relative',
      width: 62, // 22 + 10 + 10 + 20 (icon width + 2 overlaps + extra space)
      height: 22,
      marginRight: 4,
    },
    moreWalletsContainer: {
      marginTop: 24,
      gap: 24,
    },
    moreWalletsHint: {
      fontSize: 14,
      fontWeight: '500',
      lineHeight: 18,
      fontFamily: 'SF Pro Rounded',
      color: ctx.colors2024['neutral-info'],
      // textAlign: 'center',
    },
    moreWalletsHintContainer: {
      // marginBottom: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginBottom: 30,
    },
    horizontalLine: {
      flex: 1,
      height: 1,
      backgroundColor: ctx.colors2024['neutral-line'],
    },
    stackedIcon: {
      position: 'absolute',
      borderWidth: 2,
      borderColor: ctx.colors2024['neutral-bg-1'],
      borderRadius: 10,
    },
    panel: {
      position: 'relative',
      width: '100%',
      flex: 1,
      flexDirection: 'column',
    },
    listContentContainer: {
      minHeight: PANEL_MIN_CONTENT_H,
      paddingHorizontal: 16,
      paddingBottom: 16 + 44,
    },
    header: {
      marginBottom: 24,
    },
    title: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 20,
      fontWeight: '900',
      lineHeight: 24,
      color: ctx.colors2024['neutral-title-1'],
      textAlign: 'center',
    },
    scrollViewContainer: {
      height: '100%',
      flexShrink: 1,
    },
    scrollView: {
      paddingHorizontal: 16,
      paddingBottom: 16,
    },
    scrollViewContentContainer: {
      alignItems: 'flex-start',
      justifyContent: 'flex-start',
      paddingBottom: 20 + 40,
    },
    section: {
      flexDirection: 'column',
      width: '100%',
      // ...makeDebugBorder('red'),
    },
    sectionTitleContainerNew: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
      paddingVertical: 12,
      marginTop: 12,
    },
    sectionTitleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    sectionTitle: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 16,
      fontWeight: '500',
      lineHeight: 20,
      color: ctx.colors2024['neutral-secondary'],
    },
    addressListContainer: {
      flexDirection: 'column',
      marginTop: 12,
      // maxHeight: SIZES.myAddressesAreaVisiableH,
      width: '100%',
    },
    addressListContainerNew: {
      flexDirection: 'column',
      // maxHeight: SIZES.myAddressesAreaVisiableH,
      width: '100%',
    },
    addressItem: !IS_ANDROID
      ? {}
      : {
          // borderWidth: 1,
          // borderStyle: 'solid',
          // borderColor: ctx.colors2024['neutral-line'],
        },
    addressItemWithTopGap: {
      marginTop: AddressItemSizes.itemGap,
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
    tokenHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 4,
      paddingHorizontal: 10,
      marginBottom: 8,
    },
    headerBalanceText: {
      fontSize: 16,
      lineHeight: 20,
      fontFamily: 'SF Pro Rounded',
      color: ctx.colors2024['neutral-secondary'],
      fontWeight: '400',
    },
    headerTokenValueText: {
      fontSize: 16,
      lineHeight: 20,
      fontFamily: 'SF Pro Rounded',
      color: ctx.colors2024['neutral-secondary'],
      fontWeight: '400',
    },
  };
});
