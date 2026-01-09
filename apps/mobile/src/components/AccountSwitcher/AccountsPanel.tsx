/* eslint-disable react-native/no-inline-styles */
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import {
  Dimensions,
  StyleProp,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';

import { default as RcCaretDownCC } from './icons/caret-down-cc.svg';
import TouchableView from '../Touchable/TouchableView';
import {
  isSameAccount,
  useSceneAccountInfo,
  useSwitchSceneCurrentAccount,
} from '@/hooks/accountsSwitcher';
import { AccountSwitcherAopProps, useAccountSceneVisible } from './hooks';
import React, { useCallback, useEffect, useMemo } from 'react';
import { Account } from '@/core/services/preference';
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
import { ITokenItem } from '@/store/tokens';
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

export function AccountsPanelInModal({
  allowNullCurrentAccount,
  forScene,
  containerStyle,
  linearContainerProps,
  onSwitchSceneAccount,
  token,
  scrollToBottom,
}: // isVisible = false,
AccountSwitcherAopProps<{
  // isVisible?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  linearContainerProps?: React.ComponentProps<typeof LinearGradientContainer>;
  onSwitchSceneAccount?: (ctx: {
    switchAction: () => Promise<void>;
    sceneAccount: Account;
  }) => void;
  token?: ITokenItem;
  scrollToBottom(): void;
}>) {
  const { styles, colors2024 } = useTheme2024({ getStyle: getPanelStyle });

  const { toggleSceneVisible } = useAccountSceneVisible(forScene);

  const ItemRenderItem = useMemo(() => {
    return token ? AddressItemInPanelForTokenDetail : AddressItemInPanel;
  }, [token]);

  const {
    isPinnedAccount,
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

  const switchSceneAction = useCallback(
    async (account: Account | null) => {
      await switchSceneCurrentAccount(forScene, account);
      toggleSceneVisible(forScene, false);
    },
    [forScene, switchSceneCurrentAccount, toggleSceneVisible],
  );

  const handlePressAccount = useCallback<
    React.ComponentProps<typeof AddressItemInPanel>['onPressAddress'] & object
  >(
    async account => {
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

  const renderRemainAddressesByType = useCallback(
    (
      accounts: ReturnType<typeof useSceneAccountInfo>['myAddresses'],
      type: 'notTop10Accounts' | 'gnosisAccounts' | 'watchAccounts',
      title: string,
    ) => {
      if (accounts.length === 0) {
        return null;
      }

      return (
        <>
          <View style={styles.sectionTitleContainerNew}>
            <Text style={styles.sectionTitle}>{title}</Text>
          </View>
          <>
            {accounts.map((account, index) => {
              const key = `account-${account.address}-${account.brandName}-${index}`;
              const isCurrent =
                !isSceneUsingAllAccounts &&
                isSameAccount(account, finalSceneCurrentAccount);
              return (
                <ItemRenderItem
                  key={key}
                  addressItemProps={{ account }}
                  isCurrent={isCurrent}
                  token={token}
                  // isPinned={false}
                  onPressAddress={handlePressAccount}
                  style={[
                    styles.addressItem,
                    index > 0 && styles.addressItemTopGap,
                  ]}
                />
              );
            })}
          </>
        </>
      );
    },
    [
      ItemRenderItem,
      finalSceneCurrentAccount,
      handlePressAccount,
      isSceneUsingAllAccounts,
      styles.addressItem,
      styles.addressItemTopGap,
      styles.sectionTitle,
      styles.sectionTitleContainerNew,
      token,
    ],
  );

  const notMatterAvatarList = useMemo(() => {
    return notMatterAddresses.slice(0, 3);
  }, [notMatterAddresses]);

  const TransactionMoreWallets = useMemo(() => {
    return notMatterAddresses.length ? (
      <View style={[styles.section, { marginTop: 30 }]}>
        <View style={styles.moreWalletsHintContainer}>
          <View style={styles.horizontalLine} />
          <Text style={styles.moreWalletsHint}>
            {t(
              'page.addressDetail.addressListScreen.notIncludedInTransactions',
            )}
          </Text>
          <View style={styles.horizontalLine} />
        </View>
        <TouchableOpacity
          style={styles.moreWalletsButtonContent}
          onPress={() => {
            setRemainAddressesCollapsed(!remainAddressesCollapsed);
          }}>
          <View
            style={[
              styles.moreWalletsButtonIcon,
              {
                marginLeft:
                  notMatterAvatarList.length === 2
                    ? -20
                    : notMatterAvatarList.length === 1
                    ? -38
                    : 0,
              },
            ]}>
            {notMatterAvatarList.map((account, index) => {
              const iconCount = notMatterAvatarList.length;
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
              remainAddressesCollapsed && {
                transform: [{ rotate: '180deg' }],
              },
            ]}
            width={18}
            height={18}
            color={colors2024['neutral-secondary']}
          />
        </TouchableOpacity>
        {remainAddressesCollapsed && (
          <View style={styles.addressListContainerNew}>
            {renderRemainAddressesByType(
              notTop10Accounts,
              'notTop10Accounts',
              t('page.addressDetail.notMatterAddressDialog.notTop10Address'),
            )}
            {renderRemainAddressesByType(
              safeAddresses,
              'gnosisAccounts',
              t('page.addressDetail.notMatterAddressDialog.safeWallet'),
            )}
            {renderRemainAddressesByType(
              watchAddresses,
              'watchAccounts',
              t('page.addressDetail.notMatterAddressDialog.watchOnlyWallet'),
            )}
          </View>
        )}
      </View>
    ) : null;
  }, [
    notTop10Accounts,
    safeAddresses,
    watchAddresses,
    colors2024,
    styles,
    t,
    notMatterAddresses,
    remainAddressesCollapsed,
    notMatterAvatarList,
    renderRemainAddressesByType,
  ]);

  const OtherWatchAndSafeWallets = useMemo(() => {
    return (
      <>
        {!!safeAddresses.length && (
          <View style={[styles.section, { marginTop: 30 }]}>
            <SectionCollapsableNav
              title={t(
                'page.addressDetail.addressListScreen.importSafeAddress',
              )}
              isCollapsed={navsCollapsed.safe}
              onCollapsedChange={nextVal => {
                changeCollapsed('safe', nextVal);
              }}
            />
            {!navsCollapsed.safe && (
              <View style={styles.addressListContainer}>
                {safeAddresses.map((account, index) => {
                  const key = `account-${account.address}-${account.brandName}-${index}`;
                  const isCurrent =
                    !isSceneUsingAllAccounts &&
                    isSameAccount(account, finalSceneCurrentAccount);

                  return (
                    <ItemRenderItem
                      key={key}
                      token={token}
                      addressItemProps={{ account }}
                      isCurrent={isCurrent}
                      onPressAddress={handlePressAccount}
                      style={[
                        styles.addressItem,
                        index > 0 && styles.addressItemTopGap,
                      ]}
                    />
                  );
                })}
              </View>
            )}
          </View>
        )}
        {!!watchAddresses.length && (
          <View style={[styles.section, { marginTop: 30 }]}>
            <SectionCollapsableNav
              title={t(
                'page.addressDetail.addressListScreen.importWatchAddress',
              )}
              isCollapsed={navsCollapsed.watch}
              onCollapsedChange={nextVal => {
                changeCollapsed('watch', nextVal);
              }}
            />
            {!navsCollapsed.watch && (
              <View style={styles.addressListContainer}>
                {watchAddresses.map((account, index) => {
                  const key = `account-${account.address}-${account.brandName}-${index}`;
                  const isCurrent =
                    !isSceneUsingAllAccounts &&
                    isSameAccount(account, finalSceneCurrentAccount);

                  return (
                    <ItemRenderItem
                      key={key}
                      token={token}
                      addressItemProps={{ account }}
                      isCurrent={isCurrent}
                      onPressAddress={handlePressAccount}
                      style={[
                        styles.addressItem,
                        index > 0 && styles.addressItemTopGap,
                      ]}
                    />
                  );
                })}
              </View>
            )}
          </View>
        )}
      </>
    );
  }, [
    safeAddresses,
    styles.section,
    styles.addressListContainer,
    styles.addressItem,
    styles.addressItemTopGap,
    t,
    navsCollapsed.safe,
    navsCollapsed.watch,
    watchAddresses,
    changeCollapsed,
    isSceneUsingAllAccounts,
    finalSceneCurrentAccount,
    ItemRenderItem,
    token,
    handlePressAccount,
  ]);

  const myAddressesList = useCreationWithShallowCompare(() => {
    return isSceneSupportAllAccounts ? myAddresses.slice(0, 10) : myAddresses;
  }, [myAddresses, isSceneSupportAllAccounts]);

  return (
    <LinearGradientContainer
      type="bg1"
      {...linearContainerProps}
      style={[styles.panel, containerStyle]}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('global.Wallets')}</Text>
      </View>
      <View style={styles.scrollViewContainer}>
        <View
          // ref={scrollViewRef}
          style={styles.scrollView}
          // contentContainerStyle={styles.scrollViewContentContainer}
        >
          <View style={styles.section}>
            <View style={[styles.addressListContainer, { marginTop: 0 }]}>
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
              {myAddressesList.map((account, index) => {
                const key = `account-${account.address}-${account.brandName}-${index}`;
                const isCurrent =
                  !isSceneUsingAllAccounts &&
                  isSameAccount(account, finalCurrentAccount);

                return (
                  <ItemRenderItem
                    key={key}
                    token={token}
                    addressItemProps={{ account }}
                    isCurrent={isCurrent}
                    isHideToken={isHideToken}
                    onPressAddress={handlePressAccount}
                    style={[
                      styles.addressItem,
                      index > 0 && styles.addressItemTopGap,
                    ]}
                  />
                );
              })}
            </View>
          </View>
          {isSceneSupportAllAccounts
            ? TransactionMoreWallets
            : OtherWatchAndSafeWallets}
        </View>
      </View>
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
      minHeight: '50%',
      height: '100%',
      flexDirection: 'column',
      paddingBottom: 44,
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
    addressItemTopGap: {
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
