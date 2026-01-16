import React from 'react';
import {
  View,
  RefreshControl,
  Platform,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { BottomSheetModalMethods } from '@gorhom/bottom-sheet/src/types';

import {
  ApprovalsTabView,
  NotMatchedHolder,
  SelectionCheckbox,
  getScrollableSectionHeight,
} from './components/Layout';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { useApprovalsPage } from './useApprovalsPage';
import { Tabs } from 'react-native-collapsible-tab-view';
import { useFocusEffect } from '@react-navigation/native';
import { SkeletonListByAssets } from './components/Skeleton';
import { ApprovalsLayouts } from './layout';
import {
  EIP7702Delegated,
  EIP7702_REVOKE_SUPPORTED_CHAINS,
  useEIP7702Approvals,
} from './useEIP7702Approvals';
import ChainIconImage from '@/components/Chain/ChainIconImage';
import { findChainByEnum } from '@/utils/chain';
import {
  RcArrowRight2CC,
  RcIconCopyRegularCC,
  RcIconJumpCC,
} from '@/assets/icons/common';
import { RcIconWarningCC } from '@/assets2024/icons/common';
import { CopyAddressIcon } from '@/components/AddressViewer/CopyAddress';
import { ellipsisAddress } from '@/utils/address';
import { openTxExternalUrl } from '@/utils/transaction';
import { EIP7702SupportedChainsSheet } from './components/EIP7702SupportedChainsSheet';
import { CHAINS_ENUM } from '@/constant/chains';
import { useTranslation } from 'react-i18next';

const isIOS = Platform.OS === 'ios';
function EIP7702Header({
  chainEnums,
  isSupportedAccount,
  onPressSupportedChains,
}: {
  chainEnums: Array<CHAINS_ENUM | string>;
  isSupportedAccount: boolean;
  onPressSupportedChains: () => void;
}) {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  return (
    <View style={styles.headerContainer}>
      {!isSupportedAccount && (
        <View style={styles.warningContainer}>
          <View style={styles.warningTitleRow}>
            <RcIconWarningCC
              width={18}
              height={18}
              color={colors2024['orange-default']}
            />
            <Text style={styles.warningTitleText}>
              {t('page.approvals.eip7702.unsupportedTitle')}
            </Text>
          </View>
          <Text style={styles.warningText}>
            {t('page.approvals.eip7702.unsupportedDesc')}
          </Text>
        </View>
      )}
      <View
        style={[
          styles.headerRow,
          !isSupportedAccount && styles.disabledContent,
        ]}>
        <Text style={styles.headerLabel}>
          {t('page.approvals.delegatedAddress')}
        </Text>
        <TouchableOpacity
          activeOpacity={0.7}
          disabled={!isSupportedAccount}
          onPress={onPressSupportedChains}
          style={styles.supportedChainsButton}>
          <View style={styles.supportedChainsMain}>
            <View style={styles.supportedChainsIcons}>
              {chainEnums.map((chainEnum, index) => (
                <ChainIconImage
                  key={chainEnum}
                  chainEnum={chainEnum}
                  size={18}
                  containerStyle={StyleSheet.flatten([
                    styles.supportedChainIcon,
                    index > 0 && styles.supportedChainIconOverlap,
                  ])}
                />
              ))}
            </View>
            <Text style={styles.supportedChainsText}>
              {t('page.approvals.supportedChains')}
            </Text>
          </View>
          <RcArrowRight2CC
            width={12}
            height={12}
            color={colors2024['neutral-foot']}
            style={styles.supportedChainsArrow}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function EIP7702Row({ item }: { item: EIP7702Delegated }) {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { selectedRows, toggleSelectedRow, isSupportedAccount } =
    useEIP7702Approvals();

  const isSelected = React.useMemo(() => {
    return selectedRows.some(
      row =>
        row.chain === item.chain &&
        row.delegatedAddress?.toLowerCase() ===
          item.delegatedAddress?.toLowerCase(),
    );
  }, [selectedRows, item]);

  const chainInfo = React.useMemo(
    () => findChainByEnum(item.chain),
    [item.chain],
  );

  const addressText = React.useMemo(
    () => ellipsisAddress(item.delegatedAddress || '', 4).toLowerCase(),
    [item.delegatedAddress],
  );

  const handleJump = React.useCallback(
    (evt?: { stopPropagation?: () => void }) => {
      evt?.stopPropagation?.();
      openTxExternalUrl({
        chain: chainInfo,
        address: item.delegatedAddress,
      });
    },
    [chainInfo, item.delegatedAddress],
  );

  return (
    <TouchableOpacity
      activeOpacity={isSupportedAccount ? 0.7 : 1}
      disabled={!isSupportedAccount}
      style={[
        styles.card,
        isSelected && styles.cardSelected,
        !isSupportedAccount && styles.disabledContent,
      ]}
      onPress={() => toggleSelectedRow(item)}>
      <View style={styles.cardRow}>
        <SelectionCheckbox
          isSelectedAll={isSelected}
          isSelectedPartial={false}
          size={24}
          style={styles.checkbox}
        />
        <View style={styles.addressRow}>
          {chainInfo ? (
            <ChainIconImage
              chainEnum={chainInfo.enum}
              size={46}
              containerStyle={styles.chainIcon}
            />
          ) : (
            <View style={styles.chainIconFallback} />
          )}
          <Text
            style={styles.addressText}
            numberOfLines={1}
            ellipsizeMode="tail">
            {addressText}
          </Text>
          <TouchableOpacity
            activeOpacity={isSupportedAccount ? 0.7 : 1}
            disabled={!isSupportedAccount}
            onPress={handleJump}
            style={styles.actionButton}>
            <RcIconJumpCC
              width={14}
              height={14}
              color={colors2024['neutral-foot']}
            />
          </TouchableOpacity>
          <View pointerEvents={isSupportedAccount ? 'auto' : 'none'}>
            <CopyAddressIcon
              address={item.delegatedAddress}
              color={colors2024['neutral-foot']}
              style={styles.actionButton}
              icon={ctx => (
                <RcIconCopyRegularCC
                  color={ctx.iconColor}
                  width={14}
                  height={14}
                  style={ctx.iconStyle}
                />
              )}
            />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function EIP7702RevokeList() {
  const { styles } = useTheme2024({ getStyle });
  const { isLoading, data, refresh, isSupportedAccount } =
    useEIP7702Approvals();
  const {
    searchKw,
    safeSizeInfo: { safeSizes },
  } = useApprovalsPage();
  const supportedChains = EIP7702_REVOKE_SUPPORTED_CHAINS;
  const headerChainEnums = supportedChains.slice(0, 3);

  const keyExtractor = React.useCallback(
    (item: EIP7702Delegated, index: number) =>
      `${item.chain}-${item.delegatedAddress}-${index}`,
    [],
  );

  const renderItem = React.useCallback(
    ({ item }: { item: EIP7702Delegated }) => {
      return <EIP7702Row item={item} />;
    },
    [],
  );

  useFocusEffect(
    React.useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const ListEmptyComponent = React.useMemo(() => {
    if (isLoading) {
      return (
        <View style={!isSupportedAccount && styles.disabledContent}>
          <SkeletonListByAssets />
        </View>
      );
    }

    const emptyText = searchKw ? 'Not Matched' : 'No approvals';

    return (
      <View
        pointerEvents={isSupportedAccount ? 'auto' : 'none'}
        style={[
          styles.emptyHolderContainer,
          !isSupportedAccount && styles.disabledContent,
          {
            height: getScrollableSectionHeight({
              bottomAreaHeight: safeSizes.bottomAreaHeight,
            }),
          },
        ]}>
        <NotMatchedHolder text={emptyText} />
      </View>
    );
  }, [
    styles,
    safeSizes.bottomAreaHeight,
    isLoading,
    isSupportedAccount,
    searchKw,
  ]);

  const refreshing = React.useMemo(() => {
    if (data.length > 0) {
      return isLoading;
    }
    return false;
  }, [isLoading, data.length]);

  const supportedChainsSheetRef = React.useRef<BottomSheetModalMethods>(null);
  const openSupportedChains = React.useCallback(() => {
    supportedChainsSheetRef.current?.present();
  }, []);
  const closeSupportedChains = React.useCallback(() => {
    supportedChainsSheetRef.current?.dismiss();
  }, []);

  const ListHeaderComponent = React.useCallback(
    () => (
      <EIP7702Header
        chainEnums={headerChainEnums}
        isSupportedAccount={isSupportedAccount}
        onPressSupportedChains={openSupportedChains}
      />
    ),
    [headerChainEnums, isSupportedAccount, openSupportedChains],
  );
  const ItemSeparatorComponent = React.useCallback(
    () => <View style={styles.itemSeparator} />,
    [styles.itemSeparator],
  );
  return (
    <ApprovalsTabView
      style={styles.container}
      innerStyle={[styles.innerContainer]}>
      <Tabs.FlatList
        data={data}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={ListHeaderComponent}
        ItemSeparatorComponent={ItemSeparatorComponent}
        style={[
          styles.list,
          {
            paddingHorizontal: ApprovalsLayouts.innerContainerHorizontalOffset,
          },
        ]}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={ListEmptyComponent}
        refreshControl={
          <RefreshControl
            {...(isIOS && {
              progressViewOffset: -12,
            })}
            enabled={isSupportedAccount}
            refreshing={refreshing}
            onRefresh={() => {
              refresh();
            }}
          />
        }
      />
      <EIP7702SupportedChainsSheet
        ref={supportedChainsSheetRef}
        chains={supportedChains}
        onClose={closeSupportedChains}
      />
    </ApprovalsTabView>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => {
  return {
    emptyHolderContainer: {
      height: getScrollableSectionHeight(),
    },
    container: {
      flex: 1,
      flexDirection: 'column',
    },
    list: {},
    listContainer: {
      paddingTop: 0,
      paddingBottom: 0,
      ...(isIOS && { marginTop: -ApprovalsLayouts.tabbarHeight }),
    },
    itemSeparator: {
      height: 8,
    },
    innerContainer: {
      padding: 0,
      paddingBottom: 0,
    },
    headerContainer: {
      marginTop: 12,
      paddingHorizontal: 0,
      paddingBottom: 8,
      gap: 8,
    },
    warningContainer: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 6,
      backgroundColor: colors2024['orange-light-1'],
      gap: 4,
    },
    warningTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    warningTitleText: {
      fontSize: 14,
      lineHeight: 18,
      fontFamily: 'SF Pro Rounded',
      fontWeight: '700',
      color: colors2024['orange-default'],
      flexShrink: 1,
    },
    warningText: {
      fontSize: 14,
      lineHeight: 18,
      fontFamily: 'SF Pro Rounded',
      fontWeight: '400',
      color: colors2024['orange-default'],
    },
    disabledContent: {
      opacity: 0.5,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingLeft: 8,
      paddingRight: 0,
    },
    headerLabel: {
      fontSize: 14,
      lineHeight: 18,
      fontFamily: 'SF Pro Rounded',
      fontWeight: '400',
      color: colors2024['neutral-secondary'],
    },
    supportedChainsButton: {
      height: 32,
      paddingVertical: 6,
      paddingHorizontal: 6,
      borderRadius: 6,
      backgroundColor: colors2024['neutral-bg-1'],
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    supportedChainsMain: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    supportedChainsIcons: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    supportedChainIcon: {
      borderRadius: 6,
      backgroundColor: colors2024['neutral-bg-1'],
      borderWidth: 1.5,
      borderColor: colors2024['neutral-bg-1'],
    },
    supportedChainIconOverlap: {
      marginLeft: -2,
    },
    supportedChainsText: {
      fontSize: 14,
      lineHeight: 18,
      fontFamily: 'SF Pro Rounded',
      fontWeight: '500',
      color: colors2024['neutral-foot'],
    },
    supportedChainsArrow: {
      transform: [{ scaleY: -1 }],
    },
    card: {
      backgroundColor: colors2024['neutral-bg-1'],
      borderRadius: 16,
      paddingLeft: 12,
      paddingRight: 16,
      paddingVertical: 14,
      width: '100%',
    },
    cardSelected: {
      backgroundColor: colors2024['brand-light-1'],
    },
    cardRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      width: '100%',
    },
    checkbox: {
      marginLeft: 0,
    },
    addressRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flex: 1,
      minWidth: 0,
    },
    chainIcon: {
      borderRadius: 46,
      backgroundColor: colors2024['neutral-bg-1'],
    },
    chainIconFallback: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors2024['neutral-bg-2'],
    },
    addressText: {
      fontSize: 16,
      lineHeight: 20,
      fontFamily: 'SF Pro Rounded',
      fontWeight: '700',
      color: colors2024['neutral-title-1'],
      flexShrink: 1,
    },
    actionButton: {
      width: 14,
      height: 14,
      marginLeft: 2,
    },
  };
});
