/* eslint-disable react-native/no-inline-styles */
import RcIconClose from '@/assets2024/icons/search/RcIconClose.svg';
import RcIconRight from '@/assets2024/icons/search/IconRight.svg';
import RcIconEmpty from '@/assets2024/icons/history/ImgEmpty.svg';
import RcIconEmptyDark from '@/assets2024/icons/history/ImgEmptyDark.svg';
import RcIconFavorite from '@/assets2024/icons/home/favorite.svg';

import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Keyboard, Pressable, Text, View } from 'react-native';
import {
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native-gesture-handler';

import { RootNames } from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import { AbstractPortfolioToken } from '@/screens/Home/types';
import { navigateDeprecated } from '@/utils/navigation';
import { createGetStyles2024 } from '@/utils/styles';
import { ExternalTokenRow } from '@/screens/Home/components/AssetRenderItems';
import {
  MODAL_ID,
  MODAL_NAMES,
} from '@/components2024/GlobalBottomSheetModal/types';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { CHAINS_ENUM } from '@debank/common';
import { Image } from 'react-native';
import { findChainByEnum } from '@/utils/chain';
import { add0x, ellipsisAddress } from '@/utils/address';
import { isValidHexAddress } from '@metamask/utils';
import { IManageToken } from '@/core/services/preference';
import { preferenceService } from '@/core/services';
import { toast } from '@/components2024/Toast';
import { useFocusEffect } from '@react-navigation/native';
import { TokenItemSkeleton } from '@/screens/Watchlist/components/TokenItem';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { tokenItemToITokenItem } from '@/utils/token';
import { ITokenItem } from '@/store/tokens';
import { FavoriteTag } from '@/components2024/Favorite';

interface Props {
  resultTokens: ITokenItem[];
  loading: boolean;
  searchState: string;
}

const STICKY_HEADER_HEIGHT = 28;

export const SearchAssets: React.FC<Props> = ({
  resultTokens,
  loading,
  searchState,
}) => {
  const { styles, colors2024, isLight } = useTheme2024({ getStyle: getStyles });

  const { t } = useTranslation();
  const [chainEnum, setChainEnum] = useState<CHAINS_ENUM | undefined>();

  const chainInfo = React.useMemo(() => {
    return findChainByEnum(chainEnum);
  }, [chainEnum]);

  const [watchlistTokenList, setWatchlistTokenList] = useState<IManageToken[]>(
    [],
  );

  const modalRef = React.useRef<MODAL_ID>();

  const removeChainModal = React.useCallback(() => {
    if (modalRef.current) {
      removeGlobalBottomSheetModal2024(modalRef.current);
    }
  }, []);

  const fetchPinedTokenList = useCallback(() => {
    preferenceService.getUserTokenSettings().then(res => {
      setWatchlistTokenList(res.pinedQueue || []);
    });
  }, []);

  const handlePressFavorite = useCallback(
    (tokenId: string, chainId: string) => {
      if (
        watchlistTokenList.some(
          t => t.chainId === chainId && t.tokenId === tokenId,
        )
      ) {
        preferenceService.removePinedToken({
          chainId: chainId,
          tokenId: tokenId,
        });
        toast.success(t('page.watchlist.toast.remove'));
      } else {
        preferenceService.pinToken({
          chainId: chainId,
          tokenId: tokenId,
        });
      }
      fetchPinedTokenList();
    },
    [fetchPinedTokenList, t, watchlistTokenList],
  );

  useFocusEffect(fetchPinedTokenList);

  const handleOpenTokenDetail = React.useCallback((token: TokenItem) => {
    navigateDeprecated(RootNames.TokenMarketInfo, {
      token: tokenItemToITokenItem(token, ''),
      unHold: true, // TODO: 待确认
      needUseCacheToken: true,
    });
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: ITokenItem }) => {
      const isPined = watchlistTokenList.some(
        t => t.chainId === item.chain && t.tokenId === item.id,
      );
      return (
        item && (
          <View>
            <ExternalTokenRow
              data={item}
              style={styles.renderItemWrapper}
              onTokenPress={handleOpenTokenDetail}
              logoSize={40}
              decimalPrecision
            />
            {isPined ? <FavoriteTag style={styles.favoriteTag} /> : null}
          </View>
        )
      );
    },
    [
      watchlistTokenList,
      styles.renderItemWrapper,
      styles.favoriteTag,
      handleOpenTokenDetail,
    ],
  );

  const createChainModal = React.useCallback(() => {
    modalRef.current = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.SELECT_CHAIN_WITH_SUMMARY,
      value: chainEnum,
      onClose: removeChainModal,
      hideTestnetTab: true,
      needAllAddresses: true,
      titleText: t('page.swap.selectChainModalTitle'),
      bottomSheetModalProps: {
        enableContentPanningGesture: true,
        rootViewType: 'View',
      },
      onChange: (chain: CHAINS_ENUM) => {
        removeChainModal();
        setChainEnum?.(chain);
      },
    });
  }, [chainEnum, t, removeChainModal]);

  const filterTokens = React.useMemo(() => {
    if (!chainEnum) {
      return resultTokens;
    }
    return resultTokens.filter(token => token.chain === chainInfo?.serverId);
  }, [resultTokens, chainInfo, chainEnum]);

  const ListEmptyComponent = useMemo(
    () =>
      !loading && (!resultTokens || !resultTokens?.length) ? (
        <View style={styles.emptyView}>
          {isLight ? (
            <RcIconEmpty style={styles.image} />
          ) : (
            <RcIconEmptyDark style={styles.image} />
          )}
          <Text style={styles.emptyText}>
            {t('page.search.searchWeb.noResults')}
          </Text>
        </View>
      ) : loading ? (
        <>
          {Array.from({ length: 8 }).map((_, idx) => (
            <TokenItemSkeleton key={idx} />
          ))}
        </>
      ) : null,
    [
      loading,
      styles.image,
      isLight,
      resultTokens,
      styles.emptyView,
      styles.emptyText,
      t,
    ],
  );

  return (
    <View style={styles.container}>
      <View style={[styles.bgContainer, styles.stickyHeader]}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
          {isValidHexAddress(add0x(searchState)) ? (
            <View
              style={{
                flexDirection: 'row',
                gap: 6,
                justifyContent: 'center',
              }}>
              <Text style={styles.sectionHeader}>
                {t('page.search.searchWeb.searching')}
              </Text>
              <Text style={styles.sectionHeaderBlue}>{`"${ellipsisAddress(
                searchState,
              )}"`}</Text>
            </View>
          ) : (
            <Text style={styles.sectionHeader}>{t('page.swap.results')}</Text>
          )}
          {chainInfo ? (
            <View
              style={styles.chainInfoContainer}
              onStartShouldSetResponder={() => true}>
              <View style={styles.chainInfo}>
                <Image
                  source={{
                    uri: chainInfo.logo,
                  }}
                  style={styles.chainIcon}
                />
                <Text style={styles.chainName}>{chainInfo.name}</Text>
              </View>
              <TouchableWithoutFeedback
                disallowInterruption
                style={styles.close}
                onPress={() => {
                  setChainEnum?.(undefined);
                }}>
                <RcIconClose width={12} height={12} />
              </TouchableWithoutFeedback>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.selectChain}
              onPress={() => {
                createChainModal();
                Keyboard.dismiss();
              }}>
              <Text style={styles.selectChainText}>
                {t('page.search.sectionHeader.AllChains')}
              </Text>
              <RcIconRight
                width={12}
                height={12}
                color={colors2024['neutral-foot']}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>
      <FlatList
        keyExtractor={(_, index) => index.toString()}
        data={filterTokens}
        ListEmptyComponent={ListEmptyComponent}
        renderItem={({ item }) => renderItem({ item })}
        style={styles.list}
      />
    </View>
  );
};

const getStyles = createGetStyles2024(ctx => ({
  container: {
    flex: 1,
  },
  skeletonBlock: {
    backgroundColor: ctx.isLight
      ? ctx.colors2024['neutral-bg-0']
      : ctx.colors2024['neutral-bg-1'],
    width: '100%',
    height: 74,
    padding: 0,
    borderRadius: 16,
    marginTop: 8,
  },
  emptyView: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginTop: -50,
    // paddingTop: -250,
  },
  selectChain: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  selectChainText: {
    fontSize: 14,
    lineHeight: 18,
    color: ctx.colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
  },
  list: {
    flex: 1,
    backgroundColor: ctx.isLight
      ? ctx.colors2024['neutral-bg-0']
      : ctx.colors2024['neutral-bg-1'],
    paddingHorizontal: 16,
    marginTop: STICKY_HEADER_HEIGHT,
  },
  close: {
    paddingHorizontal: 4,
    // paddingVertical: 6,
  },
  chainInfoContainer: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
  },
  chainInfo: {
    paddingLeft: 10,
    // paddingVertical: 6,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chainIcon: {
    width: 18,
    height: 18,
    borderRadius: 1000,
  },
  chainName: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: ctx.colors2024['neutral-body'],
  },
  stickyHeader: {
    position: 'absolute',
    width: '100%',
    top: 0,
    left: 0,
    // right: 0,
    height: STICKY_HEADER_HEIGHT,
    zIndex: 1,
  },
  bgContainer: {
    backgroundColor: ctx.isLight
      ? ctx.colors2024['neutral-bg-0']
      : ctx.colors2024['neutral-bg-1'],
    paddingHorizontal: 16,
  },
  emptyHolder: {
    marginTop: 65,
  },
  emptyImg: {
    width: 160,
    height: 117,
  },
  emptyText: {
    marginTop: 21,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '400',
    fontFamily: 'SF Pro Rounded',
    color: ctx.colors2024['neutral-info'],
  },
  sectionHeader: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
    color: ctx.colors2024['neutral-secondary'],
    // backgroundColor: ctx.isLight
    //   ? ctx.colors2024['neutral-bg-0']
    //   : ctx.colors2024['neutral-bg-1'],
  },
  sectionHeaderBlue: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
    color: ctx.colors2024['brand-default'],
    // marginLeft: -24,
  },
  renderItemWrapper: {
    // height: ASSETS_ITEM_HEIGHT_NEW,
    marginBottom: 8,
  },
  image: {
    marginTop: 200,
    // marginBottom: 16,
  },
  footer: {
    height: 200,
  },
  rightSlot: {
    marginLeft: 8,
  },
  favoriteTag: {
    position: 'absolute',
    right: 0,
    top: 0,
  },
}));
