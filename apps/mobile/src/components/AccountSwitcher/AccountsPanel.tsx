import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import {
  Dimensions,
  ScrollView,
  StyleProp,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';

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
import { AddressItemInPanel, AddressItemSizes } from './AddressItemInPanel';
import { UseAllAccountsItemInPanel } from './AddressItemUseAll';
import { ScreenWithAccountSwitcherLayouts } from '@/constant/layout';
import { useTranslation } from 'react-i18next';
import { IS_ANDROID } from '@/core/native/utils';

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
  scrollToBottom(): void;
}>) {
  const { styles } = useTheme2024({ getStyle: getPanelStyle });

  const { toggleSceneVisible } = useAccountSceneVisible(forScene);

  const {
    isPinnedAccount,
    sceneCurrentAccount,
    finalSceneCurrentAccount,

    isSceneSupportAllAccounts,
    isSceneUsingAllAccounts,

    myAddresses,
    safeAddresses,
    shouldSafeAddressesExpanded,
    watchAddresses,
    shouldWatchAddressesExpanded,
  } = useSceneAccountInfo({
    forScene,
  });

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
      if (!isSceneUsingAllAccounts) scrollToBottom();
    },
    [scrollToBottom, isSceneUsingAllAccounts],
  );

  useEffect(() => {
    if (shouldSafeAddressesExpanded) changeCollapsed('safe', false);
  }, [changeCollapsed, shouldSafeAddressesExpanded]);
  useEffect(() => {
    if (shouldWatchAddressesExpanded) changeCollapsed('watch', false);
  }, [changeCollapsed, shouldWatchAddressesExpanded]);

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

  return (
    <LinearGradientContainer
      type="linear"
      {...linearContainerProps}
      style={[styles.panel, containerStyle]}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('global.Addresses')}</Text>
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
              {myAddresses.map((account, index) => {
                const key = `account-${account.address}-${account.brandName}-${index}`;
                const isCurrent =
                  !isSceneUsingAllAccounts &&
                  isSameAccount(account, finalCurrentAccount);

                return (
                  <AddressItemInPanel
                    key={key}
                    addressItemProps={{ account }}
                    isCurrent={isCurrent}
                    isPinned={isPinnedAccount(account)}
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
                      <AddressItemInPanel
                        key={key}
                        addressItemProps={{ account }}
                        isCurrent={isCurrent}
                        isPinned={false}
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
                      <AddressItemInPanel
                        key={key}
                        addressItemProps={{ account }}
                        isCurrent={isCurrent}
                        isPinned={false}
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
      fontWeight: '800',
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
    addressItem: !IS_ANDROID
      ? {}
      : {
          borderWidth: 1,
          borderStyle: 'solid',
          borderColor: ctx.colors2024['neutral-line'],
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
  };
});
