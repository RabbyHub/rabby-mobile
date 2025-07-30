/* eslint-disable react-native/no-inline-styles */
import React, {
  useMemo,
  useEffect,
  useCallback,
  useState,
  useRef,
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
import { useSheetModal } from '@/hooks/useSheetModal';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import {
  DisplayedTokenWithOwner,
  getTokenSymbol,
  TokenItemFromAbstractPortfolioToken,
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
}
const filterTestnetTokenItem = (token: TokenItem) => {
  return !findChainByServerID(token.chain)?.isTestnet;
};

const isAndroid = Platform.OS === 'android';

type TokenSelectorInst = {};
export const TokenSelectorSheetModal = React.forwardRef<
  TokenSelectorInst,
  RNViewProps & TokenSelectorProps
>(
  (
    {
      visible,
      list,
      foldTokensList = [],
      selectToken,
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
    },
    ref,
  ) => {
    const { sheetModalRef: tokenSelectorModal, toggleShowSheetModal } =
      useSheetModal();

    const [fold, setFold] = useState(true);
    const [isScamFold, setIsScamFold] = useState(true);

    const { t } = useTranslation();
    const isBridgeTo = type === 'bridgeTo';
    const isSwapTo = type === 'swapTo';
    const isSend = type === 'send';

    useEffect(() => {
      toggleShowSheetModal(visible ? true : false);
      if (!visible) {
        setIsInputActive(false);
        setFold(true);
        setIsScamFold(true);
      }
    }, [visible, toggleShowSheetModal]);

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
    const { userTokenSettings } = useUserTokenSettings();

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

    useEffect(() => {
      if (!visible) {
        setQuery('');
      }
    }, [visible]);

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
          const chainItem = findChainByServerID(token.chain);
          const disabled =
            !!supportChains?.length &&
            chainItem &&
            !supportChains.includes(chainItem.enum);

          if (!disabled) {
            accu.natural.push(token);
          } else if (chainItem?.isTestnet && !chainServerId) {
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
        const _netWorth = isBridgeTo ? 0 : x.amount * x.price || 0;
        return {
          id: x.id,
          amount: x.amount,
          _logo: x.logo_url,
          _symbol: getTokenSymbol(x),
          _amount: formatAmount(x.amount),
          _price: '$' + formatPrice(x.price),
          _netWorth: _netWorth,
          _netWorthStr: formatNetworth(_netWorth),
          _chain: x.chain,
          // @ts-expect-error
          trade_volume_level: x?.trade_volume_level,
          /**
           * @description in fact, it's impossible to be TokenItemFromAbstractPortfolioToken, it's always TokenItemForRender!
           * Just left here to keep the type consistent for old code
           */
          $origin: x as
            | TokenItemForRender
            | TokenItemFromAbstractPortfolioTokenWithExtra,
        };
      });

      return isFromModalType
        ? formatList
        : formatList.sort((m, n) => n._netWorth - m._netWorth);
    }, [
      foldTokensList,
      displayList,
      fold,
      isScamFold,
      isFromModalType,
      isBridgeTo,
    ]);

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => {
        return (
          <RefreshAutoLockBottomSheetBackdrop
            {...props}
            style={[
              props.style,
              swapToTokenDetail && {
                zIndex: hiddenZIndex,
              },
            ]}
            onPress={onCancel}
            disappearsOnIndex={-1}
            appearsOnIndex={0}
          />
        );
      },
      [onCancel, swapToTokenDetail],
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

    const renderItemRenderComponent = useCallback<
      SectionListRenderItem<(typeof tokens)[number]>
    >(
      ({ item: token, index }) => {
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
        const $originMaybeRender = token.$origin as TokenItemForRender;

        const { disable: lightDisable } =
          disableItemCheck?.($originMaybeToken) || {};

        const ownerAccount =
          'ownerAccount' in token.$origin ? token.$origin.ownerAccount : null;
        const ownerKey = !ownerAccount
          ? ''
          : `${ownerAccount.type}-${ownerAccount.address}`;

        const showOwnerAccount = !chainSearchCtx.filterAccountItem;

        if (
          $originMaybeRender.recentList?.length &&
          $originMaybeRender.TokenRender
        ) {
          const TokenRender = $originMaybeRender.TokenRender;
          return (
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 12,
                paddingHorizontal: 8,
                marginHorizontal: 12,
                marginBottom: 16,
              }}>
              {$originMaybeRender.recentList?.map(tokenItem => (
                <TouchableOpacity
                  key={tokenItem.id}
                  onPress={() => {
                    onConfirm(tokenItem);
                    toggleShowSheetModal('collapse');
                  }}>
                  <TokenRender token={tokenItem} ownerAccount={ownerAccount} />
                </TouchableOpacity>
              ))}
            </View>
          );
        }

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

        if (
          isSwapTo ||
          (query && (type === 'bridgeFrom' || type === 'swapFrom'))
        ) {
          return (
            <View style={{ marginTop: 8, marginHorizontal: 12 }}>
              <TokenItemContextMenu
                token={$originMaybeToken}
                closeBottomSheet={() => {
                  toggleShowSheetModal('destroy');
                }}
                type={type}>
                <TouchableOpacity
                  delayLongPress={200}
                  onLongPress={() => {
                    console.log('prevent trigger onPress');
                  }}
                  onPress={() => {
                    if (disabled) {
                      disabledTips && toast.info(disabledTips);
                      return;
                    }
                    onConfirm($originMaybeToken);
                    toggleShowSheetModal('collapse');
                  }}>
                  <ExternalTokenRow
                    decimalPrecision
                    isPined={isPined}
                    data={token.$origin as TokenRowDataType}
                    logoSize={40}
                    touchable={false}
                  />
                </TouchableOpacity>
              </TokenItemContextMenu>
            </View>
          );
        }

        return (
          <View style={{ marginTop: 8, marginHorizontal: 12 }}>
            <TokenItemContextMenu
              token={token.$origin as any}
              closeBottomSheet={() => {
                toggleShowSheetModal('destroy');
              }}
              type={type}>
              <TouchableOpacity
                key={token_key}
                delayLongPress={200}
                onLongPress={() => {
                  console.log('prevent trigger onPress');
                }}
                onPress={() => {
                  if (disabled) {
                    disabledTips && toast.info(disabledTips);
                    return;
                  }
                  onConfirm($originMaybeToken);
                  toggleShowSheetModal('collapse');
                }}
                style={[
                  styles.tokenItem,
                  isSwapTo && { paddingRight: 0, paddingVertical: 0 },
                  (disabled || lightDisable) && styles.tokenItemDisabled,
                ]}>
                <View style={styles.tokenLeft}>
                  <AssetAvatar
                    logo={token?._logo}
                    size={40}
                    chain={token?._chain}
                    chainSize={16}
                  />
                  <View style={[styles.tokenInfoCol, { marginLeft: 12 }]}>
                    <View style={styles.tokenNameBox}>
                      <Text style={styles.tokenName} numberOfLines={1}>
                        {ellipsisOverflowedText(token?._symbol, 15)}
                      </Text>
                      {isManualFold && <TextBadge type="folded" />}
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
                  </View>
                </View>
                {isBridgeTo ? (
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
                      {token.trade_volume_level}
                    </Text>
                  </View>
                ) : (
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'center',
                      alignItems: 'center',
                      paddingRight: 16,
                    }}>
                    <View
                      style={[styles.tokenInfoCol, styles.tokenInfoColRight]}>
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
                        {token._amount}
                      </Text>
                    </View>
                  </View>
                )}
                {isPined && (
                  <View style={[styles.favoriteBadge]}>
                    <RcIconFavorite color={colors2024['orange-default']} />
                  </View>
                )}
              </TouchableOpacity>
            </TokenItemContextMenu>
          </View>
        );
      },
      [
        query,
        isLoading,
        disableItemCheck,
        chainSearchCtx.filterAccountItem,
        userTokenSettings.pinedQueue,
        supportChains,
        isFromModalType,
        isSwapTo,
        type,
        styles.tokenItem,
        styles.tokenItemDisabled,
        styles.tokenLeft,
        styles.tokenInfoCol,
        styles.tokenNameBox,
        styles.tokenName,
        styles.tokenPrice,
        styles.tokenInfoColRight,
        styles.tardeLevel,
        styles.tardeLevelText,
        styles.tokenHeaderNetworth,
        styles.tips,
        styles.tokenHeaderAmount,
        styles.textSecondary,
        styles.favoriteBadge,
        styles.scamHeader,
        styles.tokenRowWrap,
        styles.tokenRowTokenWrap,
        styles.tokenRowTokenInner,
        styles.tokenRowTokenInnerSmallToken,
        styles.actionText,
        styles.arrow,
        styles.tokenRowUsdValueWrap,
        styles.tokenRowUsdValue,
        isBridgeTo,
        colors2024,
        handleShowExcludeTips,
        onConfirm,
        toggleShowSheetModal,
        onPressToken,
        fold,
        disabledTips,
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
                  | (TokenItemFromAbstractPortfolioToken & { group?: string }),
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

    return (
      <AppBottomSheetModal
        ref={tokenSelectorModal}
        snapPoints={[ModalLayouts.defaultHeightPercentText]}
        enableContentPanningGesture
        enableDismissOnClose
        onChange={idx => {
          if (idx < 0) {
            onCancel();
          }
        }}
        {...{
          containerStyle: swapToTokenDetail
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
              <Text style={[styles.modalTitle, styles.modalMainTitle]}>
                {t('page.swap.select-token')}
              </Text>
              {showTestNetSwitch ? (
                <NetSwitchTabs
                  value={selectTab}
                  onTabChange={onTabChange}
                  itemStyle={styles.netSwitchTabsItem}
                  style={styles.netSwitchTabs}
                />
              ) : null}
            </BottomSheetHandlableView>

            <View style={styles.searchInputContainer}>
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

            {/* TODO: chain selector */}
            {willShowChainFilter && (
              <View style={[styles.chainFiltersContainer]}>
                <ChainFilterItem
                  chainItem={chainItem}
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

            {showFavoriteFilter && (
              <FavoriteFilterItem
                value={favoriteFilterValue}
                onChange={onFavoriteFilterChange || (() => {})}
              />
            )}
          </View>
          {(!isSwapTo || (query && !tokens.length)) && <>{customHeaderTitle}</>}
          <BottomSheetSectionList
            contentInset={{ bottom: 30 }}
            sections={section}
            keyboardShouldPersistTaps="handled"
            style={[styles.scrollView]}
            onScrollBeginDrag={() => Keyboard.dismiss()}
            windowSize={5}
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
                ? ({ section }) => {
                    const { header } = section;
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
            renderItem={renderItemRenderComponent}
          />
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
      paddingHorizontal: 12,
      paddingVertical: 4,
    },
    tardeLevelText: {
      color: colors2024['green-default'],
      fontSize: 14,
      fontWeight: '700',
      lineHeight: 18,
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
      // paddingHorizontal: 12,
      // borderColor: 'transparent',
      alignItems: 'center',
      marginBottom: 8,
    },

    filterRow: {
      flexDirection: 'row',
      justifyContent: 'flex-start',
      alignItems: 'center',
      gap: 8,
      maxHeight: 34,
      marginTop: 2,
      marginBottom: 4,
      // ...makeDebugBorder(),
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
      paddingRight: 16,
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
    tokenPrice: {
      color: colors2024['neutral-foot'],
      fontSize: 14,
      fontWeight: '400',
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
      color: colors2024['neutral-foot'],
      fontSize: 14,
      fontWeight: '400',
      lineHeight: 18,
      textAlign: 'right',
      maxWidth: 200,
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
