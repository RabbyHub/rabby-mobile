/* eslint-disable react-native/no-inline-styles */
import React, {
  useMemo,
  useEffect,
  useCallback,
  useState,
  useRef,
  useImperativeHandle,
} from 'react';
import {
  View,
  Text,
  Keyboard,
  TouchableOpacity,
  StyleSheet,
  Platform,
  SectionListRenderItem,
  TextInput,
  Pressable,
  Dimensions,
} from 'react-native';
import {
  BottomSheetBackdropProps,
  BottomSheetSectionList,
} from '@gorhom/bottom-sheet';
import RcTipCC from '@/assets2024/icons/common/tips.svg';
import RcFoldCC from '@/assets2024/icons/common/fold.svg';
import RcUnFoldCC from '@/assets2024/icons/common/unfold.svg';
import useDebounce from 'react-use/lib/useDebounce';
import { CHAINS_ENUM, Chain } from '@/constant/chains';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { AppBottomSheetModal } from '../customized/BottomSheet';
import { SheetModalShowType, useSheetModal } from '@/hooks/useSheetModal';
import { createGetStyles2024, makeDebugBorder } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import {
  getTokenSymbol,
  type DisplayedTokenWithOwner,
  type TokenItemFromAbstractPortfolioToken,
} from '@/utils/token';
import { formatAmount, formatPrice } from '@/utils/number';
import { formatNetworth } from '@/utils/math';
import { AssetAvatar } from '../AssetAvatar';
import { findChainByServerID } from '@/utils/chain';
import ChainFilterItem, { AccountFilterItem } from './ChainFilterItem';
import FavoriteFilterItem, { FavoriteFilterType } from './FavoriteFilterItem';
import { BottomSheetHandlableView } from '../customized/BottomSheetHandle';
import { toast } from '../Toast';
import { ModalLayouts, RootNames } from '@/constant/layout';
import { Skeleton } from '@rneui/themed';
import { NotMatchedHolder } from '@/screens/Approvals/components/Layout';
import AutoLockView from '../AutoLockView';
import { RefreshAutoLockBottomSheetBackdrop } from '../patches/refreshAutoLockUI';
import { useTranslation } from 'react-i18next';
import { TextBadge } from '@/screens/Address/components/PinBadge';
import { ellipsisOverflowedText } from '@/utils/text';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { useMemoizedFn } from 'ahooks';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import RcIconFavorite from '@/assets2024/icons/home/favorite.svg';
import {
  CompositeScreenProps,
  useFocusEffect,
  useIsFocused,
  useRoute,
} from '@react-navigation/native';
import { Account } from '@/core/services/preference';
import { isSameAccount } from '@/hooks/accountsSwitcher';
import { type TokenItemMaybeWithOwner } from '@/databases/hooks/token';
import { AccountInfoInTokenRow } from './AccountWidgets';
import { isWatchOrSafeAccount } from '@/utils/account';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  RootStackParamsList,
  TransactionNavigatorParamList,
} from '@/navigation-type';
import { TokenItemContextMenu } from './TokenContextMenu';
import {
  ExternalTokenRow,
  TokenRowDataType,
} from '@/screens/Home/components/AssetRenderItems';
import NetSwitchTabs from '@/components2024/PillsSwitch/NetSwitchTabs';
import { useUserTokenSettings } from '@/hooks/useTokenSettings';
import { isScamTokenForSelect } from '@/screens/Home/utils/collection';
import { SCAM_TOKEN_HAEDER_ID, SCAM_TOKEN_HEADER_DATA } from './constant';
import { ScamTokenHeader } from '@/screens/Home/components/AssetRenderItems/ScamTokenHeader';
import { NextSearchBar } from '@/components2024/SearchBar';
import { Favorite } from '@/components2024/Favorite';
import { ensureAbstractPortfolioToken } from '@/screens/Home/utils/token';
import {
  getLatestNavigationName,
  navigateDeprecated,
} from '@/utils/navigation';
import { isFromBackAtom } from '@/screens/Swap/hooks/atom';
import { useAtom } from 'jotai';
import {
  useAnimatedGestureHandler,
  runOnJS,
  useSharedValue,
} from 'react-native-reanimated';
import { PanGestureHandler } from 'react-native-gesture-handler';
import { useRefState } from '@/hooks/common/useRefState';
import { useHandleBackPressClosable } from '@/hooks/useAppGesture';
import { ExchangeLogos } from '@/screens/Home/components/AssetRenderItems/ExchangeLogos';
import { useCexSupportList } from '@/hooks/useCexSupportList';

type SwapRouteProps = CompositeScreenProps<
  NativeStackScreenProps<TransactionNavigatorParamList, 'Swap'>,
  NativeStackScreenProps<RootStackParamsList>
>;

export const isSwapTokenType = (s?: string) =>
  s && ['swapFrom', 'swapTo'].includes(s);

const hiddenZIndex = -9999;

const ITEM_HEIGHT = 72;

const hitSlop = {
  top: 10,
  bottom: 10,
  left: 10,
  right: 10,
};

export type ITokenCheck = (token: TokenItem) => {
  disable: boolean;
  reason: string;
};

interface SearchCallbackCtx {
  chainServerId?: Chain['serverId'] | null;
  filterAccountItem: Account | null;
  chainItem: Chain | null;
}

export type TokenSelectType =
  | 'send'
  | 'swapFrom'
  | 'swapTo'
  | 'bridgeFrom'
  | 'bridgeTo';

type TokenItemFromAbstractPortfolioTokenWithExtra =
  TokenItemFromAbstractPortfolioToken & {
    logoUrls?: string[];
  };
export type TokenItemForRender = {
  _chain: string;
  recentList: ((
    | TokenItem
    | Omit<TokenItemFromAbstractPortfolioToken, 'isPinned' | 'pinIndex'>
  ) & { group?: string })[];
  TokenRender: React.ComponentType<{
    token: TokenItem;
    ownerAccount: DisplayedTokenWithOwner['ownerAccount'];
  }>;
};
export interface TokenSelectorProps<
  T extends TokenSelectType = TokenSelectType,
> {
  // visibleRef: SharedValue<boolean>;
  visible: boolean;
  list: TokenItemMaybeWithOwner[];
  foldTokensList?: TokenItemMaybeWithOwner[];
  isLoading?: boolean;
  onConfirm(item: TokenItemMaybeWithOwner): void;
  onCancel(): void;
  type?: T;
  onSearch: (
    ctx: T extends 'bridgeTo'
      ? string
      : SearchCallbackCtx & {
          keyword: string;
        },
  ) => void;
  onRemoveChainFilter?: (ctx: SearchCallbackCtx) => void;
  placeholder?: string;
  displayAccountFilter?: boolean;
  filterAccount?: Account | null;
  hideChainFilter?: boolean;
  chainServerId?: string;
  disabledTips?: string;
  supportChains?: CHAINS_ENUM[] | undefined;
  headerTitle?: React.ReactNode;
  selectToken?: TokenItem & { tokenId?: string };
  searchPlaceholder?: string;
  disableItemCheck?: ITokenCheck;
  unshiftList?: {
    data: TokenItemForRender[];
    header?: () => React.ReactNode;
  }[];
  showTestNetSwitch?: boolean;
  selectTab?: 'mainnet' | 'testnet';
  onTabChange?: (tab: 'mainnet' | 'testnet') => void;
  showFavoriteFilter?: boolean;
  favoriteFilterValue?: FavoriteFilterType;
  onFavoriteFilterChange?: (value: FavoriteFilterType) => void;
  disableSort?: boolean;
}
const filterTestnetTokenItem = (token: TokenItem) => {
  return !findChainByServerID(token.chain)?.isTestnet;
};

const isAndroid = Platform.OS === 'android';

const screenHeight = Dimensions.get('window').height;
const modalHeight = screenHeight - 120;
const snapPoints = [modalHeight];

export function useTokenSelectorModalVisible(options?: {
  onVisibleChanged?: (visible: boolean) => void;
}) {
  const {
    state: visible,
    stateRef: visibleRef,
    setRefState: setVisible,
  } = useRefState(false);

  const { onVisibleChanged } = options || {};
  const onVisibleChangedRef = useRef(onVisibleChanged);
  useEffect(() => {
    onVisibleChangedRef.current = onVisibleChanged;
  }, [onVisibleChanged]);

  const tokenSelectorModalRef = useRef<TokenSelectorSheetModalInst>(null);
  const setTokenSelectorVisible = useCallback(
    (
      visible: boolean,
      options?: {
        delayShowModal?: number;
        delaySetState?: number;
        noTriggerRerender?: boolean;
      },
    ) => {
      onVisibleChangedRef.current?.(visible);

      const {
        delayShowModal = 0,
        delaySetState = 100,
        noTriggerRerender = false,
      } = options || {};
      if (delayShowModal) {
        setTimeout(() => {
          tokenSelectorModalRef.current?.toggleShow(visible);
        }, delayShowModal);
      } else {
        tokenSelectorModalRef.current?.toggleShow(visible);
      }

      // setVisible(visible, !noTriggerRerender);
      const delayMs = Math.max(delaySetState, 100);
      setTimeout(() => {
        setVisible(visible, !noTriggerRerender);
      }, delayMs);
    },
    [onVisibleChangedRef, setVisible],
  );

  return {
    visible,
    visibleRef,
    setTokenSelectorVisible,
    tokenSelectorModalRef,
  };
}
export type TokenSelectorSheetModalInst = {
  toggleShow: (nextShown: SheetModalShowType) => void;
};
export const TokenSelectorSheetModal = React.forwardRef<
  TokenSelectorSheetModalInst,
  RNViewProps & TokenSelectorProps
>(
  (
    {
      visible,
      list,
      foldTokensList = [],
      displayAccountFilter = false,
      filterAccount,
      chainServerId,
      onConfirm,
      onCancel,
      onRemoveChainFilter,
      hideChainFilter = true,
      type,
      onSearch,
      supportChains,
      disabledTips,
      isLoading,
      headerTitle: customHeaderTitle,
      searchPlaceholder,
      disableItemCheck,
      unshiftList,
      showTestNetSwitch,
      selectTab,
      onTabChange,
      showFavoriteFilter = false,
      favoriteFilterValue = 'all',
      onFavoriteFilterChange,
      disableSort = false,
    },
    ref,
  ) => {
    const { sheetModalRef: tokenSelectorModalRef, toggleShowSheetModal } =
      useSheetModal();
    const [isFromBack, setIsFromBack] = useAtom(isFromBackAtom);
    const { list: cexList } = useCexSupportList();

    useImperativeHandle(ref, () => {
      return {
        toggleShow: nextShown => {
          toggleShowSheetModal(nextShown);
        },
      };
    });

    const initialRouteRef = useRef<string | undefined>();
    useEffect(() => {
      if (!initialRouteRef.current && visible) {
        initialRouteRef.current = getLatestNavigationName();
      }
    }, [visible]);

    const [fold, setFold] = useState(true);
    const [isScamFold, setIsScamFold] = useState(true);

    const { t } = useTranslation();
    const isBridgeTo = type === 'bridgeTo';
    const isSwapTo = type === 'swapTo';
    const isSend = type === 'send';

    useEffect(() => {
      if (!visible) {
        setIsInputActive(false);
        setFold(true);
        setIsScamFold(true);
        setQuery('');
      }
    }, [visible]);

    const handleShowExcludeTips = useMemoizedFn(() => {
      const modalId = createGlobalBottomSheetModal2024({
        name: MODAL_NAMES.DESCRIPTION,
        title: t('page.tokenDetail.excludeBalanceTips'),
        sections: [],
        bottomSheetModalProps: {
          enableContentPanningGesture: true,
          enablePanDownToClose: true,
          enableDismissOnClose: true,
          snapPoints: ['40%'],
        },
        nextButtonProps: {
          title: (
            <Text style={styles.modalNextButtonText}>
              {t('page.tokenDetail.excludeBalanceTipsButton')}
            </Text>
          ),
          titleStyle: StyleSheet.flatten([styles.modalNextButtonText]),
          onPress: () => {
            removeGlobalBottomSheetModal2024(modalId);
          },
        },
      });
    });

    const { bottom } = useSafeAreaInsets();

    const androidBottomOffset = isAndroid ? bottom : 0;

    const { isLight, styles, colors2024 } = useTheme2024({ getStyle });

    const inputRef = useRef<TextInput | null>(null);

    const [query, setQuery] = useState('');
    const [isInputActive, setIsInputActive] = useState(false);

    const [swapToTokenDetail, setSwapToTokenDetail] = useState(false);
    const route = useRoute<SwapRouteProps['route']>();
    const isFocused = useIsFocused();
    const { userTokenSettings, pinToken, removePinedToken } =
      useUserTokenSettings();

    const isSwapRoute =
      route.name === RootNames.Swap || route.name === RootNames.MultiSwap;

    if (isSwapTo && swapToTokenDetail && visible && isFocused && isSwapRoute) {
      setSwapToTokenDetail(false);
    }

    if (
      isSwapTo &&
      isSwapRoute &&
      route.params?.isSwapToTokenDetail &&
      swapToTokenDetail &&
      visible &&
      isFocused
    ) {
      toggleShowSheetModal('destroy');
    }

    const currentRoute = getLatestNavigationName();
    const isInInitialRoute = useMemo(() => {
      if (!visible || !initialRouteRef.current) {
        return true;
      }
      return currentRoute === initialRouteRef.current;
    }, [currentRoute, visible]);

    useEffect(() => {
      if (!isFromBack && visible) {
        toggleShowSheetModal('destroy');
        setIsFromBack(false);
      }
    }, [visible, toggleShowSheetModal, isFromBack, setIsFromBack]);

    const { chainItem, chainSearchCtx } = useMemo(() => {
      const chain = !chainServerId ? null : findChainByServerID(chainServerId);
      return {
        chainItem: chain,
        chainSearchCtx: {
          chainServerId: chainServerId ?? null,
          chainItem: chain,
          filterAccountItem: filterAccount || null,
        },
      };
    }, [chainServerId, filterAccount]);

    useDebounce(
      () => {
        onSearch(isBridgeTo ? query : { ...chainSearchCtx, keyword: query });
      },
      150,
      [chainSearchCtx, query],
    );

    const handleQueryChange = (value: string) => {
      setQuery(value);
    };

    const handleInputFocus = () => {
      setIsInputActive(true);
    };

    const handleInputBlur = () => {
      setIsInputActive(false);
    };

    const displayList = useMemo(() => {
      if (isBridgeTo || isSend) {
        return list || [];
      }

      if (!supportChains?.length) {
        const resultList = list || [];
        if (!chainServerId) {
          return resultList.filter(filterTestnetTokenItem);
        }

        return resultList;
      }

      const varied = (list || []).reduce(
        (accu, token) => {
          const _chainItem = findChainByServerID(token.chain);
          const disabled =
            !!supportChains?.length &&
            _chainItem &&
            !supportChains.includes(_chainItem.enum);

          if (!disabled) {
            accu.natural.push(token);
          } else if (_chainItem?.isTestnet && !chainServerId) {
            accu.ignored.push(token);
          } else {
            accu.disabled.push(token);
          }

          return accu;
        },
        {
          natural: [] as TokenItemMaybeWithOwner[],
          disabled: [] as TokenItemMaybeWithOwner[],
          ignored: [] as TokenItemMaybeWithOwner[],
        },
      );

      return [...varied.natural, ...varied.disabled];
    }, [isBridgeTo, isSend, supportChains, list, chainServerId]);

    const isFromModalType = useMemo(
      () =>
        type === 'swapFrom' ||
        type === 'swapTo' ||
        type === 'bridgeFrom' ||
        type === 'send',
      [type],
    );

    const needToTokenMarketInfo = useMemo(() => {
      return type === 'swapTo' || type === 'bridgeTo';
    }, [type]);

    const tokens = useMemo(() => {
      const normalFoldTokens = foldTokensList.filter(
        i => !isScamTokenForSelect(i),
      );
      const scamTokens = foldTokensList.filter(isScamTokenForSelect);
      const allList = [
        ...(displayList || []),
        ...(normalFoldTokens?.slice(0, fold ? 1 : undefined) || []),
        ...(fold || !isScamFold || !scamTokens.length
          ? []
          : [
              {
                ...SCAM_TOKEN_HEADER_DATA,
                amount: scamTokens.length,
                logoUrls: scamTokens.slice(0, 3).map(item => item.logo_url),
              },
            ]),
        ...(fold || isScamFold ? [] : scamTokens),
      ];

      const formatList = (allList ?? []).map(x => {
        const _netWorth = x.amount * x.price || 0;
        const amountStr = x.amount ? formatAmount(x.amount) : '0';
        const usdValueStr = _netWorth ? formatNetworth(_netWorth) : '$0';
        return {
          id: x.id,
          amount: x.amount,
          _logo: x.logo_url,
          _symbol: getTokenSymbol(x),
          _amount: amountStr,
          _price: '$' + formatPrice(x.price),
          _netWorth: _netWorth,
          _netWorthStr: usdValueStr,
          _chain: x.chain,
          // @ts-expect-error
          trade_volume_level: x?.trade_volume_level,
          /**
           * @description in fact, it's impossible to be TokenItemFromAbstractPortfolioToken, it's always TokenItemForRender!
           * Just left here to keep the type consistent for old code
           */
          $origin: {
            _amountStr: amountStr,
            _usdValueStr: usdValueStr,
            ...x,
          } as unknown as
            | TokenItemForRender
            | TokenItemFromAbstractPortfolioTokenWithExtra,
        };
      });

      return isFromModalType || disableSort
        ? formatList
        : formatList.sort((m, n) => n._netWorth - m._netWorth);
    }, [
      foldTokensList,
      displayList,
      fold,
      isScamFold,
      isFromModalType,
      disableSort,
    ]);

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => {
        return (
          <RefreshAutoLockBottomSheetBackdrop
            {...props}
            style={[
              props.style,
              (!isInInitialRoute || swapToTokenDetail) && {
                zIndex: hiddenZIndex,
              },
            ]}
            onPress={onCancel}
            disappearsOnIndex={-1}
            appearsOnIndex={0}
          />
        );
      },
      [isInInitialRoute, onCancel, swapToTokenDetail],
    );

    const ListHeader = useMemo(() => {
      return (
        <>
          {isLoading ? (
            <>
              {Array.from({ length: 10 }).map((_, index) => (
                <LoadingItem key={index} />
              ))}
            </>
          ) : null}
        </>
      );
    }, [isLoading]);

    const onPressToken = useCallback(() => {
      if (!fold) {
        setIsScamFold(true);
      }
      return setFold(pre => !pre);
    }, [fold]);

    const longPressTriggered = useRef(false);
    const renderItemRenderComponent = useCallback<
      SectionListRenderItem<(typeof tokens)[number]>
    >(
      ({ item: token }) => {
        if (isLoading) {
          return null;
        }
        // @TODO Code below is just for compatibility, developer should vary TokenItemForRender
        // with real TokenItem(including Token, TokenItemFromAbstractPortfolioToken), and remove this cast.
        //
        // In fact, TokenItemForRender needn't be mixed with real TokenItem, it's only passed from `unshiftList` and used
        // ONLY ONCE globally in `apps/mobile/src/screens/Swap/components/TokenSelect.tsx`, it's ALWAYS from `recentDisplayToTokens` in it.
        //
        // You can pass TokenItemForRender from another property, such as `extraRenderData` rather than `unshiftList`, as it's NOT something in list.
        const $originMaybeToken =
          token.$origin as TokenItemFromAbstractPortfolioTokenWithExtra;

        const { disable: lightDisable } =
          disableItemCheck?.($originMaybeToken) || {};

        const ownerAccount =
          'ownerAccount' in token.$origin ? token.$origin.ownerAccount : null;
        const ownerKey = !ownerAccount
          ? ''
          : `${ownerAccount.type}-${ownerAccount.address}`;

        const showOwnerAccount = !chainSearchCtx.filterAccountItem;

        const isPined =
          $originMaybeToken.isPined ||
          userTokenSettings.pinedQueue.some(
            pinned =>
              pinned.chainId === $originMaybeToken?.chain &&
              pinned.tokenId === $originMaybeToken?.id,
          );
        const isManualFold = $originMaybeToken.isManualFold;
        const token_key = [
          ownerKey,
          `${$originMaybeToken.id}-${token._symbol}-${token._chain}`,
        ]
          .filter(Boolean)
          .join('-');
        const currentChainItem = findChainByServerID(token._chain);
        const disabled =
          !!supportChains?.length &&
          currentChainItem &&
          !supportChains.includes(currentChainItem.enum);

        const isExcludeBalanceShowTips =
          $originMaybeToken.isExcludeBalance &&
          isFromModalType &&
          (token._netWorth || 0) > 0;
        const formatToken = token.$origin as TokenRowDataType;
        const cexLogos = formatToken?.cex_ids
          ? formatToken?.cex_ids
              .map(id => cexList.find(item => item.id === id)?.logo_url || '')
              .filter(i => !!i) || []
          : formatToken?.identity?.cex_list?.map(item => item.logo_url) || [];

        if (token.id === SCAM_TOKEN_HAEDER_ID) {
          return (
            <ScamTokenHeader
              onPress={() => {
                setIsScamFold(false);
              }}
              style={styles.scamHeader}
              total={token.amount}
              logoUrls={$originMaybeToken.logoUrls}
            />
          );
        }

        if ($originMaybeToken.isFakerFoldRow) {
          return (
            <View style={StyleSheet.flatten([styles.tokenRowWrap])}>
              <View style={styles.tokenRowTokenWrap}>
                <View style={styles.tokenRowTokenInner}>
                  <TouchableOpacity
                    onPress={onPressToken}
                    style={styles.tokenRowTokenInnerSmallToken}>
                    <Text style={styles.actionText}>
                      {fold ? 'All' : 'Less'}
                    </Text>
                    {fold ? (
                      <RcUnFoldCC
                        style={styles.arrow}
                        color={colors2024['neutral-secondary']}
                      />
                    ) : (
                      <RcFoldCC
                        style={styles.arrow}
                        color={colors2024['neutral-secondary']}
                      />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.tokenRowUsdValueWrap}>
                <Text style={styles.tokenRowUsdValue}>
                  {$originMaybeToken.smallTokenAllUsdValue}
                </Text>
              </View>
            </View>
          );
        }

        if (query) {
          return (
            <View style={{ marginTop: 8, marginHorizontal: 16 }}>
              <TokenItemContextMenu
                token={$originMaybeToken}
                needToTokenMarketInfo={needToTokenMarketInfo}
                closeBottomSheet={() => {
                  toggleShowSheetModal('destroy');
                }}
                type={type}>
                <TouchableOpacity
                  delayLongPress={200}
                  onLongPress={() => {
                    longPressTriggered.current = true;
                  }}
                  onPressOut={() => {
                    longPressTriggered.current = false;
                  }}
                  onPress={() => {
                    if (longPressTriggered.current) {
                      longPressTriggered.current = false;
                      return;
                    }
                    if (disabled) {
                      disabledTips && toast.info(disabledTips);
                      return;
                    }
                    onConfirm($originMaybeToken);
                    toggleShowSheetModal('collapse');
                  }}>
                  <ExternalTokenRow
                    decimalPrecision
                    data={token.$origin as TokenRowDataType}
                    logoSize={40}
                    touchable={false}
                    rightSlot={
                      <Pressable
                        style={styles.rightSlot}
                        onPress={e => {
                          e.stopPropagation();
                          if (isPined) {
                            removePinedToken(token.$origin as any);
                          } else {
                            pinToken(token.$origin as any);
                          }
                        }}
                        hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}>
                        <RcIconFavorite
                          width={22}
                          height={21}
                          color={
                            isPined
                              ? colors2024['orange-default']
                              : colors2024['neutral-line']
                          }
                        />
                      </Pressable>
                    }
                    onPressRightIcon={() => {
                      setTimeout(() => {
                        toggleShowSheetModal('destroy');
                      }, 100);

                      navigateDeprecated(
                        needToTokenMarketInfo
                          ? RootNames.TokenMarketInfo
                          : RootNames.TokenDetail,
                        {
                          token: {
                            ...ensureAbstractPortfolioToken($originMaybeToken),
                            _isPined: isPined,
                          },
                          needUseCacheToken: true,
                          tokenSelectType: type,
                        },
                      );
                    }}
                  />
                </TouchableOpacity>
              </TokenItemContextMenu>
            </View>
          );
        }

        return (
          <View style={{ marginTop: 8, marginHorizontal: 16 }}>
            <TokenItemContextMenu
              token={token.$origin as any}
              closeBottomSheet={() => {
                toggleShowSheetModal('destroy');
              }}
              needToTokenMarketInfo={needToTokenMarketInfo}
              type={type}>
              <TouchableOpacity
                key={token_key}
                delayLongPress={200}
                onLongPress={() => {
                  longPressTriggered.current = true;
                }}
                onPressOut={() => {
                  longPressTriggered.current = false;
                }}
                onPress={() => {
                  if (longPressTriggered.current) {
                    longPressTriggered.current = false;
                    return;
                  }
                  if (disabled) {
                    disabledTips && toast.info(disabledTips);
                    return;
                  }
                  onConfirm($originMaybeToken);
                  toggleShowSheetModal('collapse');
                }}
                style={[
                  styles.tokenItem,
                  // isSwapTo && { paddingRight: 0, paddingVertical: 0 },
                  (disabled || lightDisable) && styles.tokenItemDisabled,
                ]}>
                <View style={[styles.tokenLeft, styles.tokenLeftLoaded]}>
                  <AssetAvatar
                    logo={token?._logo}
                    size={40}
                    chain={token?._chain}
                    chainSize={18}
                    innerChainStyle={styles.chainLogo}
                    style={styles.tokenAvatarCol}
                  />
                  <View style={[styles.tokenInfoCol, styles.tokenInfoColLeft]}>
                    <View
                      style={[
                        styles.tokenNameBox,
                        needToTokenMarketInfo && styles.tokenNameBoxWithLogos,
                      ]}>
                      <Text
                        style={styles.tokenName}
                        ellipsizeMode="tail"
                        numberOfLines={1}>
                        {token?._symbol}
                      </Text>
                      {isManualFold && <TextBadge type="folded" />}
                      {needToTokenMarketInfo && (
                        <ExchangeLogos logos={cexLogos} />
                      )}
                    </View>
                    {showOwnerAccount ? (
                      !ownerAccount ? null : (
                        <AccountInfoInTokenRow
                          containerStyle={{ marginTop: 2 }}
                          ownerAccount={ownerAccount}
                        />
                      )
                    ) : (
                      <Text
                        style={[styles.tokenPrice, { marginTop: 4 }]}
                        numberOfLines={1}>
                        {token._price}
                      </Text>
                    )}
                    {isBridgeTo && (
                      <View
                        style={[
                          styles.tokenInfoColRight,
                          styles.tardeLevel,
                          {
                            backgroundColor:
                              token.trade_volume_level === 'low'
                                ? colors2024['orange-light-4']
                                : colors2024['green-light-4'],
                          },
                        ]}>
                        <Text
                          style={[
                            styles.tardeLevelText,
                            {
                              color:
                                token.trade_volume_level === 'low'
                                  ? colors2024['orange-default']
                                  : colors2024['green-default'],
                            },
                          ]}>
                          {token.trade_volume_level === 'low'
                            ? t('component.TokenSelector.bridgeTo.low')
                            : t('component.TokenSelector.bridgeTo.high')}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
                <View style={styles.tokenRight}>
                  <View style={[styles.tokenInfoCol, styles.tokenInfoColRight]}>
                    <Text style={[styles.tokenHeaderNetworth]}>
                      {isExcludeBalanceShowTips ? (
                        <TouchableOpacity
                          hitSlop={hitSlop}
                          onPress={handleShowExcludeTips}>
                          <RcTipCC
                            style={styles.tips}
                            color={colors2024['neutral-info']}
                          />
                        </TouchableOpacity>
                      ) : (
                        token._netWorthStr
                      )}
                    </Text>
                    <Text
                      numberOfLines={1}
                      ellipsizeMode="tail"
                      style={[
                        styles.tokenHeaderAmount,
                        { marginTop: 4 },
                        isExcludeBalanceShowTips && styles.textSecondary,
                      ]}>
                      {token._amount} {token._symbol}
                    </Text>
                  </View>
                  <Favorite
                    favorite={isPined}
                    style={styles.favorite}
                    handlePressFavorite={() => {
                      if (isPined) {
                        removePinedToken(token.$origin as any);
                      } else {
                        pinToken(token.$origin as any);
                      }
                    }}
                  />
                </View>
              </TouchableOpacity>
            </TokenItemContextMenu>
          </View>
        );
      },
      [
        isLoading,
        disableItemCheck,
        chainSearchCtx.filterAccountItem,
        userTokenSettings.pinedQueue,
        supportChains,
        isFromModalType,
        query,
        needToTokenMarketInfo,
        type,
        styles,
        isBridgeTo,
        colors2024,
        t,
        handleShowExcludeTips,
        onPressToken,
        fold,
        toggleShowSheetModal,
        onConfirm,
        disabledTips,
        removePinedToken,
        pinToken,
        cexList,
      ],
    );

    const section = useMemo(() => {
      if (!tokens?.length) {
        return [];
      }

      if (unshiftList?.length) {
        return [
          ...unshiftList.map(e => ({
            ...e,
            data: (e.data ?? []).map(x => {
              const tmpX =
                x as unknown as TokenItemFromAbstractPortfolioTokenWithExtra;
              const _netWorth = isBridgeTo ? 0 : tmpX.amount * tmpX.price || 0;

              return {
                id: tmpX.id,
                amount: tmpX.amount,
                _logo: tmpX.logo_url,
                _symbol: getTokenSymbol(tmpX),
                _amount: formatAmount(tmpX.amount),
                _price: '$' + formatPrice(tmpX.price),
                _netWorth: _netWorth,
                _netWorthStr: formatNetworth(_netWorth),
                _chain: tmpX.chain,
                // @ts-expect-error
                trade_volume_level: tmpX?.trade_volume_level,
                $origin: x as
                  | TokenItemForRender
                  | (TokenItemFromAbstractPortfolioToken & {
                      group?: string;
                    }),
              };
            }),
          })),
          {
            data: tokens,
          },
        ];
      }

      return [
        {
          data: tokens,
        },
      ];
    }, [isBridgeTo, tokens, unshiftList]);

    const inputNotActiveAndNoQuery = useMemo(() => {
      return !(query || isInputActive);
    }, [query, isInputActive]);

    const { willShowChainFilter, willShowAccountFilter, willShowFilterRow } =
      useMemo(() => {
        const _willShowAccountFilter =
          !!displayAccountFilter &&
          !!filterAccount &&
          !isWatchOrSafeAccount(filterAccount);
        const _willShowChainFilter = !!chainItem && !hideChainFilter;
        const _willShowFavoriteFilter = !!showFavoriteFilter;

        return {
          willShowChainFilter: _willShowChainFilter,
          willShowAccountFilter: _willShowAccountFilter,
          willShowFilterRow:
            _willShowAccountFilter ||
            _willShowChainFilter ||
            _willShowFavoriteFilter,
        };
      }, [
        displayAccountFilter,
        filterAccount,
        chainItem,
        hideChainFilter,
        showFavoriteFilter,
      ]);

    // Used to prevent repeated triggering
    const hasTriggered = useSharedValue(false);

    const onGestureEvent = useAnimatedGestureHandler({
      onStart: () => {
        hasTriggered.value = false;
      },
      onActive: event => {
        if (!onFavoriteFilterChange || hasTriggered.value) {
          return;
        }
        // Set threshold, trigger if exceeded
        const threshold = 50;
        if (Math.abs(event.translationX) > Math.abs(event.translationY)) {
          if (event.translationX > threshold) {
            hasTriggered.value = true;
            runOnJS(onFavoriteFilterChange)?.('all');
          } else if (event.translationX < -threshold) {
            hasTriggered.value = true;
            runOnJS(onFavoriteFilterChange)?.('favorite');
          }
        }
      },
    });

    const { onHardwareBackHandler } = useHandleBackPressClosable(
      useCallback(() => {
        onCancel();
        return !visible;
      }, [onCancel, visible]),
    );

    useFocusEffect(onHardwareBackHandler);

    return (
      <AppBottomSheetModal
        ref={tokenSelectorModalRef}
        snapPoints={snapPoints}
        enableContentPanningGesture
        // enableDismissOnClose={false}
        enableDismissOnClose
        onChange={idx => {
          if (idx < 0) onCancel();
        }}
        {...{
          containerStyle:
            !isInInitialRoute || swapToTokenDetail
              ? {
                  zIndex: hiddenZIndex,
                }
              : {},
          style: {
            overflow: 'hidden',
            borderRadius: 32,
          },
          handleStyle: {
            backgroundColor: isLight
              ? colors2024['neutral-bg-0']
              : colors2024['neutral-bg-1'],
            paddingVertical: 18,
          },
          backgroundStyle: {
            backgroundColor: isLight
              ? colors2024['neutral-bg-0']
              : colors2024['neutral-bg-1'],
          },
        }}
        backdropComponent={renderBackdrop}>
        <AutoLockView
          style={[
            styles.container,
            {
              paddingBottom: androidBottomOffset,
            },
          ]}>
          <View style={[styles.titleArea, styles.internalBlock]}>
            <BottomSheetHandlableView>
              {/* <Text style={[styles.modalTitle, styles.modalMainTitle]}>
                {t('page.swap.select-token')}
              </Text> */}
              {showTestNetSwitch ? (
                <NetSwitchTabs
                  value={selectTab}
                  onTabChange={onTabChange}
                  itemStyle={styles.netSwitchTabsItem}
                  style={styles.netSwitchTabs}
                />
              ) : null}
            </BottomSheetHandlableView>

            <View style={[styles.searchInputContainer, { marginBottom: 8 }]}>
              <NextSearchBar
                onCancel={() => {
                  setQuery('');
                  setTimeout(() => {
                    inputRef.current?.blur();
                  }, 50);
                }}
                inputContainerStyle={{
                  justifyContent: inputNotActiveAndNoQuery
                    ? 'center'
                    : 'flex-start',
                }}
                inputStyle={{
                  flex: inputNotActiveAndNoQuery ? 0 : 1,
                }}
                style={styles.searchInputContainer}
                placeholder={
                  searchPlaceholder ||
                  t('component.TokenSelector.searchPlaceHolder2')
                }
                value={query}
                onChangeText={v => {
                  handleQueryChange(v);
                }}
                placeholderTextColor={colors2024['neutral-secondary']}
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
          </View>

          <View
            style={[
              styles.filterRow,
              styles.internalBlock,
              !willShowFilterRow && { display: 'none' },
            ]}>
            <View style={styles.leftFilters}>
              {showFavoriteFilter && (
                <FavoriteFilterItem
                  value={favoriteFilterValue}
                  onChange={onFavoriteFilterChange || (() => {})}
                />
              )}
            </View>

            <View style={styles.rightFilters}>
              {willShowAccountFilter && (
                <AccountFilterItem
                  filterAccount={filterAccount}
                  onRemoveFilter={account => {
                    if (account && isSameAccount(account, filterAccount)) {
                      onSearch({
                        ...chainSearchCtx,
                        filterAccountItem: null,
                        chainServerId,
                        keyword: query,
                      });
                    }
                  }}
                />
              )}

              {willShowChainFilter && (
                <View style={[styles.chainFiltersContainer]}>
                  <ChainFilterItem
                    chainItem={chainItem}
                    hideChainText
                    onRemoveFilter={() => {
                      onRemoveChainFilter?.({
                        chainServerId,
                        chainItem,
                        filterAccountItem: null,
                      });
                      onSearch({
                        ...chainSearchCtx,
                        chainItem: null,
                        chainServerId: '',
                        keyword: query,
                      });
                    }}
                  />
                </View>
              )}
            </View>
          </View>
          {(!isSwapTo || (query && !tokens.length)) && <>{customHeaderTitle}</>}
          <PanGestureHandler
            onGestureEvent={onGestureEvent}
            activeOffsetX={[-10, 10]}
            failOffsetY={[-5, 5]}>
            <BottomSheetSectionList
              contentInset={{ bottom: 30 }}
              sections={section}
              keyboardShouldPersistTaps="handled"
              style={[styles.scrollView]}
              onScrollBeginDrag={() => Keyboard.dismiss()}
              windowSize={5}
              showsVerticalScrollIndicator={false}
              keyExtractor={token => {
                const $originMaybeToken =
                  token.$origin as TokenItemFromAbstractPortfolioToken & {
                    group?: string;
                  };
                const ownerKey = !$originMaybeToken.ownerAccount
                  ? ''
                  : `${$originMaybeToken.ownerAccount.type}-${$originMaybeToken.ownerAccount.address}`;

                return [
                  ownerKey,
                  `${token.id}-${token._symbol}-${token._chain}-${$originMaybeToken?.group}`,
                ]
                  .filter(Boolean)
                  .join('-');
              }}
              renderSectionHeader={
                isSwapTo
                  ? ({ section: _section }) => {
                      const { header } = _section;
                      return <>{header ? header() : customHeaderTitle}</>;
                    }
                  : undefined
              }
              stickySectionHeadersEnabled={true}
              ListHeaderComponent={ListHeader}
              ListEmptyComponent={
                isLoading ? null : (
                  <NotMatchedHolder
                    style={{
                      height: 400,
                    }}
                    text="No tokens"
                  />
                )
              }
              extraData={isLoading}
              initialNumToRender={20}
              maxToRenderPerBatch={20}
              onEndReachedThreshold={0.3}
              renderItem={renderItemRenderComponent}
            />
          </PanGestureHandler>
        </AutoLockView>
      </AppBottomSheetModal>
    );
  },
);

const getStyle = createGetStyles2024(({ colors2024, isLight }) => {
  return {
    arrow: {
      width: 10,
      height: 8,
    },
    tokenRowUsdValue: {
      textAlign: 'right',
      color: colors2024['neutral-title-1'],
      fontSize: 20,
      lineHeight: 24,
      fontWeight: '500',
      fontFamily: 'SF Pro Rounded',
    },
    tokenRowWrap: {
      height: 68,
      width: '100%',
      paddingHorizontal: 20,
      flexGrow: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    tokenRowTokenWrap: {
      flexShrink: 1,
      flexDirection: 'row',
      maxWidth: '70%',
    },
    tokenRowTokenInner: {
      flexShrink: 1,
      justifyContent: 'center',
    },
    tokenRowUsdValueWrap: {
      flexShrink: 0,
      justifyContent: 'flex-end',
      alignItems: 'flex-end',
    },
    tokenRowTokenInnerSmallToken: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: isLight
        ? colors2024['neutral-bg-1']
        : colors2024['neutral-bg-2'],
      height: 36,
      width: 100,
      justifyContent: 'center',
      borderRadius: 100,
      display: 'flex',
    },
    actionText: {
      fontSize: 16,
      fontWeight: '700',
      fontFamily: 'SF Pro Rounded',
      color: colors2024['neutral-body'],
    },
    container: {
      flex: 1,
    },
    headerBox: {
      // paddingHorizontal: 16,
      // height: 48,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      // backgroundColor: isLight
      //   ? colors2024['neutral-bg-0']
      //   : colors2024['neutral-bg-1'],
      marginHorizontal: 24,
      marginBottom: 16,
    },
    headerBoxText: {
      fontSize: 17,
      fontWeight: '400',
      fontFamily: 'SF Pro Rounded',
      color: colors2024['neutral-secondary'],
    },
    tardeLevel: {
      borderRadius: 900,
      color: colors2024['green-default'],
      backgroundColor: colors2024['green-light-4'],
      paddingHorizontal: 6,
      paddingVertical: 1,
      marginTop: 5,
    },
    tardeLevelText: {
      color: colors2024['green-default'],
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 16,
      fontFamily: 'SF Pro Rounded',
    },
    internalBlock: {
      paddingHorizontal: 16,
    },
    titleArea: {
      justifyContent: 'center',
    },
    modalTitle: {
      color: colors2024['neutral-title-1'],
      fontFamily: 'SF Pro Rounded',
      marginBottom: 12,
      paddingTop: ModalLayouts.titleTopOffset,
    },
    modalMainTitle: {
      fontSize: 20,
      fontWeight: '700',
      lineHeight: 24,
      textAlign: 'center',
      fontFamily: 'SF Pro Rounded',
    },

    searchInputContainer: {
      position: 'relative',
      borderRadius: 12,
      alignItems: 'center',
    },
    filterRowScrollView: {
      height: 34,
      maxHeight: 34,
      minHeight: 34,
      marginTop: 2,
      marginBottom: 4,
      overflow: 'visible',
    },

    filterRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      height: 34,
      width: '100%',
      maxHeight: 34,
      minHeight: 34,
      marginTop: 6,
      marginBottom: 6,
      // ...makeDebugBorder(),
    },
    leftFilters: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    rightFilters: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },

    chainFiltersContainer: {
      flexDirection: 'row',
    },

    scrollView: {
      flexShrink: 1,
      // borderColor: colors2024['neutral-line'],
      // borderWidth: 1,
      // marginHorizontal: 12,
      // borderRadius: 24,
      // paddingHorizontal: 16,
    },
    noTopBorder: {
      borderTopWidth: 0,
      borderTopLeftRadius: 0,
      borderTopRightRadius: 0,
    },
    tokenItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      height: ITEM_HEIGHT,
      // paddingHorizontal: 8,
      paddingRight: 12,
      paddingLeft: 12,
      // marginHorizontal: 12,
      // marginTop: 8,
      backgroundColor: isLight
        ? colors2024['neutral-bg-1']
        : colors2024['neutral-bg-2'],
      borderRadius: 16,
      // // leave here for debug
      // borderWidth: 1,
      // borderColor: 'blue',
    },
    scamHeader: {
      marginHorizontal: 12,
      height: ITEM_HEIGHT,
      marginTop: 8,
      width: 'auto',
    },
    tips: {
      width: 14,
      height: 14,
    },
    tokenItemDisabled: { opacity: 0.5 },
    tokenLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      overflow: 'hidden',
      // ...makeDebugBorder('yellow'),
    },
    tokenLeftLoaded: {
      flexShrink: 1,
      width: '100%',
      flexWrap: 'nowrap',
    },
    tokenRight: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      flexShrink: 0,
    },
    tokenAvatarCol: {
      flexShrink: 0,
    },
    tokenInfoColLeft: {
      width: '100%',
      flexShrink: 1,
      // ...makeDebugBorder('red'),
    },
    tokenInfoCol: {
      flexDirection: 'column',
      alignItems: 'flex-start',
      justifyContent: 'center',
      marginLeft: 12,
    },
    tokenNameBox: {
      flexDirection: 'row',
      alignItems: 'center',
      // ...makeDebugBorder(),
      width: '100%',
      maxWidth: 150,
    },
    tokenNameBoxWithLogos: {
      // ...makeDebugBorder('yellow'),
      maxWidth: Math.max(
        Dimensions.get('window').width -
          16 * 2 /* outer padding  */ -
          40 /* avatar */ -
          12 /* gap */ -
          22 /* favorite */ -
          40 /* right col */ -
          8 /* right col gap */,
        200,
      ),
    },
    tokenName: {
      marginRight: 8,
      color: colors2024['neutral-title-1'],
      fontSize: 16,
      justifyContent: 'center',
      fontWeight: '700',
      lineHeight: 20,
      fontFamily: 'SF Pro Rounded',
    },
    chainLogo: {
      borderWidth: 1.5,
      borderColor: isLight
        ? colors2024['neutral-bg-1']
        : colors2024['neutral-bg-2'],
    },
    tokenPrice: {
      color: colors2024['neutral-secondary'],
      fontSize: 14,
      fontWeight: '500',
      lineHeight: 18,
      fontFamily: 'SF Pro Rounded',
    },
    searchBar: {
      flex: 1,
    },
    tokenInfoColRight: {
      alignItems: 'flex-end',
      textAlign: 'right',
    },
    tokenHeaderAmount: {
      color: colors2024['neutral-secondary'],
      fontSize: 14,
      fontWeight: '500',
      lineHeight: 18,
      textAlign: 'right',
      maxWidth: 100,
      fontFamily: 'SF Pro Rounded',
    },
    textSecondary: {
      color: colors2024['neutral-secondary'],
    },
    isSelected: {
      backgroundColor: colors2024['brand-light-1'],
      marginHorizontal: 12,
      borderRadius: 12,
    },
    tokenHeaderNetworth: {
      color: colors2024['neutral-title-1'],
      fontSize: 16,
      fontWeight: '700',
      lineHeight: 20,
      textAlign: 'right',
      fontFamily: 'SF Pro Rounded',
    },

    searchIconWrapperStyle: {
      paddingLeft: 0,
    },
    inputStyle: {
      fontFamily: 'SF Pro Rounded',
      lineHeight: 22,
      fontSize: 17,
      color: colors2024['neutral-title-1'],
    },
    modalNextButtonText: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 20,
      fontWeight: '700',
      lineHeight: 24,
      textAlign: 'center',
      color: colors2024['neutral-InvertHighlight'],
      backgroundColor: colors2024['brand-default'],
    },
    netSwitchTabs: {
      marginBottom: 16,
      paddingHorizontal: 32,
    },
    netSwitchTabsItem: {
      height: 32,
      borderRadius: 16,
    },
    favoriteBadge: {
      position: 'absolute',
      top: 0,
      right: 0,
      paddingHorizontal: 12,
      paddingVertical: 3,
      backgroundColor: colors2024['orange-light-1'],
      borderBottomLeftRadius: 12,
      borderTopRightRadius: 16,
    },
    absoluteContainer: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 1,
    },
    favorite: {
      marginLeft: 8,
    },
    rightSlot: {
      marginLeft: 8,
    },
  };
});

function LoadingItem() {
  const { styles } = useTheme2024({ getStyle });
  return (
    <View style={[styles.tokenItem, { marginTop: 8, marginHorizontal: 12 }]}>
      <View style={styles.tokenLeft}>
        <Skeleton circle width={36} height={36} />

        <View style={[styles.tokenInfoCol, { marginLeft: 12, gap: 8 }]}>
          <Skeleton width={34} height={20} />

          <Skeleton width={70} height={20} />
        </View>
      </View>
      <View style={[styles.tokenInfoCol, styles.tokenInfoColRight, { gap: 8 }]}>
        <Skeleton width={70} height={18} />
        <Skeleton width={34} height={18} />
      </View>
    </View>
  );
}
