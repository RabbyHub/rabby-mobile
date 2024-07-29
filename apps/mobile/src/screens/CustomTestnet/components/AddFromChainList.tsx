import { apiCustomTestnet } from '@/core/apis';
import { openapi } from '@/core/request';
import {
  TestnetChain,
  createTestnetChain,
} from '@/core/services/customTestnetService';
import { useDebounce, useInfiniteScroll, useRequest } from 'ahooks';
// import { TooltipWithMagnetArrow } from '@/ui/component/Tooltip/TooltipWithMagnetArrow';
import RcIconSearch from '@/assets/icons/dapp/icon-search.svg';
import RcIconBack from '@/assets/icons/header/back-cc.svg';
import { AppBottomSheetModalTitle, Tip } from '@/components';
import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import { findChain } from '@/utils/chain';
import { BottomSheetSectionList } from '@gorhom/bottom-sheet';
import { Input } from '@rneui/themed';
import { range, sortBy } from 'lodash';
import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dimensions,
  StyleProp,
  StyleSheet,
  useWindowDimensions,
  View,
  ViewStyle,
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
import { ModalLayouts } from '@/constant/layout';

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
  const colors = useThemeColors();
  const styles = getStyles(colors);
  const [_search, setSearch] = React.useState('');
  const ref = React.useRef<any>(null);
  const [isFocus, setIsFocus] = React.useState(false);
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
      // target: ref,
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

  return (
    <Animated.View
      style={[
        styles.container,
        { transform: [{ translateX: windowWidth }] },
        containerStyle,
      ]}>
      <View style={styles.header}>
        <View style={styles.navbar}>
          <View style={styles.navbarLeft}>
            <TouchableOpacity onPress={onClose} hitSlop={6}>
              <RcIconBack
                color={colors['neutral-body']}
                width={24}
                height={24}
              />
            </TouchableOpacity>
          </View>
          <AppBottomSheetModalTitle
            style={{ paddingTop: ModalLayouts.titleTopOffset }}
            title={t('page.customTestnet.AddFromChainList.title')}
          />
        </View>
        <Input
          leftIcon={
            <RcIconSearch
              color={colors['neutral-foot']}
              width={20}
              height={20}
            />
          }
          containerStyle={[styles.inputContainer, styles.innerBlock]}
          inputContainerStyle={[
            styles.inputContainerStyle,
            isFocus ? styles.searchInputContainerFocus : null,
          ]}
          style={styles.searchInput}
          placeholder={t('page.customTestnet.AddFromChainList.search')}
          value={_search}
          onChangeText={text => {
            setSearch(text);
          }}
          onFocus={() => {
            setIsFocus(true);
          }}
          onBlur={() => {
            setIsFocus(false);
          }}
        />
      </View>
      <View style={styles.listContainer}>
        {isLoading ? (
          <View style={styles.skeletonContainer}>
            {range(0, 4).map(i => {
              return <SkeletonCard key={i} />;
            })}
          </View>
        ) : isEmpty ? (
          <Empty description={t('page.customTestnet.AddFromChainList.empty')} />
        ) : (
          <CustomTestnetList
            list={list}
            usedList={usedList || []}
            loading={loading}
            loadingMore={loadingMore}
            loadMore={loadMore}
            onSelect={onSelect}
          />
        )}
      </View>
    </Animated.View>
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
  const colors = useThemeColors();
  const styles = getStyles(colors);
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
      // keyExtractor={item => item.id.toString()}
      onEndReached={loadMore}
      onEndReachedThreshold={50}
      stickyHeaderHiddenOnScroll
      renderItem={({ item, index, section }) => {
        const chain = findChain({ id: item.id });
        const isFirst = index === 0;
        const isLast = index === section.data.length - 1;

        return (
          <View
            style={[
              styles.itemContainer,
              isFirst && styles.itemFirst,
              isLast && styles.itemLast,
            ]}>
            {chain ? (
              <Tip
                content={
                  chain?.isTestnet
                    ? t('page.customTestnet.AddFromChainList.tips.added')
                    : t('page.customTestnet.AddFromChainList.tips.supported')
                }>
                <CustomTestnetItem
                  item={item}
                  // onPress={onSelect}
                  style={[styles.item, styles.itemDisabled]}
                />
              </Tip>
            ) : (
              <CustomTestnetItem
                item={item}
                onPress={onSelect}
                style={styles.item}
              />
            )}
            {!isLast ? <View style={styles.itemDivider} /> : null}
          </View>
        );
      }}
      ListFooterComponent={loadingMore ? <SkeletonCard /> : null}
    />
  );
};

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    searchContainer: {
      backgroundColor: 'transparent',
      paddingHorizontal: 0,
      marginRight: 0,
      marginLeft: 0,
      marginBottom: 20,
      paddingBottom: 0,
      paddingTop: 0,
    },
    searchInputContainer: {
      backgroundColor: colors['neutral-card-1'],
      borderRadius: 8,
      borderWidth: 0.5,
      borderBottomWidth: 0.5, // don't delete
      borderColor: colors['neutral-line'],
      height: 50,
      marginLeft: 0,
      paddingRight: 0,
      marginRight: 0,
    },
    searchInputContainerFocus: {
      borderColor: colors['blue-default'],
    },
    searchInput: {
      color: colors['neutral-title-1'],
      fontSize: 14,
      lineHeight: 17,
      width: '100%',
    },
    searchIcon: {
      width: 16,
      height: 16,
      color: colors['neutral-foot'],
      marginLeft: 6,
    },
    cancelButton: {
      fontSize: 14,
      lineHeight: 17,
      color: colors['blue-default'],
      paddingRight: 0,
      display: 'none',
      width: 0,
    },

    container: {
      position: 'absolute',
      backgroundColor: colors['neutral-bg-1'],
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
      top: ModalLayouts.titleTopOffset,
      zIndex: 10,
    },

    listContainer: {
      paddingHorizontal: 20,
      flex: 1,
      marginBottom: 32,
      borderRadius: 6,
    },

    list: {
      flex: 1,
      borderRadius: 6,
    },
    item: {
      backgroundColor: 'transparent',
      borderRadius: 0,
    },
    itemContainer: {
      position: 'relative',
      backgroundColor: colors['neutral-card-2'],
    },
    itemDivider: {
      height: StyleSheet.hairlineWidth,
      position: 'absolute',
      left: 16,
      right: 16,
      bottom: 0,
      backgroundColor: colors['neutral-line'],
    },
    itemFirst: {
      borderTopLeftRadius: 6,
      borderTopRightRadius: 6,
    },
    itemLast: {
      marginBottom: 20,
      borderBottomLeftRadius: 6,
      borderBottomRightRadius: 6,
    },
    itemDisabled: {
      opacity: 0.5,
    },
    skeletonContainer: {
      borderRadius: 6,
      backgroundColor: colors['neutral-card-2'],
    },
    innerBlock: {},
    inputContainer: {
      paddingHorizontal: 0,
      paddingVertical: 0,
      marginBottom: -8,
      flexShrink: 0,
    },
    inputContainerStyle: {
      borderWidth: 1,
      borderRadius: 8,
      borderColor: colors['neutral-line'],
      paddingHorizontal: 16,
    },
  });
