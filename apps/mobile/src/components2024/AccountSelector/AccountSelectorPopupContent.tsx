import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import type { StyleProp, ViewStyle } from 'react-native';
import { TouchableOpacity, View } from 'react-native';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { useRefreshAutoLockPanResponder } from '@/components/AutoLockView';

import { IS_ANDROID } from '@/core/native/utils';
import type { Account } from '@/core/startupServices/preference';
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
import { Text } from '@/components/Typography';

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

// Roughly one screen of address rows (78px + 12px gap) inside the sheet.
const INITIAL_ROWS_TO_RENDER = 10;

type SectionType = 'safe' | 'watch';
type RenderAccountNode = (ctx: {
  account: Account;
  isCurrent?: boolean;
}) => React.ReactNode;

/**
 * One flat, virtualized row model for the whole popup: rendering every
 * address with `.map()` inside a ScrollView mounted all rows (each with a
 * native context menu) before the sheet could animate in.
 */
type PanelRow =
  | {
      kind: 'account';
      key: string;
      account: Account;
      isCurrent: boolean;
      /** only the "my addresses" rows honor `isHideToken` */
      isMyAddress: boolean;
      withTopGap: boolean;
    }
  | {
      kind: 'section-title';
      key: string;
      section: SectionType;
    };

const PanelAccountRow = React.memo(function PanelAccountRow({
  account,
  isCurrent,
  isHideToken,
  withTopGap,
  renderRight,
  renderNameAddon,
  checkIconPosition,
  onPressAddress,
}: {
  account: Account;
  isCurrent: boolean;
  isHideToken?: boolean;
  withTopGap: boolean;
  renderRight?: RenderAccountNode;
  renderNameAddon?: RenderAccountNode;
  checkIconPosition?: 'name' | 'right';
  onPressAddress: (account: Account) => void;
}) {
  const { styles } = useTheme2024({ getStyle: getPanelStyle });
  const addressItemProps = useMemo(() => ({ account }), [account]);

  return (
    <AddressItemInPanel
      addressItemProps={addressItemProps}
      isCurrent={isCurrent}
      isHideToken={isHideToken}
      renderRight={renderRight}
      renderNameAddon={renderNameAddon}
      checkIconPosition={checkIconPosition}
      onPressAddress={onPressAddress}
      style={withTopGap ? styles.addressItemWithTopGap : styles.addressItem}
    />
  );
});

export const AccountSelectorPopupContent: React.FC<{
  containerStyle?: StyleProp<ViewStyle>;
  onChange?: (a: Account) => void;
  value?: Account | null;
  isHideToken?: boolean;
  isShowSafeAddressSection?: boolean;
  isShowWatchAddressSection?: boolean;
  title?: React.ReactNode;
  renderRight?: RenderAccountNode;
  renderNameAddon?: RenderAccountNode;
  sortAccounts?: (
    accounts: Account[],
    ctx: { type: 'my' | 'safe' | 'watch' },
  ) => Account[];
  checkIconPosition?: 'name' | 'right';
  renderRowTitle?: () => React.ReactNode;
}> = ({
  containerStyle,
  value: selectedAccount,
  onChange,
  isHideToken,
  isShowSafeAddressSection = true,
  isShowWatchAddressSection = true,
  title,
  renderRight,
  renderNameAddon,
  sortAccounts,
  checkIconPosition,
  renderRowTitle,
}) => {
  const { styles } = useTheme2024({ getStyle: getPanelStyle });
  const { panResponder } = useRefreshAutoLockPanResponder();

  const {
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

  const sortedMyAddresses = useMemo(() => {
    if (!sortAccounts) {
      return myAddresses;
    }
    const next = sortAccounts([...myAddresses], { type: 'my' });
    return next?.length ? next : myAddresses;
  }, [myAddresses, sortAccounts]);

  const sortedSafeAddresses = useMemo(() => {
    if (!sortAccounts) {
      return safeAddresses;
    }
    const next = sortAccounts([...safeAddresses], { type: 'safe' });
    return next?.length ? next : safeAddresses;
  }, [safeAddresses, sortAccounts]);

  const sortedWatchAddresses = useMemo(() => {
    if (!sortAccounts) {
      return watchAddresses;
    }
    const next = sortAccounts([...watchAddresses], { type: 'watch' });
    return next?.length ? next : watchAddresses;
  }, [watchAddresses, sortAccounts]);

  const rows = useMemo<PanelRow[]>(() => {
    const ret: PanelRow[] = [];

    const pushAccounts = (
      group: 'my' | SectionType,
      accounts: Account[],
      firstWithTopGap: boolean,
    ) => {
      accounts.forEach((account, index) => {
        ret.push({
          kind: 'account',
          key: `${group}-${account.address}-${account.type}-${account.brandName}-${index}`,
          account,
          isCurrent: isSameAccount(account, selectedAccount),
          isMyAddress: group === 'my',
          withTopGap: index > 0 || firstWithTopGap,
        });
      });
    };

    pushAccounts('my', sortedMyAddresses, false);

    const pushSection = (
      section: SectionType,
      show: boolean,
      accounts: Account[],
    ) => {
      if (!show || !accounts.length) {
        return;
      }
      ret.push({ kind: 'section-title', key: `title-${section}`, section });
      if (!navsCollapsed[section]) {
        pushAccounts(section, accounts, true);
      }
    };
    pushSection('safe', isShowSafeAddressSection, sortedSafeAddresses);
    pushSection('watch', isShowWatchAddressSection, sortedWatchAddresses);

    return ret;
  }, [
    selectedAccount,
    sortedMyAddresses,
    sortedSafeAddresses,
    sortedWatchAddresses,
    isShowSafeAddressSection,
    isShowWatchAddressSection,
    navsCollapsed,
  ]);

  const renderItem = useCallback(
    ({ item }: { item: PanelRow }) => {
      if (item.kind === 'section-title') {
        return (
          <View style={styles.sectionWithTopGap}>
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
      }

      return (
        <PanelAccountRow
          account={item.account}
          isCurrent={item.isCurrent}
          isHideToken={item.isMyAddress ? isHideToken : undefined}
          withTopGap={item.withTopGap}
          renderRight={renderRight}
          renderNameAddon={renderNameAddon}
          checkIconPosition={checkIconPosition}
          onPressAddress={handlePressAccount}
        />
      );
    },
    [
      t,
      styles.sectionWithTopGap,
      navsCollapsed,
      changeCollapsed,
      isHideToken,
      renderRight,
      renderNameAddon,
      checkIconPosition,
      handlePressAccount,
    ],
  );

  const keyExtractor = useCallback((item: PanelRow) => item.key, []);

  const listHeader = (
    <>
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
      {renderRowTitle?.()}
    </>
  );

  return (
    <BottomSheetFlatList<PanelRow>
      {...panResponder.panHandlers}
      style={[styles.panel, containerStyle]}
      contentContainerStyle={styles.listContentContainer}
      data={rows}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      ListHeaderComponent={listHeader}
      initialNumToRender={INITIAL_ROWS_TO_RENDER}
      maxToRenderPerBatch={INITIAL_ROWS_TO_RENDER}
    />
  );
};

const getPanelStyle = createGetStyles2024(ctx => {
  return {
    panel: {
      position: 'relative',
      width: '100%',
      flex: 1,
      backgroundColor: ctx.isLight
        ? ctx.colors2024['neutral-bg-0']
        : ctx.colors2024['neutral-bg-1'],
    },
    listContentContainer: {
      minHeight: 364,
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
    sectionWithTopGap: {
      flexDirection: 'column',
      width: '100%',
      marginTop: 30,
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
  };
});
