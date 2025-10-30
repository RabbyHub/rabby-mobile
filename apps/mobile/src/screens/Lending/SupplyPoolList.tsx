import React, { useCallback, useMemo } from 'react';
import { RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import { Tabs } from 'react-native-collapsible-tab-view';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { formatUsdValueKMB } from '../Home/utils/price';
import { formatPercent } from '../TokenDetail/util';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { useLendingData, useLendingSummary } from './hooks';
import TokenIcon from './components/TokenIcon';
import { CHAINS_ENUM } from '@debank/common';
import { PoolListLoading } from './components/Loading';
import { Skeleton } from '@rneui/themed';
import { useSceneAccountInfo } from '@/hooks/accountsSwitcher';
import WalletFillCC from '@/assets2024/icons/lending/wallet-fill-cc.svg';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import BigNumber from 'bignumber.js';
import { useTranslation } from 'react-i18next';

const FOOT_HEIGHT = 100;
const SupplyPoolList = () => {
  const { styles, colors2024, isLight } = useTheme2024({ getStyle: getStyles });
  const { displayPoolReserves, reserves, loading, iUserSummary } =
    useLendingSummary();
  const { t } = useTranslation();
  const { finalSceneCurrentAccount: currentAccount } = useSceneAccountInfo({
    forScene: 'MakeTransactionAbout',
  });
  const { fetchData } = useLendingData(currentAccount?.address);

  const sortReserves = useMemo(() => {
    return [...(displayPoolReserves || [])]
      .filter(item => {
        if (item.underlyingBalance && item.underlyingBalance !== '0') {
          return true;
        }
        if (
          BigNumber(item.reserve.totalLiquidity).gte(item.reserve.supplyCap)
        ) {
          return false;
        }
        const reserve = reserves?.reservesData?.find(x =>
          isSameAddress(x.underlyingAsset, item.reserve.underlyingAsset),
        );
        if (
          reserve?.usageAsCollateralEnabled === false ||
          reserve?.isActive === false ||
          reserve?.isFrozen ||
          reserve?.isPaused
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (
          Number(a.underlyingBalanceUSD) === 0 &&
          Number(b.underlyingBalanceUSD) === 0
        ) {
          if (
            Number(a.walletBalanceUSD) === 0 &&
            Number(b.walletBalanceUSD) === 0
          ) {
            return (
              Number(b.reserve.totalLiquidityUSD) -
              Number(a.reserve.totalLiquidityUSD)
            );
          }
          return Number(b.walletBalanceUSD) - Number(a.walletBalanceUSD);
        }
        return Number(b.underlyingBalanceUSD) - Number(a.underlyingBalanceUSD);
      });
  }, [displayPoolReserves, reserves?.reservesData]);

  const handlePressItem = item => {
    const modalId = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.SUPPLY_DETAIL,
      reserve: item,
      userSummary: iUserSummary,
      onClose: () => {
        removeGlobalBottomSheetModal2024(modalId);
      },
      bottomSheetModalProps: {
        enableContentPanningGesture: true,
        enablePanDownToClose: true,
        enableDismissOnClose: true,
        handleStyle: {
          backgroundColor: isLight
            ? colors2024['neutral-bg-0']
            : colors2024['neutral-bg-1'],
        },
      },
    });
  };

  const ListHeaderComponent = useCallback(() => {
    return loading ? (
      <Skeleton style={styles.loading} width={124} height={20} circle />
    ) : (
      <View style={styles.listHeader}>
        <Text style={styles.headerToken}>
          {t('page.Lending.list.headers.token')}
        </Text>
        <Text style={styles.headerApy}>
          {t('page.Lending.list.headers.apy')}
        </Text>
        <Text style={styles.headerMySupplies}>
          {t('page.Lending.list.headers.mySupplies')}
        </Text>
      </View>
    );
  }, [
    loading,
    styles.headerApy,
    styles.headerMySupplies,
    styles.headerToken,
    styles.listHeader,
    styles.loading,
    t,
  ]);
  return (
    <Tabs.FlatList
      data={loading ? [] : sortReserves}
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={false} onRefresh={() => fetchData(true)} />
      }
      keyExtractor={item => item.reserve.underlyingAsset}
      ListHeaderComponent={ListHeaderComponent}
      ListEmptyComponent={<PoolListLoading />}
      ListFooterComponent={<View style={{ height: FOOT_HEIGHT }} />}
      renderItem={({ item, index }) => {
        return (
          <TouchableOpacity
            style={styles.item}
            key={index}
            onPress={() => handlePressItem(item)}>
            <View style={styles.left}>
              <TokenIcon
                tokenSymbol={item.reserve.symbol}
                chainSize={0}
                chain={CHAINS_ENUM.ETH}
              />
              <View style={styles.symbolContainer}>
                <Text
                  style={styles.symbol}
                  numberOfLines={1}
                  ellipsizeMode="tail">
                  {item.reserve.symbol}
                </Text>
                <Text style={styles.tvl}>
                  {t('page.Lending.list.item.tvl')}:{' '}
                  {formatUsdValueKMB(
                    Number(item.reserve.totalLiquidityUSD || '0'),
                  )}
                </Text>
              </View>
            </View>
            <Text style={styles.apy}>
              {formatPercent(Number(item.reserve.supplyAPY || '0'))}
            </Text>
            <View style={styles.right}>
              <Text style={styles.yourSupplied}>
                {formatUsdValueKMB(Number(item.underlyingBalanceUSD || '0'))}
              </Text>
              <View style={styles.yourBalanceContainer}>
                <WalletFillCC
                  width={16}
                  height={16}
                  style={styles.walletIcon}
                  color={colors2024['secondary-foot']}
                />
                <Text style={styles.yourBalance}>
                  {formatUsdValueKMB(item.walletBalanceUSD || '0')}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        );
      }}
    />
  );
};

export default SupplyPoolList;

const getStyles = createGetStyles2024(({ colors2024, isLight }) => ({
  container: {
    position: 'relative',
    flex: 1,
    width: '100%',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 14,
    justifyContent: 'space-between',
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    borderRadius: 16,
    marginTop: 8,
  },
  ava: {
    width: 46,
    height: 46,
    borderRadius: 46,
    backgroundColor: colors2024['neutral-bg-2'],
  },
  left: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  apy: {
    flex: 0,
    width: 60,
    fontSize: 16,
    fontWeight: '700',
    color: colors2024['green-default'],
    fontFamily: 'SF Pro Rounded',
  },
  right: {
    flex: 0,
    marginLeft: 10,
    width: 80,
    gap: 2,
  },
  symbolContainer: {
    gap: 2,
  },
  symbol: {
    fontSize: 16,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    maxWidth: 80,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  tvl: {
    fontSize: 14,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
  },
  yourSupplied: {
    fontSize: 16,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    textAlign: 'right',
  },
  yourBalanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    justifyContent: 'flex-end',
  },
  walletIcon: {
    width: 16,
    height: 16,
    color: colors2024['neutral-secondary'],
    marginTop: -2,
  },
  yourBalance: {
    fontSize: 14,
    lineHeight: 16,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    textAlign: 'right',
  },
  listHeader: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 2,
  },
  loading: {
    width: 124,
    marginTop: 16,
    backgroundColor: colors2024['neutral-bg-5'],
    marginBottom: 2,
    marginLeft: 8,
  },
  headerToken: {
    fontSize: 14,
    color: colors2024['neutral-secondary'],
    flex: 1,
  },
  headerApy: {
    fontSize: 14,
    color: colors2024['neutral-secondary'],
    width: 60,
    flex: 0,
  },
  headerMySupplies: {
    fontSize: 14,
    color: colors2024['neutral-secondary'],
    flex: 0,
    marginLeft: 10,
    width: 80,
  },
}));
