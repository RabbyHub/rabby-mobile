/* eslint-disable react-native/no-inline-styles */
import { Text, View, TouchableOpacity, Pressable } from 'react-native';
import React, { useCallback, useMemo, useState } from 'react';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';

import { AddressEntry } from './RenderRow/AddressEntry';
import { Card } from '@/components2024/Card';
import { useTheme2024 } from '@/hooks/theme';
import RightArrowSVG from '@/assets2024/icons/common/right-cc.svg';
import { useTranslation } from 'react-i18next';
import { useAccountInfo } from './hooks';
import { createGetStyles2024 } from '@/utils/styles';
import WalletSVG from '@/assets2024/icons/common/wallet-cc.svg';
import useAccountsBalance from '@/hooks/useAccountsBalance';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { useBalanceUpdate } from './hooks/balance';
import { RefreshControl } from 'react-native-gesture-handler';
import { WalletIcon } from '@/components2024/WalletIcon/WalletIcon';
import { useMulti24hBalance, getChangeData } from '@/hooks/use24hBalance';
import { NotMatterAddressDialog } from '../../NotMatterAddressDialog';
import AutoLockView from '@/components/AutoLockView';
import { ManageSetting } from '../ManageSetting';
import RcIconSettingCC from '@/assets2024/icons/common/IconSetting.svg';
import { useAddressDetailModal } from '../../useAddressDetailModal';
import { toast } from '@/components2024/Toast';
import { RootNames } from '@/constant/layout';
import { navigateDeprecated, naviPush } from '@/utils/navigation';

const SPACING_HEIGHT = 8;
interface AddressListProps {
  onAddAddressPress?: () => void;
  onDone?: () => void;
  onMoreAddressListPress?: () => void;
  isManageMode?: boolean;
}
export const AddressList = ({
  onAddAddressPress,
  onDone,
  onMoreAddressListPress,
  isManageMode,
}: AddressListProps) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();

  const {
    top10Accounts,
    top10Addresses,
    top10Records,
    notMatterAccounts,
    fetchAccounts,
  } = useAccountInfo();

  const { triggerUpdate, balanceAccounts, getTotalBalance } =
    useAccountsBalance();

  const top10Balance = useMemo(() => {
    return getTotalBalance(top10Addresses);
  }, [top10Addresses, getTotalBalance]);

  const { multi24hBalance, refresh: refresh24hBalance } = useMulti24hBalance(
    top10Addresses,
    {
      disableAutoFetch: true,
      totalBalance: top10Balance.total,
      totalEvmBalance: top10Balance.totalEvm,
    },
  );

  useBalanceUpdate(triggerUpdate);

  const list = useMemo(() => {
    return top10Accounts.map(item => {
      const account = balanceAccounts.find(acc =>
        isSameAddress(acc.address, item.address),
      );
      return {
        ...item,
        balance: account?.balance || item.balance || 0,
        evmBalance: account?.evmBalance || item.evmBalance || 0,
      };
    });
  }, [balanceAccounts, top10Accounts]);

  const addressListData = useMemo(() => {
    return [
      ...list.map(item => {
        const changeData = multi24hBalance[item.address.toLowerCase()]?.data;
        const chartData = getChangeData(
          changeData,
          item.evmBalance,
          new Date().getTime(),
        );
        return {
          ...item,
          balance: item.balance,
          changPercent: changeData ? chartData?.changePercent : undefined,
          isLoss: changeData ? chartData?.isLoss : undefined,
        };
      }),
    ];
  }, [list, multi24hBalance]);

  const renderItem = useCallback(
    ({ item }) => {
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
          <View style={[styles.itemGap, styles.manageModeItem]}>
            <Pressable onPress={gotoAddressDetail} style={styles.manageBtn}>
              <RcIconSettingCC
                width={20}
                height={20}
                color={colors2024['neutral-secondary']}
              />
            </Pressable>
            <View style={{ width: '100%' }}>
              <AddressEntry data={item} onSelect={onDone} />
            </View>
          </View>
        );
      }
      return (
        <View style={styles.itemGap}>
          <AddressEntry data={item} onSelect={onDone} />
        </View>
      );
    },
    [
      isManageMode,
      styles.itemGap,
      styles.manageModeItem,
      styles.manageBtn,
      onDone,
      colors2024,
    ],
  );

  const handleMoreWalletsPress = useCallback(() => {
    onMoreAddressListPress?.();
  }, [onMoreAddressListPress]);

  const notMatterAvatarList = useMemo(() => {
    return notMatterAccounts
      .filter(x => !top10Records.has(x.address.toLowerCase()))
      .slice(0, 3);
  }, [notMatterAccounts, top10Records]);

  const renderFooter = useCallback(
    () => (
      <View>
        {notMatterAccounts.length > 0 && (
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
      notMatterAccounts,
      notMatterAvatarList,
      colors2024,
      onAddAddressPress,
      styles,
      t,
      handleMoreWalletsPress,
    ],
  );

  const onRefresh = useCallback(async () => {
    try {
      await Promise.all([
        triggerUpdate(true),
        refresh24hBalance(true),
        fetchAccounts(),
      ]);
    } catch (error) {
      console.error('Refresh failed:', error);
    }
  }, [fetchAccounts, refresh24hBalance, triggerUpdate]);

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
      refreshControl={
        <RefreshControl
          style={styles.bgContainer}
          onRefresh={onRefresh}
          refreshing={false}
        />
      }
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
