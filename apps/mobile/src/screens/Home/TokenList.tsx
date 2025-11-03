import React, {
  useCallback,
  useState,
  useMemo,
  useEffect,
  useRef,
} from 'react';
import { StyleSheet, View } from 'react-native';
import { RefreshControl } from 'react-native-gesture-handler';

import { navigateDeprecated } from '@/utils/navigation';
import { createGetStyles2024 } from '@/utils/styles';
import { AbstractPortfolioToken, ActionItem, CombineToken } from './types';
import {
  ASSETS_ITEM_HEIGHT_NEW,
  ASSETS_SECTION_HEADER,
  DEFI_ITEM_HEIGHT,
  RootNames,
} from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import { MenuAction } from '@/components2024/ContextMenuView/ContextMenuView';

import { TokenRow, TokenRowSectionHeader } from './components/AssetRenderItems';
import { useTranslation } from 'react-i18next';
import { preferenceService } from '@/core/services';
import { toast } from '@/components2024/Toast';
import { StackActions, useNavigation } from '@react-navigation/native';
import { useTriggerTagAssets } from './hooks/refresh';
import { EmptyTokenRow } from './components/AssetRenderItems/EmptyToken';
import { useSwitchSceneCurrentAccount } from '@/hooks/accountsSwitcher';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamsList } from '@/navigation-type';
import { EmptyAssets } from './components/AssetRenderItems/EmptyAssets';
import { ItemLoader } from './components/Skeleton';
import { ScamTokenHeader } from './components/AssetRenderItems/ScamTokenHeader';
import {
  Tabs,
  useCurrentTabScrollY,
  useFocusedTab,
} from 'react-native-collapsible-tab-view';
import { useAnimatedReaction } from 'react-native-reanimated';
import { runOnJS } from 'react-native-reanimated';
import { Account } from '@/core/services/preference';
import { getItemId } from './utils/listRenderId';
import { useTokens } from './hooks/token';
import useSortToken from './hooks/useSortTokens';
import { isScamHidenToken } from './utils/collection';
import { getTotalFoldToken } from './utils/converAssets';
import { useCurrency } from '@/hooks/useCurrency';

export const icons = {
  unfoldDark: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_unfold_dark.png'),
  unfoldLight: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_unfold.png'),
  foldDark: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_fold_dark.png'),
  foldLight: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_fold.png'),
  pinDark: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_token_favorite_dark.png'),
  pinLight: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_token_favorite.png'),
  unpinDark: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_token_unfavorite_dark.png'),
  unpinLight: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_token_unfavorite.png'),
};

interface Props {
  onRefresh?: () => void;
  onReachTopStatusChange?: (status: boolean) => void;
  chain?: string;
  account: Account;
}
const FOOTER_HEIGHT = 56;
const SPACING_HEIGHT = 8;

export const TokenList = ({
  onRefresh,
  chain,
  account: currentAccount,
  onReachTopStatusChange,
}: Props) => {
  const { styles, isLight } = useTheme2024({
    getStyle: getStyles,
  });
  const { t } = useTranslation();

  const [foldHideList, setFoldHideList] = useState(true);
  const [foldScam, setFoldScam] = useState(true);
  const {
    tokens: _rawTokens,
    isLoading: loadingToken,
    updateData,
  } = useTokens(currentAccount?.address?.toLowerCase(), false, 0, undefined);

  const focusedTab = useFocusedTab();
  const hasBeenFocusedRef = useRef(false);

  const isFocused = useMemo(() => {
    const currentFocused = focusedTab === 'tokens';
    if (currentFocused) {
      hasBeenFocusedRef.current = true;
    }
    return hasBeenFocusedRef.current;
  }, [focusedTab]);

  useEffect(() => {
    if (isFocused) {
      updateData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused]);
  const { currency } = useCurrency();

  const tokens = useMemo(() => {
    return _rawTokens?.filter(item =>
      chain && item?.chain ? item.chain === chain : true,
    );
  }, [_rawTokens, chain]);

  const sortTokens = useSortToken(tokens || [], currentAccount);

  const dataList = useMemo(() => {
    const unFoldTokenList: ActionItem[] = sortTokens
      .filter(i => !i._isFold)
      .map(item => ({
        type: 'unfold_token',
        data: item,
      }));
    const foldAndIncludeBalanceTokenList: ActionItem[] = sortTokens
      .filter(
        i =>
          !isScamHidenToken(i) &&
          i._isFold &&
          !i._isExcludeBalance &&
          i._realUsdValue > 0,
      )
      .map(item => ({
        type: 'fold_token',
        data: item,
      }));
    const foldAndExcludeBalanceTokenList: ActionItem[] = sortTokens
      .filter(
        i =>
          !isScamHidenToken(i) &&
          i._isFold &&
          (i._isExcludeBalance || i._realUsdValue === 0),
      )
      .map(item => ({
        type: 'fold_token',
        data: item,
      }));
    const scamTokens: ActionItem[] = sortTokens
      .filter(isScamHidenToken)
      .map(item => ({
        type: 'fold_token',
        data: item,
      }));
    const foldTokenList = [
      ...foldAndIncludeBalanceTokenList,
      ...foldAndExcludeBalanceTokenList,
    ];
    const itemData: Array<{
      show: boolean;
      data: ActionItem[];
    }> = [
      {
        show: true,
        data: unFoldTokenList,
      },
      {
        show: !!foldTokenList.length || !!scamTokens.length,
        data: [
          { type: 'toggle_token_fold' },
          ...(foldHideList ? [] : foldTokenList),
        ],
      },
      {
        show: !foldHideList && !!scamTokens.length,
        data: foldScam
          ? [
              {
                type: 'scam_token',
                data: {
                  total: scamTokens.length,
                  logoUrls: (scamTokens as CombineToken[])
                    .slice(0, 3)
                    .map(i => i.data?.logo_url),
                },
              },
            ]
          : scamTokens,
      },
      {
        show: !!loadingToken && !sortTokens.length,
        data: Array.from({ length: 5 }, (_, index) => ({
          type: 'loading-skeleton',
          data: 'index-token' + index.toString(),
        })),
      },
      {
        show: !loadingToken && !sortTokens.length,
        data: [
          {
            type: 'empty-assets',
            data: t('page.singleHome.sectionHeader.NoData', {
              name: t('page.singleHome.sectionHeader.Token'),
            }),
          },
        ],
      },
    ];
    return itemData
      .filter(item => item.show)
      .map(item => item.data)
      .flat();
  }, [foldHideList, foldScam, loadingToken, sortTokens, t]);

  const totalFoldTokenValue = useMemo(() => {
    return getTotalFoldToken(
      sortTokens.filter(i => i._isFold),
      currency.usd_rate,
      currency.symbol,
    );
  }, [sortTokens, currency.usd_rate, currency.symbol]);

  const navigation =
    useNavigation<NativeStackScreenProps<RootStackParamsList>['navigation']>();

  const [showScrollIndicator, setShowScrollIndicator] = useState(false);

  const { singleTokenRefresh, tokenRefresh } = useTriggerTagAssets();

  const { switchSceneCurrentAccount } = useSwitchSceneCurrentAccount();

  const handleOpenTokenDetail = React.useCallback(
    (token: AbstractPortfolioToken) => {
      navigateDeprecated(RootNames.TokenDetail, {
        token: token,
        isSingleAddress: true,
        account: currentAccount as any,
      });
    },
    [currentAccount],
  );
  const getTokenMenuActions = useCallback(
    (data: AbstractPortfolioToken): MenuAction[] => {
      return [
        {
          title: data._isFold
            ? t('page.tokenDetail.action.unfold')
            : t('page.tokenDetail.action.fold'),
          icon: data._isFold
            ? isLight
              ? icons.unfoldLight
              : icons.unfoldDark
            : isLight
            ? icons.foldLight
            : icons.foldDark,
          androidIconName: data._isFold
            ? 'ic_rabby_menu_unfold'
            : 'ic_rabby_menu_fold',
          key: 'fold',
          action() {
            if (data._isFold) {
              preferenceService.manualUnFoldToken({
                tokenId: data._tokenId,
                chainId: data.chain,
              });
              toast.success(t('page.tokenDetail.actionsTips.unfold_success'));
            } else {
              preferenceService.manualFoldToken({
                tokenId: data._tokenId,
                chainId: data.chain,
              });
              toast.success(t('page.tokenDetail.actionsTips.fold_success'));
            }
            singleTokenRefresh();
            tokenRefresh();
          },
        },
        {
          title: data._isPined
            ? t('page.tokenDetail.action.unfavorite')
            : t('page.tokenDetail.action.favorite'),
          icon: data._isPined
            ? isLight
              ? icons.unpinLight
              : icons.unpinDark
            : isLight
            ? icons.pinLight
            : icons.pinDark,
          androidIconName: data._isPined
            ? 'ic_rabby_menu_token_unfavorite'
            : 'ic_rabby_menu_token_favorite',
          key: 'favorite',
          action() {
            if (data._isPined) {
              preferenceService.removePinedToken({
                tokenId: data._tokenId,
                chainId: data.chain,
              });
            } else {
              preferenceService.pinToken({
                tokenId: data._tokenId,
                chainId: data.chain,
              });
            }
            singleTokenRefresh();
            tokenRefresh();
          },
        },
      ];
    },
    [isLight, singleTokenRefresh, t, tokenRefresh],
  );

  const handleOnReceive = useCallback(async () => {
    if (!currentAccount?.address) {
      return;
    }
    await switchSceneCurrentAccount('MakeTransactionAbout', currentAccount);
    navigation.dispatch(
      StackActions.push(RootNames.StackTransaction, {
        screen: RootNames.Receive,
        params: {
          account: currentAccount,
        },
      }),
    );
  }, [currentAccount, navigation, switchSceneCurrentAccount]);

  const handleOnImport = useCallback(async () => {
    navigation.dispatch(
      StackActions.push(RootNames.StackAddress, {
        screen: RootNames.ImportMethods,
        params: {
          isNotNewUserProc: true,
          isFromEmptyAddress: true,
        },
      }),
    );
  }, [navigation]);

  const renderItem = useCallback(
    (_type, _data) => {
      const { type, data } = _data;
      switch (type) {
        case 'unfold_token':
        case 'fold_token':
          return (
            <View style={styles.rowWrap}>
              <TokenRow
                data={data}
                style={StyleSheet.flatten([
                  styles.renderItemWrapper,
                  !isLight && styles.bg2,
                ])}
                onTokenPress={handleOpenTokenDetail}
                getMenuActions={getTokenMenuActions}
                logoSize={46}
                chainLogoSize={18}
              />
            </View>
          );
        case 'scam_token':
          return (
            <View style={styles.rowWrap}>
              <ScamTokenHeader
                total={data.total}
                logoUrls={data.logoUrls}
                style={StyleSheet.flatten([
                  styles.renderItemWrapper,
                  !isLight && styles.bg2,
                ])}
                onPress={() => {
                  setFoldScam(false);
                }}
              />
            </View>
          );
        case 'toggle_token_fold':
          return (
            <TokenRowSectionHeader
              str={totalFoldTokenValue}
              fold={foldHideList}
              style={styles.sectionHeader}
              buttonStyle={StyleSheet.flatten([
                styles.buttonHeader,
                !isLight && styles.bg2,
              ])}
              onPressFold={() => {
                if (!foldHideList) {
                  setFoldScam(true);
                }
                setFoldHideList(pre => !pre);
              }}
            />
          );
        case 'empty-token':
          return (
            <EmptyTokenRow
              onReceive={handleOnReceive}
              onImport={handleOnImport}
            />
          );
        case 'empty-assets':
        case 'empty-defi':
        case 'empty-nft':
          return <EmptyAssets desc={data} type={type} />;
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
    [
      foldHideList,
      getTokenMenuActions,
      handleOnImport,
      handleOnReceive,
      handleOpenTokenDetail,
      isLight,
      styles.bg2,
      styles.buttonHeader,
      styles.removeLeft,
      styles.renderItemWrapper,
      styles.rowWrap,
      styles.sectionHeader,
      totalFoldTokenValue,
    ],
  );
  const ListRenderSeparator = useCallback(() => {
    return <View style={{ height: SPACING_HEIGHT }} />;
  }, []);

  const ListRenderFooter = useCallback(() => {
    return <View style={{ height: FOOTER_HEIGHT }} />;
  }, []);

  const scrollY = useCurrentTabScrollY();
  const handleScroll = useCallback(
    (currentScrollY: number) => {
      if (currentScrollY <= 0) {
        onReachTopStatusChange?.(true);
      } else {
        onReachTopStatusChange?.(false);
      }
      setShowScrollIndicator(currentScrollY >= 89);
    },
    [onReachTopStatusChange, setShowScrollIndicator],
  );

  useAnimatedReaction(
    () => scrollY.value,
    currentScrollY => {
      runOnJS(handleScroll)(currentScrollY);
    },
  );
  return (
    <View style={styles.container}>
      <Tabs.FlatList
        data={dataList}
        keyExtractor={getItemId}
        renderItem={({ item }) => renderItem(item.type, item)}
        // estimatedItemSize={ASSETS_ITEM_HEIGHT_NEW + ASSETS_SEPARATOR_HEIGHT}
        ItemSeparatorComponent={ListRenderSeparator}
        ListFooterComponent={ListRenderFooter}
        showsVerticalScrollIndicator={showScrollIndicator}
        showsHorizontalScrollIndicator={false}
        style={[styles.bgContainer, styles.list]}
        refreshControl={
          <RefreshControl
            style={styles.bgContainer}
            onRefresh={() => {
              onRefresh?.();
            }}
            refreshing={false}
          />
        }
      />
    </View>
  );
};

const getStyles = createGetStyles2024(ctx => ({
  container: {
    flex: 1,
    paddingTop: 10,
  },
  list: {
    flex: 1,
  },
  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: ASSETS_SECTION_HEADER,
    // paddingHorizontal: 16,
    zIndex: 1,
  },
  bgContainer: {
    // backgroundColor: ctx.colors2024['neutral-bg-1'],
  },
  rowWrap: {
    paddingHorizontal: 16,
  },
  removeLeft: {
    marginLeft: 0,
  },
  renderItemWrapper: {
    backgroundColor: ctx.colors2024['neutral-bg-1'],
    borderRadius: 16,
    height: ASSETS_ITEM_HEIGHT_NEW,
    paddingLeft: 12,
    width: '100%',
  },
  defiGroups: {
    flexDirection: 'row',
    height: DEFI_ITEM_HEIGHT,
    gap: 12,
    paddingHorizontal: 16,
  },
  renderDefiItemWrapper: {
    backgroundColor: ctx.colors2024['neutral-bg-1'],
    borderRadius: 16,
    height: DEFI_ITEM_HEIGHT,
    paddingLeft: 12,
    paddingRight: 16,
  },
  bg2: {
    backgroundColor: ctx.colors2024['neutral-bg-2'],
  },
  sectionHeader: {
    backgroundColor: ctx.colors2024['neutral-bg-gray'],
    // paddingRight: 8,
    height: ASSETS_SECTION_HEADER,
  },
  buttonHeader: {
    backgroundColor: ctx.colors2024['neutral-bg-1'],
  },
  assetHeader: {
    backgroundColor: ctx.colors2024['neutral-bg-gray'],
    height: ASSETS_SECTION_HEADER,
    paddingBottom: 8,
    paddingLeft: 12 + 16,
    paddingRight: 16,
    width: '100%',
  },
  symbol: {
    fontSize: 16,
    height: ASSETS_SECTION_HEADER,
    lineHeight: ASSETS_SECTION_HEADER,
    paddingLeft: 9 + 16,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: ctx.colors2024['neutral-secondary'],
    backgroundColor: ctx.colors2024['neutral-bg-gray'],
  },
}));
