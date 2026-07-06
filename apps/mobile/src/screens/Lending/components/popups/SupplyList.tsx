import React, { useCallback, useMemo, useRef, useState } from 'react';
import { TouchableOpacity, View } from 'react-native';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024, makeTriangleStyle } from '@/utils/styles';
import {
  GlobalModalViewProps,
  MODAL_NAMES,
} from '@/components2024/GlobalBottomSheetModal/types';
import {
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
import { openLendingActionPopup } from '../../utils/actionPopup';
import { displayGhoForMintableMarket } from '../../utils/supply';
import { API_ETH_MOCK_ADDRESS } from '../../utils/constant';
import wrapperToken from '../../config/wrapperToken';
import { NextSearchBar } from '@/components2024/SearchBar';
import { formatUsdValueKMB } from '@/screens/TokenDetail/util';
import { isUnFoldToken } from '../../config/unfold';
import { TokenRowSectionHeader } from '@/screens/Home/components/AssetRenderItems';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { Text, TextInput } from '@/components/Typography';
import { colord } from 'colord';
import { PositionTokenSelector } from '../ItemRender/PositionTokenSelector';
import {
  getWrappedNativeReservePair,
  getWrappedNativeTokenOptions,
  isWrappedNativeSelectorReserve,
  isWrappedNativeTokenReserve,
  type BasicPositionTokenOption,
} from '../../utils/positionTokenSelector';

const FOOT_HEIGHT = 86;

type SupplyListItem =
  | { type: 'reserve'; data: DisplayPoolReserveInfo }
  | { type: 'toggle_fold' };

type LendingSupplyListContentProps = {
  hideHeader?: boolean;
  onBeforeSwapNavigate?: () => void;
};

export const LendingSupplyListContent: React.FC<
  LendingSupplyListContentProps
> = ({ hideHeader = false, onBeforeSwapNavigate }) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });

  const { reserves } = useLendingRemoteData();
  const { loading } = useLendingIsLoading();
  const { displayPoolReserves, iUserSummary, getTargetReserve } =
    useLendingSummary();
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [isInputActive, setIsInputActive] = useState(false);
  const [selectedTokenByGroup, setSelectedTokenByGroup] = useState<
    Record<string, string>
  >({});

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

  const shouldMergeWrappedNativeRow = useMemo(() => {
    const { nativeReserve, wrappedReserve } = getWrappedNativeReservePair(
      filteredReserves,
      chainEnum,
    );
    return !search.trim() && !!nativeReserve && !!wrappedReserve;
  }, [chainEnum, filteredReserves, search]);

  const dataList = useMemo<SupplyListItem[]>(() => {
    if (loading) {
      return [];
    }
    const list: SupplyListItem[] = [];
    unFoldList.forEach(item => {
      if (
        shouldMergeWrappedNativeRow &&
        isWrappedNativeTokenReserve(item, chainEnum)
      ) {
        return;
      }
      list.push({
        type: 'reserve',
        data: item,
      });
    });
    if (foldList.length) {
      list.push({ type: 'toggle_fold' });
      if (!foldHideList) {
        foldList.forEach(item => {
          if (
            shouldMergeWrappedNativeRow &&
            isWrappedNativeTokenReserve(item, chainEnum)
          ) {
            return;
          }
          list.push({
            type: 'reserve',
            data: item,
          });
        });
      }
    }
    return list;
  }, [
    chainEnum,
    foldHideList,
    foldList,
    loading,
    shouldMergeWrappedNativeRow,
    unFoldList,
  ]);

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
    (underlyingAsset: string) => {
      const reserve = getTargetReserve(underlyingAsset);
      const userSummary = iUserSummary;
      if (!reserve || !userSummary) {
        return;
      }
      openLendingActionPopup({
        popup: 'supply',
        reserve,
        userSummary,
        colors2024,
        onBeforeSwapNavigate,
      });
    },
    [colors2024, getTargetReserve, iUserSummary, onBeforeSwapNavigate],
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
      const tokenOptions = isWrappedNativeSelectorReserve(data, chainEnum)
        ? getWrappedNativeTokenOptions({
            displayPoolReserves: sortReserves,
            chainEnum,
          })
        : undefined;
      const selectorGroupKey = tokenOptions?.length
        ? `wrapped-native-${chainEnum || 'unknown'}`
        : undefined;
      const activeUnderlyingAsset =
        selectorGroupKey && selectedTokenByGroup[selectorGroupKey]
          ? selectedTokenByGroup[selectorGroupKey]
          : data.underlyingAsset;
      const activeData = tokenOptions?.length
        ? getTargetReserve(activeUnderlyingAsset) || data
        : data;
      const isWrapperToken = chainEnum
        ? isSameAddress(
            wrapperToken[chainEnum]?.address,
            activeData.reserve.underlyingAsset,
          )
        : false;
      const shouldUseWrapperTokenStyle =
        isWrapperToken && !tokenOptions?.length && !search;
      return (
        <TouchableOpacity
          style={[
            styles.item,
            shouldUseWrapperTokenStyle && styles.wrapperToken,
          ]}
          onPress={() => handlePressItem(activeData.underlyingAsset)}>
          {shouldUseWrapperTokenStyle && (
            <View style={styles.wrapperTokenArrow} />
          )}
          <View style={styles.left}>
            <TokenIcon
              size={40}
              tokenSymbol={activeData.reserve.symbol}
              chainSize={0}
              chain={chainEnum || CHAINS_ENUM.ETH}
            />
            <View style={styles.symbolContainer}>
              {tokenOptions?.length ? (
                <PositionTokenSelector
                  activeUnderlyingAsset={activeUnderlyingAsset}
                  options={tokenOptions as BasicPositionTokenOption[]}
                  symbol={activeData.reserve.symbol}
                  chain={activeData.chain}
                  onChange={underlyingAsset => {
                    if (!selectorGroupKey) {
                      return;
                    }
                    setSelectedTokenByGroup(prev => ({
                      ...prev,
                      [selectorGroupKey]: underlyingAsset,
                    }));
                  }}
                />
              ) : (
                <Text
                  style={styles.symbol}
                  numberOfLines={1}
                  ellipsizeMode="tail">
                  {activeData.reserve.symbol}
                </Text>
              )}
              {!!shouldUseWrapperTokenStyle && chainEnum && (
                <Text
                  style={styles.wrapperTokenText}
                  numberOfLines={1}
                  ellipsizeMode="tail">
                  {t('page.Lending.list.item.wrapperToken', {
                    name: wrapperToken[chainEnum]?.origin?.symbol,
                  })}
                </Text>
              )}
            </View>
          </View>
          {!shouldUseWrapperTokenStyle && (
            <Text style={styles.tvl}>
              {formatUsdValueKMB(
                Number(activeData.reserve.totalLiquidityUSD || '0'),
              )}
            </Text>
          )}
          {!shouldUseWrapperTokenStyle && (
            <View style={styles.right}>
              <Text style={styles.apy}>
                {formatApy(Number(activeData.reserve.supplyAPY || '0'))}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      );
    },
    [
      chainEnum,
      foldHideList,
      getTargetReserve,
      handlePressItem,
      search,
      selectedTokenByGroup,
      sortReserves,
      styles,
      t,
    ],
  );

  const renderFooterComponent = useCallback(() => {
    return <View style={{ height: FOOT_HEIGHT }} />;
  }, []);

  return (
    <View style={styles.container}>
      {!hideHeader && (
        <View style={styles.titleContainer}>
          <Text style={styles.titleText}>
            {t('page.Lending.supplyDetail.actions')}
          </Text>
          <NextSearchBar
            style={styles.searchBar}
            value={search}
            onChangeText={setSearch}
            inputContainerStyle={{
              justifyContent: inputNotActiveAndNoQuery
                ? 'center'
                : 'flex-start',
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
      )}
      <BottomSheetFlatList
        data={loading ? [] : dataList}
        style={styles.list}
        showsVerticalScrollIndicator={false}
        keyExtractor={keyExtractor}
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={loading ? <PoolListLoading /> : null}
        ListFooterComponent={renderFooterComponent}
        renderItem={renderItem}
      />
    </View>
  );
};

const LendingSupplyList: React.FC<
  GlobalModalViewProps<MODAL_NAMES.LENDING_SUPPLY_LIST> & {
    onBeforeSwapNavigate?: () => void;
  }
> = ({ onBeforeSwapNavigate }) => {
  return (
    <LendingSupplyListContent onBeforeSwapNavigate={onBeforeSwapNavigate} />
  );
};

export default LendingSupplyList;

const getStyle = createGetStyles2024(({ colors2024 }) => {
  const wrapperTokenCardBgColor = colord(colors2024['neutral-line'])
    .alpha(0.3)
    .toRgbString();

  return {
    container: {
      flex: 1,
      paddingHorizontal: 16,
      width: '100%',
      backgroundColor: colors2024['neutral-bg-1'],
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
      paddingHorizontal: 4,
      paddingVertical: 12,
      justifyContent: 'space-between',
      borderRadius: 16,
      overflow: 'visible',
    },
    wrapperToken: {
      backgroundColor: wrapperTokenCardBgColor,
      //borderWidth: 1,
      paddingHorizontal: 12,
      //borderColor: cardBgColor,
    },
    wrapperTokenArrow: {
      position: 'absolute',
      top: -14,
      left: 20,
      zIndex: 1,
      ...makeTriangleStyle({
        dir: 'up',
        size: 7,
        color: wrapperTokenCardBgColor,
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
      fontSize: 17,
      lineHeight: 22,
      fontWeight: '500',
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
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '500',
      textAlign: 'left',
      color: colors2024['neutral-secondary'],
      fontFamily: 'SF Pro Rounded',
    },
    symbolContainer: {
      gap: 2,
      flexShrink: 1,
      minWidth: 0,
    },
    wrapperTokenText: {
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '500',
      color: colors2024['neutral-info'],
      fontFamily: 'SF Pro Rounded',
      maxWidth: '100%',
    },
    symbol: {
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '700',
      color: colors2024['neutral-title-1'],
      fontFamily: 'SF Pro Rounded',
      maxWidth: 80,
      overflow: 'hidden',
      textAlign: 'left',
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
      marginTop: 0,
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
      textAlign: 'left',
      marginLeft: 8,
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
      backgroundColor: colors2024['neutral-bg-1'],
      marginTop: 8,
      marginBottom: 8,
      paddingHorizontal: 0,
      paddingLeft: 0,
    },
    buttonHeader: {
      backgroundColor: colors2024['neutral-bg-2'],
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
      marginTop: 0,
      marginBottom: 8,
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
  };
});
