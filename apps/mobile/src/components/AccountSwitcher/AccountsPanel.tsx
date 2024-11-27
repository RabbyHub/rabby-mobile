import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024, makeDebugBorder } from '@/utils/styles';
import {
  ScrollView,
  StyleProp,
  StyleSheet,
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
import { AddressItem } from '@/components2024/AddressItem/AddressItem';
import { ICONS_COMMON_2024 } from '@/assets2024/icons/common';
import RcIconCorrectCC from './icons/correct-cc.svg';
import { Account } from '@/core/services/preference';
import { trigger } from 'react-native-haptic-feedback';
import { LinearGradientContainer } from '@/components2024/ScreenContainer/LinearGradientContainer';
import { AddressItemInPanel, AddressItemSizes } from './AddressItemInPanel';
import { UseAllAccountsItemInPanel } from './AddressItemUseAll';

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
  forScene,
  containerStyle,
  onSwitchSceneAccount,
}: // isVisible = false,
AccountSwitcherAopProps<{
  // isVisible?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  onSwitchSceneAccount?: (ctx: {
    switchAction: () => void;
    sceneAccount: Account;
  }) => void;
}>) {
  const { styles } = useTheme2024({ getStyle: getPanelStyle });

  const { isVisible, toggleSceneVisible } = useAccountSceneVisible(forScene);

  const {
    isPinnedAccount,
    finalSceneCurrentAccount,

    isSceneSupportAllAccounts,
    isSceneUsingAllAccounts,

    myAddresses,
    safeAddresses,
    watchAddresses,
  } = useSceneAccountInfo({
    forScene,
    // disableAutoFetch: false,
  });

  const { switchSceneCurrentAccount, toggleUseAllAccountsOnScene } =
    useSwitchSceneCurrentAccount();

  const scrollViewRef = React.useRef<ScrollView>(null);
  const scrollToBottom = useCallback(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, []);

  const [safeAddressNavCollapsed, setSafeAddressNavCollapsed] =
    React.useState(true);
  const [watchAddressNavCollapsed, setWatchAddressNavCollapsed] =
    React.useState(true);

  const switchSceneAction = useCallback(
    (account: Account | null) => {
      switchSceneCurrentAccount(forScene, account);
      toggleSceneVisible(forScene, false);
    },
    [forScene, switchSceneCurrentAccount, toggleSceneVisible],
  );

  const handlePressAccount = useCallback<
    React.ComponentProps<typeof AddressItemInPanel>['onPressAddress'] & object
  >(
    async account => {
      if (typeof onSwitchSceneAccount === 'function') {
        const switchAction = () => {
          switchSceneAction(account);
        };
        onSwitchSceneAccount({ sceneAccount: account, switchAction });
      } else {
        switchSceneAction(account);
      }
    },
    [switchSceneAction, onSwitchSceneAccount],
  );

  const handlePressUseAll = useCallback(() => {
    console.debug('handlePressUseAll');
    toggleUseAllAccountsOnScene(forScene, true);
    toggleSceneVisible(forScene, false);
  }, [forScene, toggleUseAllAccountsOnScene, toggleSceneVisible]);

  return (
    <LinearGradientContainer
      type="linear"
      style={[styles.panel, containerStyle]}>
      <View style={styles.scrollViewContainer}>
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollViewContentContainer}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>My Addresses</Text>
            <View style={styles.addressListContainer}>
              {isSceneSupportAllAccounts && (
                <UseAllAccountsItemInPanel
                  style={{
                    marginBottom: AddressItemSizes.itemGap,
                    height: AddressItemSizes.useAllItemH,
                  }}
                  addressCount={myAddresses.length}
                  onPress={handlePressUseAll}
                  isSelected={isSceneUsingAllAccounts}
                />
              )}
              {myAddresses.map((account, index) => {
                const key = `account-${account.address}-${account.brandName}-${index}`;
                const isCurrent =
                  !isSceneUsingAllAccounts &&
                  isSameAccount(account, finalSceneCurrentAccount);

                return (
                  <AddressItemInPanel
                    key={key}
                    addressItemProps={{ account }}
                    isCurrent={isCurrent}
                    isPinned={isPinnedAccount(account)}
                    onPressAddress={handlePressAccount}
                    style={[index > 0 && styles.addressItemTopGap]}
                  />
                );
              })}
            </View>
          </View>
          {!!safeAddresses.length && (
            <View style={[styles.section, { marginTop: 18 }]}>
              <SectionCollapsableNav
                title="Imported Safe Addresses"
                isCollapsed={safeAddressNavCollapsed}
                onCollapsedChange={nextVal => {
                  setSafeAddressNavCollapsed(nextVal);
                  scrollToBottom();
                }}
              />
              {!safeAddressNavCollapsed && (
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
                        style={[index > 0 && styles.addressItemTopGap]}
                      />
                    );
                  })}
                </View>
              )}
            </View>
          )}
          {!!watchAddresses.length && (
            <View style={[styles.section, { marginTop: 18 }]}>
              <SectionCollapsableNav
                title="Imported Watch-only Addresses"
                isCollapsed={watchAddressNavCollapsed}
                onCollapsedChange={nextVal => {
                  setWatchAddressNavCollapsed(nextVal);
                  scrollToBottom();
                }}
              />
              {!watchAddressNavCollapsed && (
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
                        style={[index > 0 && styles.addressItemTopGap]}
                      />
                    );
                  })}
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </View>
      <View style={styles.bottomBarContainer}>
        <View style={styles.bottomBarStyle} />
      </View>
    </LinearGradientContainer>
  );
}
const getPanelStyle = createGetStyles2024(ctx => {
  return {
    panel: {
      position: 'relative',
      width: '100%',
      minHeight: 453,
      maxHeight: '80%',
      flexDirection: 'column',
    },
    scrollViewContainer: {
      height: '100%',
      flexShrink: 1,
    },
    scrollView: {
      padding: 16,
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
      justifyContent: 'flex-start',
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
