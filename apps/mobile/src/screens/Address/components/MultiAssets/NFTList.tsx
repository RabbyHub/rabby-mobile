import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import {
  ASSETS_ITEM_HEIGHT_NEW,
  ASSETS_LIST_HEADER,
  ASSETS_SECTION_HEADER,
  SWITCH_HEADER_HEIGHT,
} from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import {
  NftRow,
  TokenRowSectionHeader,
} from '@/screens/Home/components/AssetRenderItems';
import {
  AbstractProject,
  ActionItem,
  DisplayNftItem,
} from '@/screens/Home/types';
import { createGetStyles2024 } from '@/utils/styles';
import { useAssets } from '@/screens/Search/useAssets';
import { ItemLoader } from '@/screens/Search/components/Skeleton';
import { useAccountInfo } from './hooks';
import { EmptyAssets } from '@/screens/Home/components/AssetRenderItems/EmptyAssets';
import useAccountsBalance from '@/hooks/useAccountsBalance';
import { MenuAction } from '@/components2024/ContextMenuView/ContextMenuView';
import { icons } from '@/screens/Home/AssetContainer';
import { preferenceService } from '@/core/services';
import { toast } from '@/components2024/Toast';
import { useTriggerTagAssets } from '@/screens/Home/hooks/refresh';
import { RefreshControl } from 'react-native-gesture-handler';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { useTriggerUpdate } from './hooks/triggerUpdate';
import { getItemId } from '@/screens/Home/utils/listRenderId';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import {
  collectionNftList,
  NftItemWithCollection,
} from '@/screens/Home/hooks/nft';
import { CollectionList } from '@rabby-wallet/rabby-api/dist/types';
import { useMyAccounts } from '@/hooks/account';
import { Tabs, useFocusedTab } from 'react-native-collapsible-tab-view';
import { TabName } from './TabsMultiAssets';

const SPACING_HEIGHT = 8;
const FOOTER_HEIGHT = 158;
const HEADER_PADDING_HEIGHT = 16;

interface Props {
  chain?: string;
  onRefresh?: () => void;
  updateNft: (nfts: DisplayNftItem[]) => void;
}
export const NFTList = ({
  chain,
  onRefresh: onRefreshProps,
  updateNft,
}: Props) => {
  const { styles, isLight } = useTheme2024({ getStyle: getStyles });
  const { top10Addresses } = useAccountInfo();
  const { triggerUpdate, getTotalBalance } = useAccountsBalance({
    cacheTime: 10 * 60 * 1000,
    accountsNoUnique: true,
  });
  const focusedTab = useFocusedTab();
  const hasBeenFocusedRef = useRef(false);
  const { accounts } = useMyAccounts();

  const getAccountByAddress = useCallback(
    (address: string) => {
      return accounts.find(account => isSameAddress(account?.address, address));
    },
    [accounts],
  );

  const isFocused = useMemo(() => {
    const currentFocused = focusedTab === TabName.nft;
    if (currentFocused) {
      hasBeenFocusedRef.current = true;
    }
    return hasBeenFocusedRef.current;
  }, [focusedTab]);

  const { triggerUpdate: triggerRefresh, setTriggerUpdate: setTriggerRefresh } =
    useTriggerUpdate();

  const {
    nfts: _rawNftList,
    getCacheTop10Assets,
    checkIsExpireAndUpdate,
    isLoading,
  } = useAssets({ hideCombined: !isFocused });
  console.log('CUSTOM_LOGGER:=>: nfts', _rawNftList.length, isFocused);
  const { navigation } = useSafeSetNavigationOptions();

  useEffect(() => {
    if (_rawNftList && !isLoading) {
      updateNft?.(_rawNftList);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_rawNftList?.length, isLoading, updateNft]);
  const { t } = useTranslation();

  const [foldNft, setFoldNft] = useState(true);

  const top10Balance = useMemo(() => {
    return getTotalBalance(top10Addresses);
  }, [top10Addresses, getTotalBalance]);
  const nftList = useMemo(() => {
    return _rawNftList?.filter(item =>
      chain && item?.chain ? item.chain === chain : true,
    );
  }, [_rawNftList, chain]);

  const foldNftList: ActionItem[] = useMemo(
    () =>
      collectionNftList(nftList.filter(i => !i.is_core)).map(item => ({
        type: 'fold_nft',
        data: item,
      })),
    [nftList],
  );
  const unFoldNftList: ActionItem[] = useMemo(
    () =>
      collectionNftList(nftList.filter(i => i.is_core)).map(item => ({
        type: 'unfold_nft',
        data: item,
      })),
    [nftList],
  );

  const dataList = useMemo(() => {
    const itemData: Array<{
      show: boolean;
      data: ActionItem[];
    }> = [
      {
        show: true,
        data: [...unFoldNftList],
      },
      {
        show: !!foldNftList.length,
        data: [{ type: 'toggle_nft_fold' }, ...(foldNft ? [] : foldNftList)],
      },
      {
        show: !!isLoading && !nftList.length,
        data: Array.from({ length: 5 }, (_, index) => ({
          type: 'loading-skeleton',
          data: 'index-nft' + index.toString(),
        })),
      },
      {
        show: !isLoading && nftList?.length === 0,
        data: [
          {
            type: 'empty-nft',
            data: t('page.singleHome.sectionHeader.NoData', {
              name: t('page.singleHome.sectionHeader.Nft'),
            }),
          },
        ],
      },
    ];
    return itemData
      .filter(item => item.show)
      .map(item => item.data)
      .flat();
  }, [foldNft, foldNftList, isLoading, nftList.length, t, unFoldNftList]);

  const hasNotAssets = useMemo(() => {
    return nftList.length === 0 && !isLoading && isFocused;
  }, [nftList.length, isLoading, isFocused]);

  const { nftRefresh } = useTriggerTagAssets();

  const getNftMenuAction = useCallback(
    (data: NftItemWithCollection): MenuAction[] => {
      const isFold = (data as CollectionList)?.nft_list?.every(
        i => (i as unknown as AbstractProject)._isFold,
      );
      return [
        {
          title: isFold
            ? t('page.tokenDetail.action.unfold')
            : t('page.tokenDetail.action.fold'),
          icon: isFold
            ? isLight
              ? icons.unfoldLight
              : icons.unfoldDark
            : isLight
            ? icons.foldLight
            : icons.foldDark,
          androidIconName: isFold
            ? 'ic_rabby_menu_unfold'
            : 'ic_rabby_menu_fold',
          key: 'fold',
          action() {
            if (isFold) {
              if (data.chain) {
                if ('nft_list' in data && data.nft_list.length) {
                  data.nft_list.forEach(i => {
                    preferenceService.manualUnFoldNft({
                      chain: i.chain,
                      id: i.id,
                    });
                  });
                } else {
                  preferenceService.manualUnFoldNft({
                    chain: data.chain,
                    id: data.id,
                  });
                }
                toast.success(t('page.tokenDetail.actionsTips.unfold_success'));
              }
            } else {
              if (data.chain) {
                if ('nft_list' in data && data.nft_list.length) {
                  data.nft_list.forEach(i => {
                    preferenceService.manualFoldNft({
                      chain: i.chain,
                      id: i.id,
                    });
                  });
                } else {
                  preferenceService.manualFoldNft({
                    chain: data.chain,
                    id: data.id,
                  });
                }
                toast.success(t('page.tokenDetail.actionsTips.fold_success'));
              }
            }
            nftRefresh();
          },
        },
      ];
    },
    [isLight, nftRefresh, t],
  );

  const renderItem = useCallback(
    ({ item }) => {
      const { type, data } = item;
      switch (type) {
        case 'unfold_nft':
        case 'fold_nft':
          return (
            <View style={styles.rowWrap}>
              <NftRow
                style={StyleSheet.flatten([
                  styles.renderItemWrapper,
                  !isLight && styles.bg2,
                ])}
                menuActions={getNftMenuAction(data)}
                logoSize={46}
                chainLogoSize={18}
                item={data}
                onPress={() => {}}
              />
            </View>
          );
        case 'toggle_nft_fold':
          return (
            <TokenRowSectionHeader
              str={'' + foldNftList.length}
              fold={foldNft}
              style={styles.sectionHeader}
              buttonStyle={StyleSheet.flatten([
                styles.buttonHeader,
                !isLight && styles.bg2,
              ])}
              onPressFold={() => setFoldNft(pre => !pre)}
            />
          );
        case 'empty-assets':
        case 'empty-nft':
          return (
            <EmptyAssets style={styles.emptyAssets} desc={data} type={type} />
          );
        case 'loading-skeleton':
          return (
            <View style={styles.rowWrap}>
              <ItemLoader style={styles.removeLeft} />
            </View>
          );
        default:
          return null;
      }
    },
    [foldNft, foldNftList.length, getNftMenuAction, isLight, styles],
  );

  const inited = useRef(false);

  useEffect(() => {
    inited.current = false;
  }, [top10Addresses.length]);

  useEffect(() => {
    const cacheTop10AssetsId = setTimeout(() => {
      if (!isFocused) {
        return;
      }
      if (inited.current) {
        return;
      }
      inited.current = true;
      getCacheTop10Assets({
        disableToken: true,
        disableDefi: true,
        realTimeAddresses: top10Addresses,
      });
      checkIsExpireAndUpdate(false, {
        disableToken: true,
        disableDefi: true,
        realTimeAddresses: top10Addresses,
        ignoreLoading: !top10Balance,
      });
    }, 50);
    return () => {
      cacheTop10AssetsId && clearTimeout(cacheTop10AssetsId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused, !top10Balance, top10Addresses.length]);

  const ListRenderSeparator = useCallback(() => {
    return <View style={{ height: SPACING_HEIGHT }} />;
  }, []);
  const ListRenderFooter = useCallback(() => {
    return <View style={{ height: FOOTER_HEIGHT }} />;
  }, []);

  const onRefresh = useCallback(async () => {
    try {
      await Promise.all([
        triggerUpdate(true),
        checkIsExpireAndUpdate(true, { disableToken: true, disableDefi: true }),
      ]);
      onRefreshProps?.();
    } catch (error) {
      console.error('Refresh failed:', error);
    }
  }, [checkIsExpireAndUpdate, onRefreshProps, triggerUpdate]);

  useEffect(() => {
    if (triggerRefresh) {
      onRefresh();
      setTriggerRefresh(false);
    }
  }, [onRefresh, setTriggerRefresh, triggerRefresh]);

  const keyExtractor = useCallback((item: ActionItem) => {
    return getItemId(item);
  }, []);

  return (
    <Tabs.FlatList
      keyExtractor={keyExtractor}
      data={
        hasNotAssets
          ? [
              {
                type: 'empty-nft',
                data: t('page.singleHome.sectionHeader.NoData', {
                  name: t('page.singleHome.sectionHeader.Nft'),
                }),
              },
            ]
          : dataList
      }
      renderItem={renderItem}
      ItemSeparatorComponent={ListRenderSeparator}
      initialNumToRender={15}
      windowSize={15}
      maxToRenderPerBatch={15}
      removeClippedSubviews
      ListHeaderComponent={<View style={{ height: HEADER_PADDING_HEIGHT }} />}
      ListFooterComponent={ListRenderFooter}
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
      style={styles.container}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl
          style={styles.bgContainer}
          onRefresh={() => {
            onRefresh();
          }}
          refreshing={false}
        />
      }
    />
  );
};

const getStyles = createGetStyles2024(ctx => ({
  container: {
    flex: 1,
  },
  list: {
    paddingHorizontal: 16,
  },
  bgContainer: {
    paddingHorizontal: 16,
  },
  sectionHeader: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    fontWeight: '500',
    lineHeight: 22,
    height: ASSETS_SECTION_HEADER,
    color: ctx.colors2024['neutral-secondary'],
    paddingLeft: 0,
    paddingRight: 0,
    backgroundColor: ctx.isLight
      ? ctx.colors2024['neutral-bg-0']
      : ctx.colors2024['neutral-bg-1'],
  },
  emptyAssets: {
    marginHorizontal: 0,
  },
  rowWrap: {
    // paddingHorizontal: 16,
  },
  renderItemWrapper: {
    height: ASSETS_ITEM_HEIGHT_NEW,
  },
  bg2: {
    backgroundColor: ctx.colors2024['neutral-bg-2'],
  },
  buttonHeader: {
    backgroundColor: ctx.isLight
      ? ctx.colors2024['neutral-bg-1']
      : ctx.colors2024['neutral-bg-2'],
  },
  footerGap: {
    height: 70,
  },
  removeLeft: {
    marginLeft: 0,
  },
}));
