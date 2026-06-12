import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, Pressable, View } from 'react-native';
import { RcNextSearchCC } from '@/assets/icons/common';
import { useTheme2024, useGetBinaryMode } from '@/hooks/theme';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';

import AutoLockView from '@/components/AutoLockView';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetHandlableView } from '@/components/customized/BottomSheetHandle';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { NextSearchBar } from '@/components2024/SearchBar';
import MarketItem from './MarketItem';
import { CustomMarket, MarketDataType, marketsData } from '../config/market';
import { Text, TextInput } from '@/components/Typography';
import { useSceneAccountInfo } from '@/hooks/accountsSwitcher';
import useProtocolListStore from '@/store/protocols';
import type { IProtocolItem } from '@/types/assets';
import { useLendingSummaryCard } from '../hooks';
import {
  marketTotalMarketSizeMap,
  protocolIdToMarketKey,
} from '../config/protocol';
import { useAccountInfo } from '@/screens/Address/components/MultiAssets/hooks';
import { isSameAddress } from '@rabby-wallet/base-utils/src/isomorphic/address';

const marketList: MarketDataType[] = Object.values(marketsData);
const EMPTY_PROTOCOLS: IProtocolItem[] = [];
const getProtocolLendingNetWorth = (protocol: IProtocolItem) => {
  return protocol._portfolios.reduce((sum, portfolio) => {
    if (portfolio.name?.toLowerCase() !== 'lending') {
      return sum;
    }
    return sum + (Number(portfolio.netWorth) || 0);
  }, 0);
};

interface IProps {
  value: CustomMarket;
  /** @deprecated */
  titleText?: string;
  onChange: (market: CustomMarket) => void;
}
const FOOTER_COMPONENT_HEIGHT = 32;
export default function SelectLendingChain({ value, onChange }: IProps) {
  const { t } = useTranslation();
  const [canSearch, setCanSearch] = useState(false);
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const [search, setSearch] = useState('');
  const { finalSceneCurrentAccount } = useSceneAccountInfo({
    forScene: 'Lending',
  });
  const { myTop10Addresses } = useAccountInfo();
  const currentAddress = finalSceneCurrentAccount?.address?.toLowerCase();
  const isCurrentAddressTop10 = useMemo(() => {
    if (!currentAddress) {
      return false;
    }
    return myTop10Addresses.some(address =>
      isSameAddress(address, currentAddress),
    );
  }, [currentAddress, myTop10Addresses]);
  const { iUserSummary } = useLendingSummaryCard();
  const { currentProtocols, getProtocols } = useProtocolListStore(
    useShallow(state => ({
      currentProtocols:
        currentAddress && isCurrentAddressTop10
          ? state.protocolMap[currentAddress] || EMPTY_PROTOCOLS
          : EMPTY_PROTOCOLS,
      getProtocols: state.getProtocols,
    })),
  );

  const isDark = useGetBinaryMode() === 'dark';
  const inputRef = useRef<TextInput | null>(null);

  useEffect(() => {
    if (isCurrentAddressTop10 && finalSceneCurrentAccount?.address) {
      getProtocols(finalSceneCurrentAccount.address);
    }
  }, [finalSceneCurrentAccount?.address, getProtocols, isCurrentAddressTop10]);

  const marketUsdValueMap = useMemo(() => {
    const map = new Map<CustomMarket, number>();
    if (!isCurrentAddressTop10) {
      return map;
    }

    currentProtocols.forEach(protocol => {
      const marketKey = protocolIdToMarketKey(protocol.id);
      const lendingNetWorth = getProtocolLendingNetWorth(protocol);
      if (!marketKey || lendingNetWorth <= 0) {
        return;
      }
      map.set(marketKey, lendingNetWorth);
    });

    const selectedMarketNetWorth = Number(iUserSummary.netWorthUSD || 0);
    if (selectedMarketNetWorth > 0) {
      map.set(value, selectedMarketNetWorth);
    } else {
      map.delete(value);
    }

    return map;
  }, [
    currentProtocols,
    isCurrentAddressTop10,
    iUserSummary.netWorthUSD,
    value,
  ]);

  const hasUserMarketValue = marketUsdValueMap.size > 0;

  const filterMarketList: MarketDataType[] = useMemo(() => {
    const formatKey = search.trim().toLowerCase();
    return marketList
      .filter(item => {
        if (!formatKey) {
          return true;
        }
        return item.marketTitle.toLowerCase().includes(formatKey);
      })
      .sort((a, b) => {
        if (hasUserMarketValue) {
          const aUserValue = marketUsdValueMap.get(a.market) || 0;
          const bUserValue = marketUsdValueMap.get(b.market) || 0;
          const aHasUserValue = aUserValue > 0;
          const bHasUserValue = bUserValue > 0;
          if (aHasUserValue !== bHasUserValue) {
            return bHasUserValue ? 1 : -1;
          }
          if (aHasUserValue && bHasUserValue && aUserValue !== bUserValue) {
            return bUserValue - aUserValue;
          }
        }

        return (
          (marketTotalMarketSizeMap[b.market] || 0) -
          (marketTotalMarketSizeMap[a.market] || 0)
        );
      });
  }, [hasUserMarketValue, marketUsdValueMap, search]);

  const handleToggleSearch = () => {
    if (!canSearch) {
      setSearch('');
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else {
      setSearch('');
      setTimeout(() => {
        inputRef.current?.blur();
      }, 50);
    }
    setCanSearch(!canSearch);
  };

  return (
    <AutoLockView
      style={{
        ...styles.container,
        backgroundColor: isDark
          ? colors2024['neutral-bg-1']
          : colors2024['neutral-bg-0'],
      }}>
      <BottomSheetHandlableView>
        {!canSearch && (
          <View style={{ ...styles.titleView, ...styles.titleViewWithText }}>
            <View style={styles.titleTextWrapper}>
              <Text style={styles.titleText}>
                {t('page.Lending.selectMarket')}
              </Text>
            </View>
            <Pressable onPress={handleToggleSearch} style={styles.iconSearch}>
              <RcNextSearchCC
                color={colors2024['neutral-secondary']}
                width={20}
                height={20}
              />
            </Pressable>
          </View>
        )}
        {canSearch && (
          <View style={styles.titleView}>
            <NextSearchBar
              alwaysShowCancel={true}
              onCancel={handleToggleSearch}
              style={styles.searchBar}
              placeholder={t('page.Lending.searchMarket')}
              value={search}
              onChangeText={v => {
                setSearch(v);
              }}
              returnKeyType="done"
              ref={inputRef}
            />
          </View>
        )}
      </BottomSheetHandlableView>

      <View style={[styles.chainListWrapper]}>
        <BottomSheetFlatList<MarketDataType>
          data={filterMarketList}
          onScrollBeginDrag={() => {
            Keyboard.dismiss();
          }}
          style={styles.flatList}
          ListFooterComponent={
            <View style={{ height: FOOTER_COMPONENT_HEIGHT }} />
          }
          keyExtractor={item => item.market}
          renderItem={({ item, index }) => {
            const isSectionFirst = index === 0;
            const isSectionLast = index === (filterMarketList?.length || 0) - 1;
            return (
              <View
                style={[
                  isSectionFirst && styles.sectionFirst,
                  isSectionLast && styles.sectionLast,
                ]}>
                <MarketItem
                  data={item}
                  value={value}
                  usdValue={marketUsdValueMap.get(item.market)}
                  onPress={onChange}
                />
              </View>
            );
          }}
        />
      </View>
    </AutoLockView>
  );
}

const RADIUS_VALUE = 24;

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    height: '100%',
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  searchBar: {
    flex: 1,
  },
  titleText: {
    color: colors2024['neutral-title-1'],
    fontSize: 20,
    fontWeight: '900',
    fontFamily: 'SF Pro Rounded',
    textAlign: 'center',
    lineHeight: 24,
  },
  titleTextWrapper: {
    flex: 1,
  },
  netSwitchTabs: {
    marginBottom: 20,
  },
  innerBlock: {
    paddingHorizontal: 0,
  },
  inputContainerStyle: {
    height: 46,
    borderRadius: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 0,
  },
  inputText: {
    color: colors2024['neutral-title-1'],
    marginLeft: 7,
    fontSize: 17,
    fontWeight: '400',
    paddingTop: 0,
    paddingBottom: 0,
    fontFamily: 'SF Pro Rounded',
  },

  chainListWrapper: {
    flexShrink: 1,
    height: '100%',
  },

  emptyDataWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    maxHeight: 400,
    // ...makeDebugBorder()
  },

  emptyText: {
    paddingTop: 21,
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    color: colors2024['neutral-info'],
  },

  titleView: {
    display: 'flex',
    flexDirection: 'row',
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },

  inputWrapper: {
    marginRight: 15,
    flex: 1,
    overflow: 'hidden',
  },

  cancelText: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro',
    fontSize: 17,
    lineHeight: 22,
  },

  titleViewWithText: {
    marginBottom: 34,
  },

  iconSearch: {
    position: 'absolute',
    right: 4,
  },
  flatList: {
    paddingHorizontal: 0,
  },
  sectionFirst: {
    borderTopLeftRadius: RADIUS_VALUE,
    borderTopRightRadius: RADIUS_VALUE,
  },
  sectionLast: {
    borderBottomLeftRadius: RADIUS_VALUE,
    borderBottomRightRadius: RADIUS_VALUE,
  },
}));
