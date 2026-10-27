import { apiCustomTestnet } from '@/core/apis';
import { openapi } from '@/core/request';
import type { TestnetChain } from '@/core/services/customTestnetService';
import { createTestnetChain } from '@/core/utils/customTestnetChain';
import { useDebounce, useInfiniteScroll, useRequest } from 'ahooks';
import RcIconBack from '@/assets/icons/custom-testnet/back.svg';
import { AppBottomSheetModalTitle } from '@/components/customized/BottomSheet';
import { Tip } from '@/components/Tip';
import { NextSearchBar } from '@/components2024/SearchBar';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { findChain } from '@/utils/chain';
import { BottomSheetSectionList } from '@gorhom/bottom-sheet';
import { range, sortBy } from 'lodash';
import React, { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { StyleProp, ViewStyle } from 'react-native';
import {
  Keyboard,
  TouchableWithoutFeedback,
  useWindowDimensions,
  View,
} from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { CustomTestnetItem } from './CustomTestnetItem';
import { Empty } from './Empty';
import { SkeletonCard } from './SkeletonCard';

export const AddFromChainList = ({
  visible,
  onClose,
  onSelect,
}: {
  visible?: boolean;
  onClose?: () => void;
  onSelect?: (chain: TestnetChain) => void;
}) => {
  const { t } = useTranslation();
  const { colors2024, styles } = useTheme2024({ getStyle: getStyles });
  const [_search, setSearch] = React.useState('');
  const search = useDebounce(_search, { wait: 500 });
  const { width: windowWidth } = useWindowDimensions();
  const left = useSharedValue(windowWidth);

  const { loading, data, loadingMore, loadMore } = useInfiniteScroll(
    async data => {
      const res = await openapi.searchChainList({
        start: data?.start || 0,
        limit: 50,
        q: search,
      });

      return {
        list: res.chain_list.map(item => {
          return createTestnetChain({
            name: item.name,
            id: item.chain_id,
            nativeTokenSymbol: item.native_currency.symbol,
            rpcUrl: item.rpc || '',
            scanLink: item.explorer || '',
          });
        }),
        start: res.page.start + res.page.limit,
        total: res.page.total,
      };
    },
    {
      isNoMore(data) {
        return !!data && (data.list?.length || 0) >= (data?.total || 0);
      },
      reloadDeps: [search],
      threshold: 150,
    },
  );

  const {
    data: usedList,
    loading: isLoadingUsed,
    runAsync: runGetUsedList,
  } = useRequest(
    () => {
      return apiCustomTestnet.getUsedCustomTestnetChainList().then(list => {
        return sortBy(
          list.map(item => {
            return createTestnetChain({
              name: item.name,
              id: item.chain_id,
              nativeTokenSymbol: item.native_currency.symbol,
              rpcUrl: item.rpc || '',
              scanLink: item.explorer || '',
            });
          }),
          'name',
        );
      });
    },
    {
      manual: true,
    },
  );

  const isLoading = loading || isLoadingUsed;
  const list = useMemo(() => {
    if (search) {
      return data?.list || [];
    }
    return (data?.list || []).filter(item => {
      return !usedList?.find(used => used.id === item.id);
    });
  }, [data?.list, usedList, search]);

  const isEmpty = useMemo(() => {
    if (isLoading) {
      return false;
    }
    if (search) {
      return !list?.length;
    }
    return !usedList?.length && !list?.length;
  }, [isLoading, search, list, usedList]);

  useEffect(() => {
    if (visible) {
      left.value = withTiming(0, {
        duration: 400,
      });
    } else {
      left.value = withTiming(windowWidth, {
        duration: 400,
      });
    }
  }, [left, visible, windowWidth]);

  useEffect(() => {
    if (visible) {
      runGetUsedList();
    }
  }, [runGetUsedList, visible]);

  const containerStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: left.value }],
    };
  });
  const handleClose = useCallback(() => {
    Keyboard.dismiss();
    onClose?.();
  }, [onClose]);
  const handleSelect = useCallback(
    (chain: TestnetChain) => {
      Keyboard.dismiss();
      onSelect?.(chain);
    },
    [onSelect],
  );

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <Animated.View
        pointerEvents={visible ? 'auto' : 'none'}
        accessibilityElementsHidden={!visible}
        importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
        style={[
          styles.container,
          { transform: [{ translateX: windowWidth }] },
          containerStyle,
        ]}>
        <View style={styles.header}>
          <View style={styles.navbar}>
            <View style={styles.navbarLeft}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={t('global.backButton')}
                onPress={handleClose}
                hitSlop={12}>
                <RcIconBack
                  color={colors2024['neutral-body']}
                  style={styles.backIcon}
                />
              </TouchableOpacity>
            </View>
            <AppBottomSheetModalTitle
              style={styles.modalTitle}
              title={t('page.customTestnet.AddFromChainList.title')}
            />
          </View>
          <NextSearchBar
            as="BottomSheetTextInput"
            noCancel
            style={styles.searchBar}
            inputContainerStyle={styles.searchInputContainer}
            placeholder={t('page.customTestnet.AddFromChainList.search')}
            value={_search}
            onChangeText={setSearch}
          />
        </View>
        <View style={styles.listContainer}>
          {!visible ? null : isLoading ? (
            <View style={styles.skeletonContainer}>
              {range(0, 4).map(i => {
                return <SkeletonCard key={i} />;
              })}
            </View>
          ) : isEmpty ? (
            <Empty
              description={t('page.customTestnet.AddFromChainList.empty')}
            />
          ) : (
            <CustomTestnetList
              list={list}
              usedList={usedList || []}
              loading={loading}
              loadingMore={loadingMore}
              loadMore={loadMore}
              onSelect={handleSelect}
            />
          )}
        </View>
      </Animated.View>
    </TouchableWithoutFeedback>
  );
};

const CustomTestnetList = ({
  loadingMore,
  list,
  usedList,
  onSelect,
  style,
  loadMore,
}: {
  loading?: boolean;
  loadingMore?: boolean;
  list: TestnetChain[];
  usedList: TestnetChain[];
  onSelect?: (chain: TestnetChain) => void;
  style?: StyleProp<ViewStyle>;
  loadMore?: () => void;
}) => {
  const { t } = useTranslation();
  const { styles } = useTheme2024({ getStyle: getStyles });
  return (
    <BottomSheetSectionList
      style={[styles.list, style]}
      sections={[
        {
          type: 'used',
          data: usedList,
        },
        {
          type: 'normal',
          data: list,
        },
      ]}
      keyExtractor={item => item.id.toString()}
      contentContainerStyle={styles.listContent}
      onEndReached={loadMore}
      onEndReachedThreshold={50}
      onScrollBeginDrag={Keyboard.dismiss}
      keyboardShouldPersistTaps="handled"
      stickyHeaderHiddenOnScroll
      renderItem={({ item }) => {
        const chain = findChain({ id: item.id });

        return (
          <View style={styles.itemContainer}>
            {chain ? (
              <Tip
                content={
                  chain?.isTestnet
                    ? t('page.customTestnet.AddFromChainList.tips.added')
                    : t('page.customTestnet.AddFromChainList.tips.supported')
                }>
                <CustomTestnetItem item={item} disabled />
              </Tip>
            ) : (
              <CustomTestnetItem item={item} onPress={onSelect} />
            )}
          </View>
        );
      }}
      ListFooterComponent={loadingMore ? <SkeletonCard /> : null}
    />
  );
};

const getStyles = createGetStyles2024(({ colors2024, safeAreaInsets }) => ({
  container: {
    position: 'absolute',
    backgroundColor: colors2024['neutral-bg-0'],
    top: 0,
    left: 0,
    bottom: 0,
    width: '100%',
  },
  header: {
    paddingHorizontal: 20,
  },
  navbar: {
    position: 'relative',
  },
  navbarLeft: {
    position: 'absolute',
    top: 28,
    zIndex: 10,
  },
  backIcon: {
    transform: [{ rotate: '180deg' }],
  },
  modalTitle: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '900',
    fontSize: 20,
    lineHeight: 24,
    color: colors2024['neutral-title-1'],
    paddingTop: 28,
    marginBottom: 19,
  },
  searchBar: {
    marginBottom: 12,
  },
  searchInputContainer: {
    height: 46,
  },
  listContainer: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: safeAreaInsets.bottom + 12,
  },
  itemContainer: {
    marginBottom: 12,
  },
  skeletonContainer: {
    paddingHorizontal: 16,
    gap: 12,
  },
}));
