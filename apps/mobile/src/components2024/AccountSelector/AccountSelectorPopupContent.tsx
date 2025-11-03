import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import {
  StyleProp,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';

import { IS_ANDROID } from '@/core/native/utils';
import { Account } from '@/core/services/preference';
import { isSameAccount } from '@/hooks/accountsSwitcher';
import { useMemoizedFn } from 'ahooks';
import React, { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { default as RcCaretDownCC } from './icons/caret-down-cc.svg';
import { useAccountSelectorList } from './useAccountSelectorList';
import {
  AddressItemInPanel,
  AddressItemSizes,
} from '@/components/AccountSwitcher/AddressItemInPanel';

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
          !isCollapsed && { transform: [{ rotate: '180deg' }] },
        ]}
        width={18}
        height={18}
        color={colors2024['neutral-secondary']}
      />
    </TouchableOpacity>
  );
};

export const AccountSelectorPopupContent: React.FC<{
  containerStyle?: StyleProp<ViewStyle>;
  onChange?: (a: Account) => void;
  value?: Account | null;
  scrollToBottom(): void;
  isHideToken?: boolean;
  isShowSafeAddressSection?: boolean;
  isShowWatchAddressSection?: boolean;
  title?: React.ReactNode;
}> = ({
  containerStyle,
  value: selectedAccount,
  onChange,
  scrollToBottom,
  isHideToken,
  isShowSafeAddressSection = true,
  isShowWatchAddressSection = true,
  title,
}) => {
  const { styles } = useTheme2024({ getStyle: getPanelStyle });

  const {
    isPinnedAccount,

    myAddresses,
    safeAddresses,
    shouldSafeAddressesExpanded,
    watchAddresses,
    shouldWatchAddressesExpanded,
  } = useAccountSelectorList({
    selectedAccount: selectedAccount,
  });

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
      // if (!isSceneUsingAllAccounts) scrollToBottom();
    },
    [],
  );

  const handlePressAccount = useMemoizedFn((account: Account) => {
    onChange?.(account);
  });

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

  const { t } = useTranslation();

  return (
    <View style={[styles.panel, containerStyle]}>
      <View style={styles.header}>
        {title ? (
          typeof title === 'string' ? (
            <Text style={styles.title}>{title}</Text>
          ) : (
            title
          )
        ) : (
          <Text style={styles.title}>
            {t('component.AccountSelector.title')}
          </Text>
        )}
      </View>
      <View style={styles.scrollViewContainer}>
        <View
          // ref={scrollViewRef}
          style={styles.scrollView}
          // contentContainerStyle={styles.scrollViewContentContainer}
        >
          <View style={styles.section}>
            <View style={[styles.addressListContainer, { marginTop: 0 }]}>
              {/* {isSceneSupportAllAccounts && (
                <UseAllAccountsItemInPanel
                  style={{
                    marginBottom: AddressItemSizes.itemGap,
                    height: AddressItemSizes.useAllItemH,
                  }}
                  allAccounts={myAddresses}
                  onPress={handlePressUseAll}
                  isSelected={isSceneUsingAllAccounts}
                />
              )} */}
              {myAddresses.map((account, index) => {
                const key = `account-${account.address}-${account.brandName}-${index}`;
                const isCurrent = isSameAccount(account, selectedAccount);

                return (
                  <AddressItemInPanel
                    key={key}
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
          {isShowSafeAddressSection && !!safeAddresses.length && (
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
                    const isCurrent = isSameAccount(account, selectedAccount);

                    return (
                      <AddressItemInPanel
                        key={key}
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
          {isShowWatchAddressSection && !!watchAddresses.length && (
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
                    const isCurrent = isSameAccount(account, selectedAccount);

                    return (
                      <AddressItemInPanel
                        key={key}
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
        </View>
      </View>
    </View>
  );
};

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
  };
});
