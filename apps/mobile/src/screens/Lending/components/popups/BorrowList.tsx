import React, { useCallback, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useTranslation } from 'react-i18next';
import {
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { Skeleton } from '@rneui/themed';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { NextSearchBar } from '@/components2024/SearchBar';
import { API_ETH_MOCK_ADDRESS } from '@aave/contract-helpers';
import { formatUsdValueKMB } from '@/screens/Home/utils/price';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import RcIconWarningCircleCC from '@/assets2024/icons/common/warning-circle-cc.svg';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { TokenRowSectionHeader } from '@/screens/Home/components/AssetRenderItems';

import TokenIcon from '../TokenIcon';
import { PoolListLoading } from '../Loading';
import { DisplayPoolReserveInfo } from '../../type';
import { assetCanBeBorrowedByUser } from '../../utils/borrow';
import {
  useFetchLendingData,
  useLendingIsLoading,
  useLendingRemoteData,
  useLendingSummary,
} from '../../hooks';
import { formatApy } from '../../utils/format';
import { isUnFoldToken } from '../../config/unfold';
import { useSelectedMarket } from '../../hooks';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';

const FOOT_HEIGHT = 86;

type BorrowListItem =
  | { type: 'reserve'; data: DisplayPoolReserveInfo }
  | { type: 'toggle_fold' };

const LendingBorrowList: React.FC = () => {
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
  const { marketKey } = useSelectedMarket();
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

  const isInIsolationMode = useMemo(() => {
    return iUserSummary?.isInIsolationMode;
  }, [iUserSummary?.isInIsolationMode]);

  const sortReserves = useMemo(() => {
    return displayPoolReserves
      ?.filter(item => {
        if (isSameAddress(item.underlyingAsset, API_ETH_MOCK_ADDRESS)) {
          return false;
        }
        if (item.variableBorrows && item.variableBorrows !== '0') {
          return true;
        }
        // emode开启，但是不支持该池子借贷
        const eModeBorrowDisabled =
          !!iUserSummary?.userEmodeCategoryId &&
          !item.reserve.eModes.find(
            e => e.id === iUserSummary.userEmodeCategoryId,
          );
        if (eModeBorrowDisabled) {
          return false;
        }
        // 贷款上限
        //if (BigNumber(item.reserve.totalDebt).gte(item.reserve.borrowCap)) {
        //  return false;
        //}
        const reserve = reserves?.reservesData?.find(x =>
          isSameAddress(x.underlyingAsset, item.reserve.underlyingAsset),
        );
        if (!reserve || !iUserSummary) {
          return false;
        }
        return assetCanBeBorrowedByUser(
          reserve,
          iUserSummary,
          item.reserve.eModes,
        );
      })
      .sort((a, b) => {
        return Number(b.reserve.totalDebtUSD) - Number(a.reserve.totalDebtUSD);
      });
  }, [displayPoolReserves, iUserSummary, reserves?.reservesData]);

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

  const dataList = useMemo<BorrowListItem[]>(() => {
    if (loading) {
      return [];
    }
    const list: BorrowListItem[] = [];
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

  const desc = useMemo(() => {
    if (
      iUserSummary?.availableBorrowsUSD === '0' ||
      !iUserSummary?.availableBorrowsUSD
    ) {
      return t('page.Lending.availableCard.needSupply');
    }
    if (iUserSummary.userEmodeCategoryId !== 0) {
      if (!filteredReserves.length) {
        return t('page.Lending.availableCard.emodeNoAssets');
      }
      return t('page.Lending.availableCard.emode');
    }
    if (isInIsolationMode) {
      return t('page.Lending.availableCard.isolated');
    }
    return t('page.Lending.availableCard.canBorrow');
  }, [
    iUserSummary?.availableBorrowsUSD,
    iUserSummary?.userEmodeCategoryId,
    isInIsolationMode,
    filteredReserves.length,
    t,
  ]);

  const availableCard = useMemo(() => {
    if (loading || !iUserSummary?.totalLiquidityUSD) {
      return null;
    }

    const showOrange = isInIsolationMode || !!iUserSummary?.userEmodeCategoryId;
    return (
      <View
        style={[
          styles.availableCard,
          showOrange && styles.availableCardIsolated,
        ]}>
        <View style={styles.availableCardHeader}>
          {(iUserSummary?.availableBorrowsUSD &&
            iUserSummary?.availableBorrowsUSD === '0') ||
          isInIsolationMode ? (
            <RcIconWarningCircleCC
              width={14}
              height={14}
              color={
                isInIsolationMode
                  ? colors2024['orange-default']
                  : colors2024['neutral-info']
              }
              style={{ position: 'relative', top: 1 }}
            />
          ) : null}
          <Text
            style={[
              styles.availableCardTitle,
              showOrange && styles.orangeText,
            ]}>
            {t('page.Lending.modalDesc.availableToBorrow')}:{' '}
            <Text style={[styles.usdValue, showOrange && styles.orangeText]}>
              {formatUsdValueKMB(
                Number(iUserSummary?.availableBorrowsUSD || '0'),
              )}
            </Text>
          </Text>
        </View>
        <Text
          style={[styles.availableCardValue, showOrange && styles.orangeText]}>
          {desc}
        </Text>
      </View>
    );
  }, [
    colors2024,
    desc,
    iUserSummary?.availableBorrowsUSD,
    iUserSummary?.totalLiquidityUSD,
    iUserSummary?.userEmodeCategoryId,
    isInIsolationMode,
    loading,
    styles.availableCard,
    styles.availableCardHeader,
    styles.availableCardIsolated,
    styles.availableCardTitle,
    styles.availableCardValue,
    styles.orangeText,
    styles.usdValue,
    t,
  ]);

  const handlePressItem = useCallback(
    (item: DisplayPoolReserveInfo) => {
      const reserve = getTargetReserve(item.reserve.underlyingAsset);
      const userSummary = iUserSummary;
      if (!reserve || !userSummary) {
        return;
      }
      const modalId = createGlobalBottomSheetModal2024({
        name: MODAL_NAMES.BORROW_ACTION_DETAIL,
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
        {availableCard}
        {filteredReserves.length ? (
          <View style={styles.listHeader}>
            <Text style={styles.headerToken}>
              {t('page.Lending.list.headers.token')}
            </Text>
            <Text style={styles.headerMyBorrows}>
              {t('page.Lending.list.headers.totalBorrowed')}
            </Text>
            <Text style={styles.headerApy}>{t('page.Lending.apy')}</Text>
          </View>
        ) : null}
      </>
    );
  }, [
    availableCard,
    filteredReserves.length,
    loading,
    styles.headerApy,
    styles.headerMyBorrows,
    styles.headerToken,
    styles.listHeader,
    styles.loading,
    t,
  ]);

  const keyExtractor = useCallback((item: BorrowListItem) => {
    if (item.type === 'toggle_fold') {
      return 'toggle-fold';
    }
    return `${item.data.reserve.underlyingAsset}-${item.data.reserve.symbol}`;
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: BorrowListItem }) => {
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
      return (
        <TouchableOpacity
          style={styles.item}
          onPress={() => handlePressItem(data)}>
          <View style={styles.left}>
            <TokenIcon
              size={46}
              chainSize={0}
              tokenSymbol={data.reserve.symbol}
            />
            <View style={styles.symbolContainer}>
              <Text
                style={styles.symbol}
                numberOfLines={1}
                ellipsizeMode="tail">
                {data.reserve.symbol}
              </Text>
            </View>
          </View>
          <Text style={styles.totalBorrowed}>
            {formatUsdValueKMB(Number(data.reserve.totalDebtUSD || '0'))}
          </Text>
          <View style={styles.right}>
            <Text style={styles.apy}>
              {formatApy(Number(data.reserve.variableBorrowAPY || '0'))}
            </Text>
          </View>
        </TouchableOpacity>
      );
    },
    [foldHideList, handlePressItem, styles],
  );

  const renderFooterComponent = useCallback(() => {
    return <View style={{ height: FOOT_HEIGHT }} />;
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.titleContainer}>
        <Text style={styles.titleText}>
          {t('page.Lending.borrowDetail.actions')}
        </Text>
        <NextSearchBar
          style={styles.searchBar}
          value={search}
          onChangeText={setSearch}
          placeholder={t('component.TokenSelector.searchPlaceHolder2')}
          returnKeyType="search"
          inputContainerStyle={{
            justifyContent: inputNotActiveAndNoQuery ? 'center' : 'flex-start',
          }}
          inputStyle={{
            flex: inputNotActiveAndNoQuery ? 0 : 1,
          }}
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

export default LendingBorrowList;

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
  },
  left: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  apy: {
    flex: 0,
    width: 80,
    fontSize: 16,
    lineHeight: 20,
    textAlign: 'right',
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  totalBorrowed: {
    width: 100,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    textAlign: 'right',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
  },
  right: {
    flex: 0,
    marginLeft: 10,
    width: 80,
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
  yourSupplied: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    textAlign: 'right',
  },
  zeroBorrowed: {
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
    flex: 1,
  },
  headerApy: {
    fontSize: 14,
    lineHeight: 18,
    color: colors2024['neutral-secondary'],
    width: 80,
    textAlign: 'right',
  },
  headerMyBorrows: {
    fontSize: 14,
    lineHeight: 18,
    color: colors2024['neutral-secondary'],
    flex: 0,
    marginLeft: 10,
    width: 100,
    textAlign: 'right',
  },
  sectionHeader: {
    backgroundColor: isLight
      ? colors2024['neutral-bg-0']
      : colors2024['neutral-bg-1'],
    marginTop: 8,
    paddingLeft: 0,
  },
  buttonHeader: {
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
  },
  availableCard: {
    paddingHorizontal: 12,
    paddingVertical: 14,
    backgroundColor: colors2024['neutral-bg-5'],
    borderRadius: 6,
    marginTop: 8,
    gap: 2,
  },
  availableCardIsolated: {
    backgroundColor: colors2024['orange-light-1'],
  },
  availableCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  availableCardTitle: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  orangeText: {
    color: colors2024['orange-default'],
  },
  usdValue: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  availableCardValue: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '400',
    color: colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
  },
  absoluteContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
}));
