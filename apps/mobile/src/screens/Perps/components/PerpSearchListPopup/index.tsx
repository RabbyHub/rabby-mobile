/* eslint-disable react-native/no-inline-styles */
import AutoLockView from '@/components/AutoLockView';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import IconEmptyDefi from '@/assets2024/singleHome/empty-defi.png';
import IconEmptyDefiDark from '@/assets2024/singleHome/empty-defi-dark.png';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { NextSearchBar } from '@/components2024/SearchBar';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { MarketData, perpsStore } from '@/hooks/perps/usePerpsStore';
import { PositionAndOpenOrder } from '@/hooks/perps/usePerpsStore';
import { PerpsMarketItem } from '../PerpsMarketSection/PerpsMarketItem';
import { sortBy } from 'lodash';
import { useShallow } from 'zustand/react/shallow';

export const PerpSearchListPopup: React.FC<{
  visible: boolean;
  openFromSource: 'openPosition' | 'searchPerps';
  onCancel: () => void;
  marketData: MarketData[];
  positionAndOpenOrders?: PositionAndOpenOrder[];
  onSelect: (coin: string) => void;
}> = ({
  visible,
  openFromSource,
  onCancel,
  marketData,
  positionAndOpenOrders,
  onSelect,
}) => {
  const modalRef = useRef<AppBottomSheetModal>(null);
  const { favoriteMarkets } = perpsStore(
    useShallow(s => ({
      favoriteMarkets: s.favoriteMarkets,
    })),
  );
  const { styles, colors2024, isLight } = useTheme2024({
    getStyle: getStyle,
  });
  const [search, setSearch] = useState('');
  const inputRef = useRef<TextInput | null>(null);

  const handleToggleSearch = () => {
    setSearch('');
    setTimeout(() => {
      inputRef.current?.blur();
    }, 50);
  };

  const { t } = useTranslation();

  const list = useMemo(() => {
    const favoriteItems: typeof marketData = [];
    const nonFavoriteItems: typeof marketData = [];
    marketData.forEach(item => {
      const isFavorite = favoriteMarkets.includes(item.name.toUpperCase());
      if (isFavorite) {
        favoriteItems.push(item);
      } else {
        nonFavoriteItems.push(item);
      }
    });
    const sortedFavorites = sortBy(
      favoriteItems,
      item => -(item.dayNtlVlm || 0),
    );
    const sortedNonFavorites = sortBy(
      nonFavoriteItems,
      item => -(item.dayNtlVlm || 0),
    );
    return [...sortedFavorites, ...sortedNonFavorites];
  }, [marketData, favoriteMarkets]);

  const filteredList = useMemo(() => {
    if (!search) {
      return list;
    }

    return (
      list.filter(item => {
        return item.name.toUpperCase().includes(search.toUpperCase());
      }) || []
    );
  }, [list, search]);

  const positionCoinSet = useMemo(() => {
    const set = new Set();
    positionAndOpenOrders?.forEach(order => {
      set.add(order.position.coin);
    });
    return set;
  }, [positionAndOpenOrders]);

  const { height } = useWindowDimensions();
  const maxHeight = useMemo(() => {
    return height - 200;
  }, [height]);

  useEffect(() => {
    if (visible) {
      modalRef.current?.present();
    } else {
      modalRef.current?.close();
    }
  }, [visible]);
  const [isInputActive, setIsInputActive] = useState(false);

  const handleInputFocus = () => {
    setIsInputActive(true);
  };

  const handleInputBlur = () => {
    setIsInputActive(false);
  };

  useEffect(() => {
    if (!visible) {
      setIsInputActive(false);
      setSearch('');
    }
  }, [visible]);

  const inputNotActiveAndNoQuery = useMemo(() => {
    return !(search || isInputActive);
  }, [search, isInputActive]);

  return (
    <AppBottomSheetModal
      ref={modalRef}
      // snapPoints={snapPoints}
      {...makeBottomSheetProps({
        colors: colors2024,
        linearGradientType: isLight ? 'bg0' : 'bg1',
      })}
      onDismiss={onCancel}
      // enableDynamicSizing
      snapPoints={[maxHeight]}
      maxDynamicContentSize={maxHeight}>
      <AutoLockView style={[styles.container]}>
        <View>
          <Text style={styles.title}>
            {openFromSource === 'openPosition'
              ? t('page.perps.searchPerpsPopup.openPosition')
              : t('page.perps.searchPerpsPopup.searchPerps')}
          </Text>
        </View>
        <View style={styles.barContainerView}>
          <NextSearchBar
            onCancel={handleToggleSearch}
            style={styles.searchBar}
            inputContainerStyle={{
              justifyContent: inputNotActiveAndNoQuery
                ? 'center'
                : 'flex-start',
            }}
            inputStyle={{
              flex: inputNotActiveAndNoQuery ? 0 : 1,
            }}
            placeholder={
              openFromSource === 'openPosition'
                ? t('page.perps.searchPerpsPopup.searchPosition')
                : t('page.perps.searchPerpsPopup.searchPlaceholder')
            }
            value={search}
            onChangeText={v => {
              setSearch(v);
            }}
            returnKeyType="done"
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
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
          contentContainerStyle={styles.content}
          data={filteredList}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Image
                source={isLight ? IconEmptyDefi : IconEmptyDefiDark}
                style={styles.image}
              />
              <Text style={styles.imgTitle}>
                {t('page.perps.searchPerpsPopup.empty')}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            return (
              <PerpsMarketItem
                key={item.name}
                item={item}
                isFavorite={favoriteMarkets.includes(item.name.toUpperCase())}
                hasPosition={positionCoinSet.has(item.name)}
                onPress={() => {
                  onCancel();
                  onSelect(item.name);
                }}
              />
            );
          }}
        />
      </AutoLockView>
    </AppBottomSheetModal>
  );
};

const getStyle = createGetStyles2024(({ colors2024, isLight }) => {
  return {
    container: {
      height: '100%',
      // paddingHorizontal: 20,
      // minHeight: 544,
    },
    searchBar: {
      flex: 1,
    },
    barContainerView: {
      display: 'flex',
      flexDirection: 'row',
      width: '100%',
      paddingHorizontal: 20,
      alignItems: 'center',
      marginBottom: 16,
      position: 'relative',
    },

    title: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 20,
      lineHeight: 24,
      fontWeight: '900',
      color: colors2024['neutral-title-1'],
      marginBottom: 16,
      textAlign: 'center',
    },
    empty: {
      height: '80%',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
    },
    imgTitle: {
      color: colors2024['neutral-info'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '400',
    },
    image: {
      marginTop: 120,
      marginBottom: 16,
      width: 163,
      height: 126,
    },
    content: {
      display: 'flex',
      flexDirection: 'column',
      paddingHorizontal: 16,
      gap: 8,
    },
    absoluteContainer: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 1,
    },
    list: {
      borderRadius: 16,
      backgroundColor: isLight
        ? colors2024['neutral-bg-1']
        : colors2024['neutral-bg-2'],
    },
    listItemContainer: {
      padding: 16,
    },
    listItem: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      justifyContent: 'space-between',
    },
    listItemRow: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    listSub: {
      padding: 12,
      backgroundColor: colors2024['neutral-bg-2'],
      borderRadius: 6,
      marginTop: 12,
    },
    listSubItem: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 28,
    },
    listSubItemLabel: {
      flex: 1,
      fontFamily: 'SF Pro Rounded',
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '500',
      color: colors2024['neutral-foot'],
    },
    listItemMain: {
      flex: 1,
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      minHeight: 20,
    },
    label: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '500',
      color: colors2024['neutral-foot'],
    },
    labelInfo: {
      color: colors2024['neutral-info'],
    },
    value: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '700',
      color: colors2024['neutral-title-1'],
    },
    red: {
      color: colors2024['red-default'],
    },
    green: {
      color: colors2024['green-default'],
    },
    feeContainer: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      marginTop: 26,
      marginBottom: 16,
    },
    fee: {
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '400',
      fontFamily: 'SF Pro Rounded',
      color: colors2024['neutral-foot'],
    },
  };
});
