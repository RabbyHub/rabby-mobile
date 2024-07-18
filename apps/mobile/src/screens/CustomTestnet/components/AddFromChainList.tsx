import { apiCustomTestnet } from '@/core/apis';
import { openapi } from '@/core/request';
import {
  TestnetChain,
  createTestnetChain,
} from '@/core/services/customTestnetService';
import { useDebounce, useInfiniteScroll, useRequest } from 'ahooks';
import { id } from 'ethers/lib/utils';
// import { TooltipWithMagnetArrow } from '@/ui/component/Tooltip/TooltipWithMagnetArrow';
import { cloneDeep, range, sortBy } from 'lodash';
import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  SectionList,
  StyleProp,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  ViewStyle,
} from 'react-native';
import { View } from 'react-native';
import { CustomTestnetItem } from './CustomTestnetItem';
import { findChain } from '@/utils/chain';
import { FlatList, TouchableOpacity } from 'react-native-gesture-handler';
import { useThemeColors } from '@/hooks/theme';
import { AppColorsVariants } from '@/constant/theme';
import { SearchBar } from '@rneui/themed';
import RcIconClose from '@/assets/icons/dapp/icon-close-circle.svg';
import RcIconSearch from '@/assets/icons/dapp/icon-search.svg';
import { AppBottomSheetModalTitle, Tip } from '@/components';
import RcIconBack from '@/assets/icons/header/back-cc.svg';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SkeletonCard } from './SkeletonCard';
import { Empty } from './Empty';

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
  const left = useSharedValue(100);

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

  const { data: usedList, loading: isLoadingUsed } = useRequest(() => {
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
  });

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
      left.value = withTiming(100, {
        duration: 400,
      });
    }
  }, [left, visible]);

  const containerStyle = useAnimatedStyle(() => {
    return {
      left: `${left.value}%`,
    };
  });

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      <View style={styles.header}>
        <View style={styles.navbar}>
          <View style={styles.navbarLeft}>
            <TouchableOpacity onPress={onClose}>
              <RcIconBack
                color={colors['neutral-body']}
                width={20}
                height={20}
              />
            </TouchableOpacity>
          </View>
          <AppBottomSheetModalTitle
            title={t('page.customRpc.EditCustomTestnetModal.title')}
          />
        </View>
        <SearchBar
          ref={ref}
          platform="ios"
          placeholder={t('page.customTestnet.AddFromChainList.search')}
          placeholderTextColor={colors['neutral-foot']}
          containerStyle={styles.searchContainer}
          inputContainerStyle={[
            styles.searchInputContainer,
            isFocus ? styles.searchInputContainerFocus : null,
          ]}
          inputStyle={styles.searchInput}
          searchIcon={
            <RcIconSearch style={styles.searchIcon} width={16} height={16} />
          }
          clearIcon={
            <TouchableWithoutFeedback
              onPress={() => {
                ref?.current?.clear();
              }}>
              <RcIconClose />
            </TouchableWithoutFeedback>
          }
          value={_search}
          onChangeText={v => {
            setSearch(v);
            // runSearch(v);
          }}
          showCancel={false}
          showLoading={loading}
          cancelButtonProps={{
            buttonTextStyle: styles.cancelButton,
          }}
          // onClear={() => {
          //   setSearchText('');
          // }}
          onCancel={() => {
            // navigation.goBack();
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
    <SectionList
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
      marginRight: 58,
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
      left: '100%',
      right: 0,
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
      top: 24,
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
  });
