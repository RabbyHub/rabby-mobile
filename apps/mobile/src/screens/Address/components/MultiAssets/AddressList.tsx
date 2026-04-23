/* eslint-disable react-native/no-inline-styles */
import { View, TouchableOpacity, Pressable } from 'react-native';
import React, { useCallback, useMemo, useState } from 'react';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import Animated from 'react-native-reanimated';

import { AddressEntry } from './RenderRow/AddressEntry';
import { Card } from '@/components2024/Card';
import { useTheme2024 } from '@/hooks/theme';
import RightArrowSVG from '@/assets2024/icons/common/right-cc.svg';
import { useTranslation } from 'react-i18next';
import { useAccountInfo } from './hooks';
import { createGetStyles2024 } from '@/utils/styles';
import WalletSVG from '@/assets2024/icons/common/wallet-cc.svg';
import { WalletIcon } from '@/components2024/WalletIcon/WalletIcon';
import { NotMatterAddressDialog } from '../../NotMatterAddressDialog';
import AutoLockView from '@/components/AutoLockView';
import { ManageSetting } from '../ManageSetting';
import RcIconSettingCC from '@/assets2024/icons/common/IconSetting.svg';
import { RootNames } from '@/constant/layout';
import { naviPush } from '@/utils/navigation';
import { balance24hStore } from '@/store/balance24h';
import { computeBalanceChange } from '@/core/apis/balance';
import addressBalanceStore from '@/store/balance';
import { Text } from '@/components/Typography';
import { updateRNRToastOnUI } from '@/components/RNRToast';
import {
  storeApiAccounts,
  useAccountRemovingVisualStageSV,
  useAccountRemovingToastBridge,
  useIsRemovingAccount,
  type KeyringAccountWithAlias,
} from '@/hooks/account';
import {
  useDeletingCollapseStyle,
  useDeletingOpacity,
} from '@/hooks/useDeletingOpacity';

const SPACING_HEIGHT = 8;
const ADDRESS_ROW_HEIGHT = 78;

const AddressListRow = ({
  item,
  isManageMode,
  onDone,
  showMarkIfNewlyAdded,
  colors2024,
  styles,
}: {
  item: KeyringAccountWithAlias & {
    changPercent?: string;
    isLoss?: boolean;
  };
  isManageMode?: boolean;
  onDone?: () => void;
  showMarkIfNewlyAdded: boolean;
  colors2024: ReturnType<typeof useTheme2024>['colors2024'];
  styles: ReturnType<typeof useTheme2024>['styles'];
}) => {
  const isRemoving = useIsRemovingAccount(item);
  const removingVisualStageSV = useAccountRemovingVisualStageSV(item);
  const removingToastBridge = useAccountRemovingToastBridge(item);
  const removingToastId = removingToastBridge?.toastId;
  const removingSuccessMessage = removingToastBridge?.successMessage;
  const handleRemovingVisualFinished = useCallback(() => {
    storeApiAccounts.markRemovingToastTransitioned(item);
    storeApiAccounts.finishRemovingAccountVisual(item).catch(error => {
      console.error('finish removing account visual failed', error);
    });
  }, [item]);
  const handleRemovingToastFinishedOnUI = useCallback(() => {
    'worklet';

    if (!removingToastId || !removingSuccessMessage) {
      return;
    }

    updateRNRToastOnUI(removingToastId, {
      duration: 2000,
      kind: 'success',
      message: removingSuccessMessage,
      position: 'top',
    });
  }, [removingSuccessMessage, removingToastId]);
  const deletingOpacityStyle = useDeletingOpacity(removingVisualStageSV);
  const collapseStyle = useDeletingCollapseStyle({
    stage: removingVisualStageSV,
    expandedHeight: ADDRESS_ROW_HEIGHT,
    expandedMarginTop: SPACING_HEIGHT,
    onFinish: handleRemovingVisualFinished,
    onFinishUI:
      removingToastId && removingSuccessMessage
        ? handleRemovingToastFinishedOnUI
        : undefined,
  });

  if (isManageMode) {
    const gotoAddressDetail = () => {
      onDone?.();
      naviPush(RootNames.StackAddress, {
        screen: RootNames.AddressDetail,
        params: {
          address: item.address,
          type: item.type,
          brandName: item.brandName,
        },
      });
    };

    return (
      <Animated.View
        pointerEvents={isRemoving ? 'none' : 'auto'}
        style={[collapseStyle, styles.manageModeItem]}>
        <Animated.View style={deletingOpacityStyle}>
          <Pressable
            disabled={isRemoving}
            onPress={gotoAddressDetail}
            style={styles.manageBtn}>
            <RcIconSettingCC
              width={20}
              height={20}
              color={colors2024['neutral-secondary']}
            />
          </Pressable>
          <View style={{ width: '100%' }}>
            <AddressEntry
              showMarkIfNewlyAdded={showMarkIfNewlyAdded}
              data={item}
              onSelect={onDone}
            />
          </View>
        </Animated.View>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      pointerEvents={isRemoving ? 'none' : 'auto'}
      style={collapseStyle}>
      <Animated.View style={deletingOpacityStyle}>
        <AddressEntry
          showMarkIfNewlyAdded={showMarkIfNewlyAdded}
          data={item}
          onSelect={onDone}
        />
      </Animated.View>
    </Animated.View>
  );
};

interface AddressListProps {
  showMarkIfNewlyAdded?: boolean;
  onAddAddressPress?: () => void;
  onDone?: () => void;
  onMoreAddressListPress?: () => void;
  isManageMode?: boolean;
}
const AddressList = ({
  showMarkIfNewlyAdded = true,
  onAddAddressPress,
  onDone,
  onMoreAddressListPress,
  isManageMode,
}: AddressListProps) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();

  const { myTop10Accounts, myTop10Records, notMatteredAccounts } =
    useAccountInfo({
      includeRemoving: true,
      includeFinishingVisual: true,
    });
  const top10Addresses = useMemo(() => {
    return myTop10Accounts.map(item => item.address.toLowerCase());
  }, [myTop10Accounts]);
  const balanceSnapshots =
    addressBalanceStore.useAddressesSnapshot(top10Addresses);
  const balance24hSnapshots =
    balance24hStore.useAddresses24hBalanceSnapshots(top10Addresses);

  const addressListData = useMemo(() => {
    const balanceMap = balanceSnapshots.reduce(
      (acc, snapshot) => {
        if (snapshot.value) {
          acc[snapshot.address] = snapshot.value;
        }

        return acc;
      },
      {} as Record<
        string,
        {
          totalBalance: number;
          evmBalance: number;
        }
      >,
    );
    const multi24hBalance = balance24hSnapshots.reduce(
      (acc, snapshot) => {
        if (snapshot.value) {
          acc[snapshot.address] = snapshot.value;
        }

        return acc;
      },
      {} as Record<
        string,
        {
          total_usd_value?: number;
        }
      >,
    );

    return myTop10Accounts
      .map((item, index) => {
        const account = balanceMap[item.address.toLowerCase()];
        const balance = account?.totalBalance;
        const evmBalance = account?.evmBalance;
        const canShowChange =
          typeof evmBalance === 'number' &&
          !!multi24hBalance[item.address.toLowerCase()];

        const changeData = multi24hBalance[item.address.toLowerCase()];
        const startValue = changeData?.total_usd_value || 0;
        const balanceChange = canShowChange
          ? computeBalanceChange(evmBalance, startValue)
          : null;
        return {
          ...item,
          balance,
          evmBalance,
          sortIndex: index,
          changPercent: balanceChange?.changePercent,
          isLoss:
            typeof balanceChange?.assetsChange === 'number'
              ? balanceChange.assetsChange < 0
              : undefined,
        };
      })
      .sort((a, b) => {
        const aHasBalance = typeof a.balance === 'number';
        const bHasBalance = typeof b.balance === 'number';

        if (aHasBalance && bHasBalance && a.balance !== b.balance) {
          return b.balance - a.balance;
        }

        if (aHasBalance !== bHasBalance) {
          return aHasBalance ? -1 : 1;
        }

        return a.sortIndex - b.sortIndex;
      });
  }, [balance24hSnapshots, balanceSnapshots, myTop10Accounts]);

  const renderItem = useCallback(
    ({ item }) => {
      return (
        <AddressListRow
          item={item}
          isManageMode={isManageMode}
          onDone={onDone}
          showMarkIfNewlyAdded={showMarkIfNewlyAdded}
          colors2024={colors2024}
          styles={styles}
        />
      );
    },
    [isManageMode, styles, onDone, colors2024, showMarkIfNewlyAdded],
  );

  const handleMoreWalletsPress = useCallback(() => {
    onMoreAddressListPress?.();
  }, [onMoreAddressListPress]);

  const notMatterAvatarList = useMemo(() => {
    return notMatteredAccounts
      .filter(x => !myTop10Records.has(x.address.toLowerCase()))
      .slice(0, 3);
  }, [notMatteredAccounts, myTop10Records]);

  const renderFooter = useCallback(
    () => (
      <View>
        {notMatteredAccounts.length > 0 && (
          <View style={styles.moreWalletsContainer}>
            <View style={styles.moreWalletsHintContainer}>
              <View style={styles.horizontalLine} />
              <Text style={styles.moreWalletsHint}>
                {t(
                  'page.addressDetail.addressListScreen.notIncludedInTotalBalance',
                )}
              </Text>
              <View style={styles.horizontalLine} />
            </View>
            <TouchableOpacity
              style={styles.moreWalletsButton}
              onPress={handleMoreWalletsPress}>
              <View style={styles.moreWalletsButtonContent}>
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
                <RightArrowSVG
                  width={12}
                  height={12}
                  color={colors2024['neutral-secondary']}
                  style={styles.arrowIcon}
                />
              </View>
            </TouchableOpacity>
          </View>
        )}
        <Card style={styles.footerCard} onPress={onAddAddressPress}>
          <View style={styles.footerMain}>
            <WalletSVG
              width={20}
              height={20}
              color={colors2024['neutral-secondary']}
            />
            <Text style={styles.footerCardText}>
              {t('page.addressDetail.addressListScreen.addAddress')}
            </Text>
          </View>
        </Card>
        <View style={styles.footerGap} />
      </View>
    ),
    [
      notMatteredAccounts,
      notMatterAvatarList,
      colors2024,
      onAddAddressPress,
      styles,
      t,
      handleMoreWalletsPress,
    ],
  );

  // return null;
  return (
    <BottomSheetFlatList
      keyExtractor={item => `${item.address}-${item.brandName}`}
      data={addressListData}
      renderItem={renderItem}
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.list}
      ListFooterComponent={isManageMode ? null : renderFooter}
      style={styles.listContainer}
      ListHeaderComponent={<View style={{ height: SPACING_HEIGHT }} />}
    />
  );
};

export const AddressListModal = ({
  onAddAddressPress,
  onDone,
}: AddressListProps) => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();
  const [moreAddressList, setMoreAddressList] = useState(false);
  const [isManageMode, setIsManageMode] = useState(false);

  const switchManageMode = () => {
    setIsManageMode(e => !e);
  };

  if (moreAddressList) {
    return (
      <NotMatterAddressDialog
        onDone={onDone}
        onBack={() => setMoreAddressList(false)}
      />
    );
  }
  return (
    <AutoLockView as="View" style={styles.container}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'flex-end',
          paddingRight: 20,
        }}>
        <ManageSetting
          isManageMode={isManageMode}
          switchManageMode={switchManageMode}
        />
      </View>
      <Text style={styles.title}>{t('component.multiAddressModal.title')}</Text>

      <AddressList
        onAddAddressPress={onAddAddressPress}
        onDone={onDone}
        onMoreAddressListPress={() => setMoreAddressList(true)}
        isManageMode={isManageMode}
      />
    </AutoLockView>
  );
};

const getStyles = createGetStyles2024(ctx => ({
  container: {
    flex: 1,
    backgroundColor: ctx.isLight
      ? ctx.colors2024['neutral-bg-0']
      : ctx.colors2024['neutral-bg-1'],
  },
  done: {
    color: ctx.colors2024['neutral-secondary'],
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 24,
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
    color: ctx.colors2024['neutral-title-1'],
  },
  footerGap: {
    height: 70,
  },
  footerCard: {
    backgroundColor: ctx.colors2024['neutral-bg-2'],
    marginTop: 24,
    marginBottom: 22,
    padding: 16,
    borderRadius: 20,
  },
  footerMain: {
    height: 46,
    justifyContent: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  footerCardText: {
    color: ctx.colors2024['neutral-secondary'],
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
    fontFamily: 'SF Pro Rounded',
  },
  itemGap: {
    marginTop: SPACING_HEIGHT,
  },
  manageModeItem: {
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: -16,
  },
  manageBtn: {
    width: 64,
    height: 64,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    flex: 1,
    marginTop: 8,
  },
  list: {
    backgroundColor: ctx.isLight
      ? ctx.colors2024['neutral-bg-0']
      : ctx.colors2024['neutral-bg-1'],
    paddingHorizontal: 16,
  },
  bgContainer: {
    backgroundColor: ctx.isLight
      ? ctx.colors2024['neutral-bg-0']
      : ctx.colors2024['neutral-bg-1'],
    paddingHorizontal: 16,
  },
  moreWalletsContainer: {
    marginTop: 24,
    // paddingHorizontal: 16,
    gap: 24,
    // paddingVertical: 10,
  },
  moreWalletsHint: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
    fontFamily: 'SF Pro Rounded',
    color: ctx.colors2024['neutral-info'],
    // textAlign: 'center',
  },
  moreWalletsButton: {
    // paddingVertical: 8,
  },
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
  arrowIcon: {
    transform: [{ rotate: '0deg' }],
  },
  moreWalletsHintContainer: {
    // marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  moreWalletsButtonIcon: {
    position: 'relative',
    // alignItems: 'flex-end',
    width: 62, // 22 + 10 + 10 + 20 (icon width + 2 overlaps + extra space)
    height: 22,
    marginRight: 4,
  },
  stackedIcon: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: ctx.colors2024['neutral-bg-1'],
    borderRadius: 10,
  },
  moreWalletsButtonIconImage: {
    width: 24,
    height: 24,
    borderRadius: 8,
  },
  horizontalLine: {
    // width: 100,
    flex: 1,
    height: 1,
    backgroundColor: ctx.colors2024['neutral-line'],
  },
}));
