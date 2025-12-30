import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024, makeTriangleStyle } from '@/utils/styles';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import {
  GlobalModalViewProps,
  MODAL_NAMES,
} from '@/components2024/GlobalBottomSheetModal/types';
import {
  useFetchLendingData,
  useLendingIsLoading,
  useLendingRemoteData,
  useLendingSummary,
  useSelectedMarket,
} from '../../hooks';
import TokenIcon from '../TokenIcon';
import { PoolListLoading } from '../Loading';
import { Skeleton } from '@rneui/themed';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { useTranslation } from 'react-i18next';
import { formatApy } from '../../utils/format';
import { CHAINS_ENUM } from '@debank/common';
import RcIconWarningCircleCC from '@/assets2024/icons/common/warning-circle-cc.svg';
import { DisplayPoolReserveInfo } from '../../type';
import { displayGhoForMintableMarket } from '../../utils/supply';
import { API_ETH_MOCK_ADDRESS } from '../../utils/constant';
import wrapperToken from '../../config/wrapperToken';
import { NextSearchBar } from '@/components2024/SearchBar';
import { formatUsdValueKMB } from '@/screens/TokenDetail/util';
import { isUnFoldToken } from '../../config/unfold';
import { TokenRowSectionHeader } from '@/screens/Home/components/AssetRenderItems';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';

const FOOT_HEIGHT = 86;

type SupplyListItem =
  | { type: 'reserve'; data: DisplayPoolReserveInfo }
  | { type: 'toggle_fold' };

const LendingSupplyList: React.FC<
  GlobalModalViewProps<MODAL_NAMES.LENDING_SUPPLY_LIST>
> = ({}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });

  const { reserves } = useLendingRemoteData();
  const { loading } = useLendingIsLoading();
  const { displayPoolReserves, iUserSummary, getTargetReserve } =
    useLendingSummary();
  const { t } = useTranslation();
  const { fetchData } = useFetchLendingData();
  const [search, setSearch] = useState('');
  const [isInputActive, setIsInputActive] = useState(false);

  const [foldHideList, setFoldHideList] = useState(true);
  const { chainEnum, marketKey } = useSelectedMarket();
  const inputRef = useRef<TextInput | null>(null);

  const inputNotActiveAndNoQuery = useMemo(() => {
    return !(search || isInputActive);
  }, [search, isInputActive]);

  const handleInputFocus = () => {
    setIsInputActive(true);
  };

  const handleInputBlur = () => {
    setIsInputActive(false);
  };

  const sortReserves = useMemo(() => {
    return displayPoolReserves
      ?.filter(item => {
        if (item.underlyingBalance && item.underlyingBalance !== '0') {
          return true;
        }
        //if (
        //  // 达到供应上限
        //  BigNumber(item.reserve?.totalLiquidity || '0').gte(
        //    item.reserve?.supplyCap || '0',
        //  )
        //) {
        //  return false;
        //}
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
        return (
          Number(b.reserve.totalLiquidityUSD) -
          Number(a.reserve.totalLiquidityUSD)
        );
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

  const unFoldList = useMemo(() => {
    return filteredReserves.filter(item =>
      isUnFoldToken(marketKey, item.reserve.symbol),
    );
  }, [filteredReserves, marketKey]);

  const foldList = useMemo(() => {
    return filteredReserves.filter(
      item => !isUnFoldToken(marketKey, item.reserve.symbol),
    );
  }, [filteredReserves, marketKey]);

  const isInIsolationMode = useMemo(() => {
    return iUserSummary?.isInIsolationMode;
  }, [iUserSummary?.isInIsolationMode]);

  const dataList = useMemo<SupplyListItem[]>(() => {
    if (loading) {
      return [];
    }
    const list: SupplyListItem[] = [];
    unFoldList.forEach(item => {
      list.push({
        type: 'reserve',
        data: item,
      });
    });
    if (foldList.length) {
      list.push({ type: 'toggle_fold' });
      if (!foldHideList) {
        foldList.forEach(item => {
          list.push({
            type: 'reserve',
            data: item,
          });
        });
      }
    }
    return list;
  }, [foldHideList, foldList, loading, unFoldList]);

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
      const reserve = getTargetReserve(item.reserve.underlyingAsset);
      const userSummary = iUserSummary;
      if (!reserve || !userSummary) return;
      const modalId = createGlobalBottomSheetModal2024({
        name: MODAL_NAMES.SUPPLY_ACTION_DETAIL,
        reserve,
        userSummary,
        onClose: () => {
          removeGlobalBottomSheetModal2024(modalId);
        },
        bottomSheetModalProps: {
          enableContentPanningGesture: true,
          enablePanDownToClose: true,
          enableDismissOnClose: true,
          handleStyle: {
            backgroundColor: colors2024['neutral-bg-1'],
          },
        },
      });
    },
    [colors2024, getTargetReserve, iUserSummary],
  );

  const ListHeaderComponent = useCallback(() => {
    return loading ? (
      <Skeleton style={styles.loading} width={124} height={20} circle />
    ) : (
      <>
        {isolatedCard}
        <View style={styles.listHeader}>
          <View style={styles.headerTokenContainer}>
            <Text style={styles.headerToken}>
              {t('page.Lending.list.headers.token')}
            </Text>
          </View>
          <Text style={styles.headerTvl}>{t('page.Lending.tvl')}</Text>
          <Text style={styles.headerApy}>{t('page.Lending.apy')}</Text>
        </View>
      </>
    );
  }, [
    isolatedCard,
    loading,
    styles.headerApy,
    styles.headerToken,
    styles.headerTokenContainer,
    styles.headerTvl,
    styles.listHeader,
    styles.loading,
    t,
  ]);

  const keyExtractor = useCallback((item: SupplyListItem) => {
    if (item.type === 'toggle_fold') {
      return 'toggle-fold';
    }
    return `${item.data.reserve.underlyingAsset}-${item.data.reserve.symbol}`;
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: SupplyListItem }) => {
      if (item.type === 'toggle_fold') {
        return (
          <TokenRowSectionHeader
            str={null}
            fold={foldHideList}
            style={styles.sectionHeader}
            buttonStyle={styles.buttonHeader}
            onPressFold={() => {
              setFoldHideList(pre => !pre);
            }}
          />
        );
      }

      const data = item.data;
      const isWrapperToken = chainEnum
        ? isSameAddress(
            wrapperToken[chainEnum]?.address,
            data.reserve.underlyingAsset,
          )
        : false;
      return (
        <TouchableOpacity
          style={[styles.item, isWrapperToken && styles.wrapperToken]}
          onPress={() => handlePressItem(data)}>
          {isWrapperToken && !search && (
            <View style={styles.wrapperTokenArrow} />
          )}
          <View style={styles.left}>
            <TokenIcon
              tokenSymbol={data.reserve.symbol}
              chainSize={0}
              chain={chainEnum || CHAINS_ENUM.ETH}
            />
            <View style={styles.symbolContainer}>
              <Text
                style={styles.symbol}
                numberOfLines={1}
                ellipsizeMode="tail">
                {data.reserve.symbol}
              </Text>
              {!!isWrapperToken && chainEnum && (
                <Text style={styles.wrapperTokenText}>
                  {t('page.Lending.list.item.wrapperToken', {
                    name: wrapperToken[chainEnum]?.origin?.symbol,
                  })}
                </Text>
              )}
            </View>
          </View>
          <Text style={styles.tvl}>
            {formatUsdValueKMB(Number(data.reserve.totalLiquidityUSD || '0'))}
          </Text>
          <View style={styles.right}>
            <Text style={styles.apy}>
              {formatApy(Number(data.reserve.supplyAPY || '0'))}
            </Text>
          </View>
        </TouchableOpacity>
      );
    },
    [chainEnum, foldHideList, handlePressItem, search, styles, t],
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
          inputContainerStyle={{
            justifyContent: inputNotActiveAndNoQuery ? 'center' : 'flex-start',
          }}
          inputStyle={{
            flex: inputNotActiveAndNoQuery ? 0 : 1,
          }}
          placeholder={t('component.TokenSelector.searchPlaceHolder2')}
          returnKeyType="search"
          placeholderTextColor={colors2024['neutral-secondary']}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          onCancel={() => {
            setSearch('');
            setTimeout(() => {
              inputRef.current?.blur();
            }, 50);
          }}
          ref={inputRef}
        />
        {/* for mask touch event in input to emit focus event */}
        {inputNotActiveAndNoQuery && (
          <TouchableOpacity
            style={[styles.absoluteContainer]}
            onPress={() => {
              inputRef.current?.focus();
            }}
          />
        )}
      </View>
      <BottomSheetFlatList
        data={loading ? [] : dataList}
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
    backgroundColor: isLight
      ? colors2024['neutral-bg-0']
      : colors2024['neutral-bg-1'],
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
    overflow: 'visible',
  },
  wrapperToken: {
    backgroundColor: colors2024['neutral-bg-5'],
  },
  wrapperTokenArrow: {
    position: 'absolute',
    top: -14,
    left: 30,
    zIndex: 1,
    ...makeTriangleStyle({
      dir: 'up',
      size: 7,
      color: colors2024['neutral-bg-5'],
      backgroundColor: 'transparent',
    }),
  },
  left: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  apy: {
    width: 80,
    textAlign: 'right',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['green-default'],
    fontFamily: 'SF Pro Rounded',
  },
  right: {
    flex: 0,
    width: 80,
    gap: 2,
  },
  tvl: {
    width: 80,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    textAlign: 'right',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
  },
  symbolContainer: {
    gap: 2,
  },
  wrapperTokenText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    color: colors2024['neutral-info'],
    fontFamily: 'SF Pro Rounded',
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
    paddingHorizontal: 16,
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
  headerTvl: {
    fontSize: 14,
    lineHeight: 18,
    color: colors2024['neutral-secondary'],
    width: 80,
    flex: 0,
    textAlign: 'right',
  },
  headerApy: {
    fontSize: 14,
    lineHeight: 18,
    color: colors2024['neutral-secondary'],
    width: 80,
    textAlign: 'right',
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
  absoluteContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  sectionHeader: {
    backgroundColor: isLight
      ? colors2024['neutral-bg-0']
      : colors2024['neutral-bg-1'],
    marginTop: 8,
    paddingHorizontal: 0,
    paddingLeft: 0,
  },
  buttonHeader: {
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
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
