import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { formatUsdValueKMB } from '@/screens/Home/utils/price';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import {
  useLendingData,
  useLendingSummary,
  useSelectedMarket,
} from '../../hooks';
import TokenIcon from '../TokenIcon';
import { PoolListLoading } from '../Loading';
import { Skeleton } from '@rneui/themed';
import WalletFillCC from '@/assets2024/icons/lending/wallet-fill-cc.svg';
import IconSwitchCC from '@/assets2024/icons/lending/switch-cc.svg';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { useTranslation } from 'react-i18next';
import { formatApy, formatListNetWorth } from '../../utils/format';
import { CHAINS_ENUM } from '@debank/common';
import RcIconWarningCircleCC from '@/assets2024/icons/common/warning-circle-cc.svg';
import { DisplayPoolReserveInfo } from '../../type';
import { displayGhoForMintableMarket } from '../../utils/supply';
import { API_ETH_MOCK_ADDRESS } from '../../utils/constant';
import wrapperToken from '../../config/wrapperToken';
import { NextSearchBar } from '@/components2024/SearchBar';

const FOOT_HEIGHT = 36;

const LendingSupplyList: React.FC = () => {
  const { styles, colors2024, isLight } = useTheme2024({ getStyle });
  const { displayPoolReserves, reserves, loading, iUserSummary } =
    useLendingSummary();
  const { t } = useTranslation();
  const { fetchData } = useLendingData();
  const [toggleBalanceOrTVl, setToggleBalanceOrTVl] = useState(true);
  const [search, setSearch] = useState('');
  const { chainEnum, marketKey } = useSelectedMarket();

  const sortReserves = useMemo(() => {
    return displayPoolReserves
      ?.filter(item => {
        if (item.underlyingBalance && item.underlyingBalance !== '0') {
          return true;
        }
        const realUnderlyingAsset =
          isSameAddress(item.underlyingAsset, API_ETH_MOCK_ADDRESS) && chainEnum
            ? wrapperToken?.[chainEnum]?.address
            : item.reserve.underlyingAsset;
        const reserve = reserves?.reservesData?.find(x =>
          isSameAddress(x.underlyingAsset, realUnderlyingAsset),
        );
        if (!reserve) {
          return false;
        }
        return (
          !(reserve?.isFrozen || reserve.isPaused) &&
          !displayGhoForMintableMarket({
            symbol: reserve.symbol,
            currentMarket: marketKey,
          })
        );
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
  }, [chainEnum, displayPoolReserves, marketKey, reserves?.reservesData]);

  const filteredReserves = useMemo(() => {
    const list = sortReserves || [];
    const keyword = search.trim().toLowerCase();
    if (!keyword) {
      return list;
    }
    return list.filter(item =>
      item.reserve.symbol.toLowerCase().includes(keyword),
    );
  }, [search, sortReserves]);

  const isInIsolationMode = useMemo(() => {
    return iUserSummary?.isInIsolationMode;
  }, [iUserSummary?.isInIsolationMode]);

  const isolatedCard = useMemo(() => {
    if (loading || !isInIsolationMode) {
      return null;
    }
    return (
      <View style={styles.availableCard}>
        <View style={styles.availableCardHeader}>
          <RcIconWarningCircleCC
            width={14}
            height={14}
            color={colors2024['orange-default']}
          />

          <Text style={styles.availableCardTitle}>
            {t('page.Lending.modalDesc.isolatedSupplyDesc')}
          </Text>
        </View>
      </View>
    );
  }, [
    colors2024,
    isInIsolationMode,
    loading,
    styles.availableCard,
    styles.availableCardHeader,
    styles.availableCardTitle,
    t,
  ]);

  const handlePressItem = useCallback(
    (item: DisplayPoolReserveInfo) => {
      const modalId = createGlobalBottomSheetModal2024({
        name: MODAL_NAMES.SUPPLY_DETAIL,
        underlyingAsset: item.underlyingAsset,
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
    },
    [colors2024, isLight],
  );

  const ListHeaderComponent = useCallback(() => {
    return loading ? (
      <Skeleton style={styles.loading} width={124} height={20} circle />
    ) : (
      <>
        {isolatedCard}
        <View style={styles.listHeader}>
          <Pressable
            style={styles.headerTokenContainer}
            hitSlop={20}
            onPress={() => setToggleBalanceOrTVl(pre => !pre)}>
            <Text style={styles.headerToken}>
              {toggleBalanceOrTVl
                ? t('page.Lending.list.headers.token_balance')
                : t('page.Lending.list.headers.token_tvl')}
            </Text>
            <IconSwitchCC
              width={14}
              height={14}
              color={colors2024['neutral-secondary']}
            />
          </Pressable>
          <Text style={styles.headerApy}>{t('page.Lending.apy')}</Text>
          <Text style={styles.headerMySupplies}>
            {t('page.Lending.list.headers.mySupplies')}
          </Text>
        </View>
      </>
    );
  }, [
    colors2024,
    isolatedCard,
    loading,
    styles.headerApy,
    styles.headerMySupplies,
    styles.headerToken,
    styles.headerTokenContainer,
    styles.listHeader,
    styles.loading,
    t,
    toggleBalanceOrTVl,
  ]);

  const keyExtractor = useCallback((item: DisplayPoolReserveInfo) => {
    return `${item.reserve.underlyingAsset}-${item.reserve.symbol}`;
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: DisplayPoolReserveInfo }) => {
      const isZeroSupplied = item.underlyingBalance === '0';
      return (
        <TouchableOpacity
          style={styles.item}
          onPress={() => handlePressItem(item)}>
          <View style={styles.left}>
            <TokenIcon
              tokenSymbol={item.reserve.symbol}
              chainSize={0}
              chain={chainEnum || CHAINS_ENUM.ETH}
            />
            <View style={styles.symbolContainer}>
              <Text
                style={styles.symbol}
                numberOfLines={1}
                ellipsizeMode="tail">
                {item.reserve.symbol}
              </Text>
              {toggleBalanceOrTVl ? (
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
              ) : (
                <Text style={styles.tvl}>
                  {t('page.Lending.list.item.tvl')}:{' '}
                  {formatUsdValueKMB(
                    Number(item.reserve.totalLiquidityUSD || '0'),
                  )}
                </Text>
              )}
            </View>
          </View>
          <Text style={styles.apy}>
            {formatApy(Number(item.reserve.supplyAPY || '0'))}
          </Text>
          <View style={styles.right}>
            {isZeroSupplied ? (
              <Text style={[styles.yourSupplied, styles.zeroSupplied]}>$0</Text>
            ) : (
              <Text style={styles.yourSupplied}>
                {formatListNetWorth(Number(item.underlyingBalanceUSD || '0'))}
              </Text>
            )}
          </View>
        </TouchableOpacity>
      );
    },
    [chainEnum, colors2024, handlePressItem, styles, t, toggleBalanceOrTVl],
  );

  const renderFooterComponent = useCallback(() => {
    return <View style={{ height: FOOT_HEIGHT }} />;
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.titleContainer}>
        <Text style={styles.titleText}>
          {t('page.Lending.supplyDetail.actions')}
        </Text>
        <NextSearchBar
          style={styles.searchBar}
          value={search}
          onChangeText={setSearch}
          placeholder={t('component.TokenSelector.searchPlaceHolder2')}
          returnKeyType="search"
        />
      </View>
      <FlatList
        data={loading ? [] : filteredReserves}
        style={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => fetchData(true)}
          />
        }
        keyExtractor={keyExtractor}
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={loading ? <PoolListLoading /> : null}
        ListFooterComponent={renderFooterComponent}
        renderItem={renderItem}
      />
    </View>
  );
};

export default LendingSupplyList;

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    width: '100%',
  },
  titleContainer: {
    paddingTop: 12,
    paddingBottom: 12,
  },
  titleText: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '900',
    textAlign: 'center',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    marginBottom: 12,
  },
  searchBar: {
    //flex: 1,
  },
  list: {
    flex: 1,
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
    lineHeight: 20,
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
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    maxWidth: 80,
    overflow: 'hidden',
  },
  tvl: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
  },
  yourSupplied: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    textAlign: 'right',
  },
  zeroSupplied: {
    color: colors2024['neutral-info'],
  },
  yourBalanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  walletIcon: {
    width: 16,
    height: 16,
    color: colors2024['neutral-secondary'],
    marginTop: -2,
  },
  yourBalance: {
    fontSize: 14,
    lineHeight: 18,
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
    lineHeight: 18,
    color: colors2024['neutral-secondary'],
  },
  headerTokenContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 4,
  },
  headerApy: {
    fontSize: 14,
    lineHeight: 18,
    color: colors2024['neutral-secondary'],
    width: 60,
    flex: 0,
  },
  headerMySupplies: {
    fontSize: 14,
    lineHeight: 18,
    color: colors2024['neutral-secondary'],
    flex: 0,
    marginLeft: 10,
    width: 80,
  },
  //headerContainer: {
  //  backgroundColor: isLight
  //    ? colors2024['neutral-bg-0']
  //    : colors2024['neutral-bg-1'],
  //},
  availableCard: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors2024['orange-light-1'],
    borderRadius: 6,
    marginTop: 8,
    gap: 2,
  },
  availableCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  availableCardTitle: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '400',
    color: colors2024['orange-default'],
    fontFamily: 'SF Pro Rounded',
  },
}));
