/* eslint-disable react-native/no-inline-styles */
import { Text, View, TouchableOpacity } from 'react-native';
import { useCallback, useMemo, useRef } from 'react';
import { AddressEntry } from './RenderRow/AddressEntry';
import { Card } from '@/components2024/Card';
import { useTheme2024 } from '@/hooks/theme';
import RightArrowSVG from '@/assets2024/icons/common/right-cc.svg';
import { useTranslation } from 'react-i18next';
import { useAccountInfo } from './hooks';
import { createGetStyles2024 } from '@/utils/styles';
import { CurrentAddressProps } from '../AddressListScreenContainer';
import { StackActions, useNavigation } from '@react-navigation/native';
import { AppRootName, RootNames } from '@/constant/layout';
import WalletSVG from '@/assets2024/icons/common/wallet-cc.svg';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { useSetPasswordFirst } from '@/hooks/useLock';
import { getChangeData } from '@/hooks/useCurve';
import { useMultiCurve } from '@/hooks/useMultiCurve';
import useAccountsBalance from '@/hooks/useAccountsBalance';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { useBalanceUpdate } from './hooks/balance';
import { Tabs } from 'react-native-collapsible-tab-view';
import { RefreshControl } from 'react-native-gesture-handler';
import { WalletIcon } from '@/components2024/WalletIcon/WalletIcon';

const SPACING_HEIGHT = 8;
export const AddressList = () => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();
  const navigation = useNavigation<CurrentAddressProps['navigation']>();

  const modalRef =
    useRef<ReturnType<typeof createGlobalBottomSheetModal2024>>();
  const {
    top10Addresses,
    notMatterAccounts,
    list: _rawList,
    fetchAccounts,
  } = useAccountInfo();

  const { triggerUpdate, getTotalBalance, balanceAccounts } =
    useAccountsBalance({
      cacheTime: 10 * 60 * 1000,
      accountsNoUnique: true, // balanceAccounts has filter same address accounts
    });

  const top10Balance = useMemo(() => {
    return getTotalBalance(top10Addresses);
  }, [top10Addresses, getTotalBalance]);

  const { multiTimeStamp, refresh: refreshCurve } = useMultiCurve(
    top10Addresses,
    false,
    top10Balance.total,
    top10Balance.totalEvm,
  );

  useBalanceUpdate(triggerUpdate);

  const list = useMemo(() => {
    return _rawList.slice(0, 10).map(item => {
      const account = balanceAccounts.find(acc =>
        isSameAddress(acc.address, item.address),
      );
      return {
        ...item,
        balance: account?.balance || item.balance || 0,
      };
    });
  }, [balanceAccounts, _rawList]);

  const addressListData = useMemo(() => {
    return [
      ...list.map(item => {
        const hasChangeData = multiTimeStamp[
          item.address.toLocaleLowerCase()
        ]?.data?.some(i => i.usd_value !== 0);
        const chartData = getChangeData(
          multiTimeStamp[item.address.toLocaleLowerCase()]?.data || [],
          item.balance,
          new Date().getTime(),
        );
        return {
          ...item,
          balance:
            item.balance > 10
              ? Math.floor(item.balance)
              : Number(item.balance.toFixed(2)),
          changPercent: hasChangeData ? chartData?.changePercent : undefined,
          isLoss: hasChangeData ? chartData?.isLoss : undefined,
        };
      }),
    ];
  }, [list, multiTimeStamp]);

  const renderItem = useCallback(
    ({ item }) => {
      return (
        <View style={styles.itemGap}>
          <AddressEntry data={item} />
        </View>
      );
    },
    [styles.itemGap],
  );

  const { shouldRedirectToSetPasswordBefore2024 } = useSetPasswordFirst();

  const gotoAddAddress = useCallback(() => {
    const id = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.ADD_ADDRESS_SELECT_METHOD,
      onDone: () => {
        removeGlobalBottomSheetModal2024(id);
      },
      shouldRedirectToSetPasswordBefore2024,
      navigateTo: (screen: AppRootName, params?: object) => {
        navigation.dispatch(
          StackActions.push(RootNames.StackAddress, {
            screen,
            params,
          }),
        );
      },
    });
  }, [shouldRedirectToSetPasswordBefore2024, navigation]);

  const handleMoreWalletsPress = useCallback(() => {
    if (modalRef.current) {
      removeGlobalBottomSheetModal2024(modalRef.current);
    }
    modalRef.current = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.NOT_MATTER_ADDRESS_DIALOG,
      bottomSheetModalProps: {
        enablePanDownToClose: true,
        enableContentPanningGesture: true,
      },
      onDone: () => {
        removeGlobalBottomSheetModal2024(modalRef.current);
        modalRef.current = undefined;
      },
    });
  }, []);

  const notMatterAvatarList = useMemo(() => {
    return notMatterAccounts.slice(0, 3);
  }, [notMatterAccounts]);

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
        <Card style={styles.footerCard} onPress={gotoAddAddress}>
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
      gotoAddAddress,
      styles,
      t,
      handleMoreWalletsPress,
    ],
  );

  const onRefresh = useCallback(async () => {
    try {
      await Promise.all([
        triggerUpdate(true),
        refreshCurve(true),
        fetchAccounts(),
      ]);
    } catch (error) {
      console.error('Refresh failed:', error);
    }
  }, [fetchAccounts, refreshCurve, triggerUpdate]);

  return (
    <Tabs.FlatList
      data={addressListData}
      renderItem={renderItem}
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.list}
      ListFooterComponent={renderFooter}
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

const getStyles = createGetStyles2024(ctx => ({
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
