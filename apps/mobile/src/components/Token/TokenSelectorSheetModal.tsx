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
  TextInput,
  Dimensions,
  Alert,
  ListRenderItem,
} from 'react-native';
import {
  BottomSheetBackdropProps,
  BottomSheetFlatList,
  BottomSheetFlatListMethods,
} from '@gorhom/bottom-sheet';
import useDebounce from 'react-use/lib/useDebounce';
import { CHAINS_ENUM, Chain } from '@/constant/chains';
import {
  TokenItem,
  TokenItemWithEntity,
} from '@rabby-wallet/rabby-api/dist/types';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { AppBottomSheetModal } from '../customized/BottomSheet';
import { SheetModalShowType, useSheetModal } from '@/hooks/useSheetModal';
import { createGetStyles2024, makeDevOnlyStyle } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import {
  type DisplayedTokenWithOwner,
  type TokenItemFromAbstractPortfolioToken,
} from '@/utils/token';
import { formatPrice, formatTokenAmount } from '@/utils/number';
import { formatNetworth } from '@/utils/math';
import { AssetAvatar } from '../AssetAvatar';
import {
  findChainByEnum,
  findChainByServerID,
  getTop3Chains,
} from '@/utils/chain';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CompositeScreenProps,
  useFocusEffect,
  useIsFocused,
  useRoute,
} from '@react-navigation/native';
import { Account } from '@/core/services/preference';
import { isSameAccount } from '@/hooks/accountsSwitcher';
import { AccountInfoInTokenRow } from './AccountWidgets';
import { findAccountByPriority, isWatchOrSafeAccount } from '@/utils/account';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  RootStackParamsList,
  TransactionNavigatorParamList,
} from '@/navigation-type';
import { TokenItemContextMenu } from './TokenContextMenu';
import {
  ExternalTokenRow,
  formatPercentage,
} from '@/screens/Home/components/AssetRenderItems';
import NetSwitchTabs from '@/components2024/PillsSwitch/NetSwitchTabs';
import { NextSearchBar } from '@/components2024/SearchBar';
import { FavoriteTag } from '@/components2024/Favorite';
import {
  getLatestNavigationName,
  navigateDeprecated,
} from '@/utils/navigation';
import { isFromBackAtom } from '@/screens/Swap/hooks/atom';
import { useAtom } from 'jotai';
import { useRefState } from '@/hooks/common/useRefState';
import { useHandleBackPressClosable } from '@/hooks/useAppGesture';
import { ExchangeLogos } from '@/screens/Home/components/AssetRenderItems/ExchangeLogos';
import { useCexSupportList } from '@/hooks/useCexSupportList';
import { RcIconWarningCircleCC } from '@/assets2024/icons/common';
import { touchedFeedback } from '@/utils/touch';
import { ITokenItem } from '@/store/tokens';
import { useMyAccounts } from '@/hooks/account';
import LpTokenSwitch from '@/screens/Home/components/LpTokenSwitch';
import LpTokenIcon from '@/screens/Home/components/LpTokenIcon';
import { isLpToken } from '@/utils/lpToken';
import { useDebouncedValue } from '@/hooks/common/delayLikeValue';
import { InnerModalChainInfo } from '@/screens/Send/components/InModalChainInfo';

type SwapRouteProps = CompositeScreenProps<
  NativeStackScreenProps<TransactionNavigatorParamList, 'Swap'>,
  NativeStackScreenProps<RootStackParamsList>
>;

type TokenListItem =
  | {
      type: 'unfold_token';
      data: ITokenItem;
    }
  | {
      type: 'empty-token';
    }
  | {
      type: 'empty-assets';
      data: string;
    };

export const isSwapTokenType = (s?: string) =>
  s && ['swapFrom', 'swapTo'].includes(s);

const hiddenZIndex = -9999;

const ITEM_HEIGHT = 72;

export type ITokenCheck = (token: TokenItem) => {
  disable: boolean;
  simpleReason: string;
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
  list: ITokenItem[];
  foldTokensList?: ITokenItem[];
  scamTokensList?: ITokenItem[];
  isLoading?: boolean;
  onConfirm(item: ITokenItem): void;
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
  showLpTokenSwitch?: boolean;
  isLpTokenEnabled?: boolean;
  onLpTokenChange?: (value: boolean) => void;
}

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
      showTestNetSwitch,
      selectTab,
      onTabChange,
      showFavoriteFilter: _showFavoriteFilter,
      favoriteFilterValue = 'all',
      onFavoriteFilterChange: _onFavoriteFilterChange,
      showLpTokenSwitch: _showLpTokenSwitch,
      isLpTokenEnabled = false,
      onLpTokenChange: _onLpTokenChange,
    },
    ref,
  ) => {
    const { sheetModalRef: tokenSelectorModalRef, toggleShowSheetModal } =
      useSheetModal();
    const listRef = useRef<BottomSheetFlatListMethods>(null);
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

    const { t } = useTranslation();
    const isBridgeTo = type === 'bridgeTo';
    const isSwapTo = type === 'swapTo';
    const isSend = type === 'send';

    const onLpTokenChange = useCallback(
      (value: boolean) => {
        if (value) {
          _onFavoriteFilterChange?.('all');
        }
        _onLpTokenChange?.(value);
        listRef.current?.scrollToOffset({ offset: 0, animated: true });
      },
      [_onLpTokenChange, _onFavoriteFilterChange],
    );
    const onFavoriteFilterChange = useCallback(
      (value: FavoriteFilterType) => {
        if (value === 'favorite') {
          _onLpTokenChange?.(false);
        }
        _onFavoriteFilterChange?.(value);
        listRef.current?.scrollToOffset({ offset: 0, animated: true });
      },
      [_onFavoriteFilterChange, _onLpTokenChange],
    );

    useEffect(() => {
      if (!visible) {
        setIsInputActive(false);
        onLpTokenChange?.(false);
        onFavoriteFilterChange?.('all');
        setQuery('');
      }
    }, [onFavoriteFilterChange, onLpTokenChange, visible]);

    const { bottom } = useSafeAreaInsets();

    const androidBottomOffset = isAndroid ? bottom : 0;

    const { isLight, styles, colors2024 } = useTheme2024({ getStyle });

    const inputRef = useRef<TextInput | null>(null);

    const [query, setQuery] = useState('');
    const debouncedQuery = useDebouncedValue(query, 250); // 跟外面组件用一样的 debounce，不然组件里的 UI 状态先变会导致 UI 闪一下
    const [isInputActive, setIsInputActive] = useState(false);

    const [swapToTokenDetail, setSwapToTokenDetail] = useState(false);
    const route = useRoute<SwapRouteProps['route']>();
    const isFocused = useIsFocused();

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

    useEffect(() => {
      onSearch(isBridgeTo ? query : { ...chainSearchCtx, keyword: query });
    }, [chainSearchCtx, isBridgeTo, onSearch, query]);

    const handleQueryChange = (value: string) => {
      setQuery(value);
    };

    const handleInputFocus = () => {
      setIsInputActive(true);
    };

    const handleInputBlur = () => {
      setIsInputActive(false);
    };

    const dataList = useMemo(() => {
      const items: TokenListItem[] = [];
      list.forEach(token => {
        items.push({ type: 'unfold_token', data: token });
      });

      return items;
    }, [list]);

    const needToTokenMarketInfo = useMemo(() => {
      return !!type && ['swapTo', 'bridgeTo'].includes(type);
    }, [type]);
    const { accounts } = useMyAccounts({ disableAutoFetch: true });

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => {
        return (
          <RefreshAutoLockBottomSheetBackdrop
            {...props}
            style={[
              props.style,
              !isInInitialRoute && {
                zIndex: hiddenZIndex,
              },
            ]}
            onPress={onCancel}
            disappearsOnIndex={-1}
            appearsOnIndex={0}
          />
        );
      },
      [isInInitialRoute, onCancel],
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

    const longPressTriggered = useRef(false);
    const renderItemRenderComponent = useCallback<
      ListRenderItem<TokenListItem[][number]>
    >(
      ({ item }) => {
        if (isLoading) {
          return null;
        }

        switch (item.type) {
          case 'unfold_token': {
            const token = item.data;
            const {
              disable: lightDisable,
              reason: disableReason,
              simpleReason: disableSimpleReason,
            } = disableItemCheck?.(token) || {};

            const sameAddressAccounts = accounts.filter(acct =>
              isSameAddress(acct.address, token.owner_addr),
            );
            const ownerAccount = findAccountByPriority(sameAddressAccounts);
            const ownerKey = !ownerAccount
              ? ''
              : `${ownerAccount.type}-${ownerAccount.address}`;

            const showOwnerAccount = !chainSearchCtx.filterAccountItem;

            const isPined = token.isPin || false;
            const token_key = [
              ownerKey,
              `${token.id}-${token.symbol}-${token.chain}`,
            ]
              .filter(Boolean)
              .join('-');
            const currentChainItem = findChainByServerID(token.chain);
            const disabled =
              !!supportChains?.length &&
              currentChainItem &&
              !supportChains.includes(currentChainItem.enum);

            let percentColor = colors2024['red-default'];
            if (
              !token.price_24h_change ||
              Math.abs(Number(token.price_24h_change)) < 0.00001
            ) {
              percentColor = colors2024['neutral-secondary'];
            }
            if (Number(token.price_24h_change) > 0) {
              percentColor = colors2024['green-default'];
            }
            const cexLogos = token?.cex_ids?.length
              ? token.cex_ids
                  .map(
                    id =>
                      cexList.find(_item => _item.id === id)?.logo_url || '',
                  )
                  .filter(i => !!i) || []
              : (token as TokenItemWithEntity).identity?.cex_list?.map(
                  _item => _item.logo_url,
                ) || [];
            const alertDisabledToken = () => {
              if (disabled) {
                disabledTips && toast.info(disabledTips);
                return true;
              } else if (lightDisable) {
                Alert.alert(
                  t('component.TokenSelector.riskDetected.title'),
                  disableReason,
                  [
                    { text: t('global.cancel'), style: 'cancel' },
                    {
                      text: t(
                        'component.TokenSelector.riskDetected.proceedBtn',
                      ),
                      onPress: () => {
                        onConfirm(token);
                        toggleShowSheetModal('collapse');
                      },
                    },
                  ],
                );
                return true;
              }
            };

            if (debouncedQuery) {
              return (
                <View style={{ marginTop: 8, marginHorizontal: 16 }}>
                  <TokenItemContextMenu
                    token={token}
                    needToTokenMarketInfo={needToTokenMarketInfo}
                    closeBottomSheet={() => {
                      toggleShowSheetModal('destroy');
                    }}
                    type={type}>
                    <TouchableOpacity
                      delayLongPress={200}
                      onLongPress={() => {
                        longPressTriggered.current = true;
                        touchedFeedback();
                      }}
                      onPressOut={() => {
                        longPressTriggered.current = false;
                      }}
                      onPress={() => {
                        if (longPressTriggered.current) {
                          longPressTriggered.current = false;
                          return;
                        }
                        if (alertDisabledToken()) {
                          return true;
                        }
                        onConfirm(token);
                        toggleShowSheetModal('collapse');
                      }}>
                      <ExternalTokenRow
                        decimalPrecision
                        data={token}
                        logoSize={40}
                        touchable={false}
                        style={[
                          (disabled || lightDisable) &&
                            styles.tokenItemDisabled,
                        ]}
                        onPressRightIcon={() => {
                          setTimeout(() => {
                            toggleShowSheetModal('destroy');
                          }, 100);
                          navigateDeprecated(
                            needToTokenMarketInfo
                              ? RootNames.TokenMarketInfo
                              : RootNames.TokenDetail,
                            {
                              token,
                              needUseCacheToken: true,
                              tokenSelectType: type,
                              account: ownerAccount,
                            },
                          );
                        }}
                        afterNode={
                          lightDisable && (
                            <View style={styles.lightDisableBadge}>
                              <RcIconWarningCircleCC
                                width={20}
                                height={20}
                                color={colors2024['red-default']}
                                style={styles.lightDisableIcon}
                              />
                              <Text style={styles.lightDisableText}>
                                {disableSimpleReason ||
                                  t(
                                    'component.TokenSelector.riskDetected.simpleExplanation',
                                  )}
                              </Text>
                            </View>
                          )
                        }
                      />
                      {isPined && <FavoriteTag style={styles.favoriteTag} />}
                    </TouchableOpacity>
                  </TokenItemContextMenu>
                </View>
              );
            }

            return (
              <View style={{ marginTop: 8, marginHorizontal: 16 }}>
                <TokenItemContextMenu
                  token={token}
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
                      touchedFeedback();
                    }}
                    onPressOut={() => {
                      longPressTriggered.current = false;
                    }}
                    onPress={async () => {
                      if (longPressTriggered.current) {
                        longPressTriggered.current = false;
                        return;
                      }

                      if (alertDisabledToken()) {
                        return true;
                      }
                      onConfirm(token);
                      toggleShowSheetModal('collapse');
                    }}
                    style={[
                      styles.tokenItemOuter,
                      // isSwapTo && { paddingRight: 0, paddingVertical: 0 },
                      (disabled || lightDisable) && styles.tokenItemDisabled,
                    ]}>
                    <View style={styles.tokenItem}>
                      <View style={[styles.tokenLeft, styles.tokenLeftLoaded]}>
                        <AssetAvatar
                          logo={token?.logo_url}
                          size={40}
                          chain={token?.chain}
                          chainSize={18}
                          innerChainStyle={styles.avatarLogo}
                          style={styles.tokenAvatarCol}
                        />
                      </View>
                      <View style={styles.tokenCenter}>
                        <View
                          style={[
                            styles.tokenCenterFloor,
                            styles.utilMl,
                            styles.tokenCenterFloor1,
                          ]}>
                          <View
                            style={[
                              styles.tokenInfoCol,
                              styles.tokenInfoColSecondaryGrow,
                            ]}>
                            <View style={styles.tokenNameBox}>
                              <Text
                                style={[
                                  styles.tokenName,
                                  !needToTokenMarketInfo &&
                                    !isLpToken(token) &&
                                    styles.tokenNameFullWidth,
                                ]}
                                ellipsizeMode="tail"
                                numberOfLines={1}>
                                {token?.symbol}
                              </Text>
                              {isLpToken(token) && (
                                <View style={styles.lpTokenIconContainer}>
                                  <LpTokenIcon
                                    protocolId={token.protocol_id || ''}
                                  />
                                </View>
                              )}
                              {needToTokenMarketInfo && (
                                <View style={styles.exchangeLogosContainer}>
                                  <ExchangeLogos logos={cexLogos} />
                                </View>
                              )}
                            </View>
                          </View>
                          <View
                            style={[
                              styles.tokenInfoCol,
                              styles.tokenInfoColPrimaryShrink,
                              styles.utilMl,
                              styles.tokenInfoColRight,
                            ]}>
                            <Text style={[styles.tokenHeaderNetworth]}>
                              {formatNetworth(token.usd_value)}
                            </Text>
                          </View>
                        </View>
                        <View
                          style={[
                            styles.tokenCenterFloor,
                            styles.utilMl,
                            styles.tokenCenterFloor2,
                          ]}>
                          <View
                            style={[
                              styles.tokenInfoCol,
                              styles.tokenInfoColPrimaryShrink,
                            ]}>
                            {showOwnerAccount ? (
                              !ownerAccount ? null : (
                                <AccountInfoInTokenRow
                                  containerStyle={{ marginTop: 2 }}
                                  ownerAccount={ownerAccount}
                                />
                              )
                            ) : (
                              <Text
                                numberOfLines={1}
                                ellipsizeMode="tail"
                                style={[
                                  styles.tokenHeaderAmount,
                                  // isExcludeBalanceShowTips && styles.textSecondary,
                                ]}>
                                {formatTokenAmount(token.amount)} {token.symbol}
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
                                        ? colors2024['orange-light-1']
                                        : colors2024['green-light-1'],
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
                                    : t(
                                        'component.TokenSelector.bridgeTo.high',
                                      )}
                                </Text>
                              </View>
                            )}
                          </View>

                          <View
                            style={[
                              styles.tokenInfoCol,
                              styles.tokenInfoColSecondaryGrow,
                              styles.utilMl,
                              styles.tokenInfoColRight,
                            ]}>
                            <View style={styles.priceInfo}>
                              <Text
                                style={[styles.tokenPrice]}
                                numberOfLines={1}>
                                {`@$${formatPrice(token.price)}`}
                              </Text>
                              <Text
                                style={StyleSheet.compose(styles.percent, {
                                  ...(!token.is_core &&
                                  (token.usd_value || 0) > 0
                                    ? styles.exclude
                                    : {}),
                                  color: percentColor,
                                })}>
                                {formatPercentage(
                                  Number(token.price_24h_change) || 0,
                                )}
                              </Text>
                            </View>
                          </View>
                        </View>
                      </View>
                    </View>
                    {lightDisable && (
                      <View
                        style={[
                          styles.lightDisableBadge,
                          { marginBottom: 12 },
                        ]}>
                        <RcIconWarningCircleCC
                          width={20}
                          height={20}
                          color={colors2024['red-default']}
                          style={styles.lightDisableIcon}
                        />
                        <Text style={styles.lightDisableText}>
                          {disableSimpleReason ||
                            t(
                              'component.TokenSelector.riskDetected.simpleExplanation',
                            )}
                        </Text>
                      </View>
                    )}
                    {isPined && <FavoriteTag style={styles.favoriteTag} />}
                  </TouchableOpacity>
                </TokenItemContextMenu>
              </View>
            );
          }
          default:
            return null;
        }
      },
      [
        isLoading,
        disableItemCheck,
        accounts,
        chainSearchCtx.filterAccountItem,
        supportChains,
        debouncedQuery,
        needToTokenMarketInfo,
        type,
        styles,
        isBridgeTo,
        colors2024,
        t,
        cexList,
        disabledTips,
        onConfirm,
        toggleShowSheetModal,
      ],
    );

    const inputNotActiveAndNoQuery = useMemo(() => {
      return !(query || isInputActive);
    }, [query, isInputActive]);

    const showFavoriteFilter = useMemo(() => {
      if (isInputActive) {
        return false;
      }
      return _showFavoriteFilter;
    }, [_showFavoriteFilter, isInputActive]);

    const showLpTokenSwitch = useMemo(() => {
      if (isInputActive) {
        return false;
      }
      return _showLpTokenSwitch;
    }, [_showLpTokenSwitch, isInputActive]);

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

    const { onHardwareBackHandler } = useHandleBackPressClosable(
      useCallback(() => {
        onCancel();
        return !visible;
      }, [onCancel, visible]),
    );

    const top3Chains = useMemo(() => {
      if (!visible) {
        return [];
      }
      // 只有send场景需要
      if (type === 'send') {
        return getTop3Chains(list);
      }
      return [];
    }, [list, type, visible]);

    useFocusEffect(onHardwareBackHandler);

    return (
      <AppBottomSheetModal
        ref={tokenSelectorModalRef}
        snapPoints={snapPoints}
        enableContentPanningGesture
        // enableDismissOnClose={false}
        enableDismissOnClose
        onChange={idx => {
          if (idx < 0) {
            onCancel();
          }
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
              {isSend && (
                <InnerModalChainInfo
                  account={filterAccount}
                  chainEnum={chainItem?.enum}
                  top3Chains={top3Chains}
                  onChange={chain => {
                    onSearch({
                      ...chainSearchCtx,
                      chainServerId: chain
                        ? findChainByEnum(chain)?.serverId
                        : '',
                      chainItem: chain ? findChainByEnum(chain) : null,
                      keyword: query,
                    });
                  }}
                />
              )}
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
              {showFavoriteFilter && (
                <FavoriteFilterItem
                  value={favoriteFilterValue}
                  onChange={onFavoriteFilterChange || (() => {})}
                />
              )}
            </View>

            <View style={styles.rightFilters}>
              {showLpTokenSwitch && (
                <LpTokenSwitch
                  isEnabled={isLpTokenEnabled}
                  onValueChange={onLpTokenChange}
                />
              )}
            </View>
          </View>
          {(!isSwapTo || (query && !list.length)) && <>{customHeaderTitle}</>}
          <BottomSheetFlatList
            contentInset={{ bottom: 30 }}
            keyboardShouldPersistTaps="handled"
            style={[styles.scrollView]}
            onScrollBeginDrag={() => Keyboard.dismiss()}
            windowSize={5}
            ref={listRef}
            data={dataList}
            showsVerticalScrollIndicator={false}
            keyExtractor={item => {
              if (item.type === 'unfold_token') {
                return `${item.type}-${item.data.owner_addr}-${item.data.chain}-${item.data.id}`;
              }
              if (item.type === 'empty-assets') {
                return `empty-assets-${item.data}`;
              }
              return item.type;
            }}
            ListHeaderComponent={ListHeader}
            ListEmptyComponent={
              isLoading ? null : (
                <NotMatchedHolder
                  style={{
                    height: 400,
                  }}
                  text={
                    isLpTokenEnabled
                      ? t('component.TokenSelector.placeholders.noLpTokens')
                      : t('component.TokenSelector.placeholders.noTokens')
                  }
                />
              )
            }
            extraData={isLoading}
            initialNumToRender={20}
            maxToRenderPerBatch={20}
            onEndReachedThreshold={0.3}
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

    avatarLogo: {
      borderWidth: 1.5,
      borderColor: isLight
        ? colors2024['neutral-bg-1']
        : colors2024['neutral-bg-2'],
    },
    tardeLevel: {
      borderRadius: 900,
      color: colors2024['green-default'],
      backgroundColor: colors2024['green-light-1'],
      paddingHorizontal: 6,
      paddingVertical: 1,
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
      overflow: 'hidden',
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
    tokenItemOuter: {
      flexDirection: 'column',
      backgroundColor: isLight
        ? colors2024['neutral-bg-1']
        : colors2024['neutral-bg-2'],
      paddingRight: 12,
      paddingLeft: 12,
      gap: 12,
      borderRadius: 16,
    },
    tokenItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      height: ITEM_HEIGHT,
      // ...makeDebugBorder(),
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
    tokenItemDisabled: {
      opacity: 0.5,
      ...makeDevOnlyStyle({
        opacity: 0.7,
      }),
    },
    tokenLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      overflow: 'hidden',
      flexShrink: 0,
    },
    tokenLeftLoaded: {
      flexWrap: 'nowrap',
    },
    tokenCenter: {
      flexShrink: 1,
      width: '100%',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    tokenCenterFloor: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    tokenCenterFloor1: {
      // ...makeDebugBorder('green'),
    },
    tokenCenterFloor2: {
      // ...makeDebugBorder('yellow'),
      marginTop: 4,
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
    tokenInfoColSecondaryGrow: {
      width: '100%',
      flexShrink: 1,
      // ...makeDebugBorder('red')
    },
    tokenInfoColPrimaryShrink: {
      flexShrink: 0,
      // ...makeDebugBorder('yellow')
    },
    tokenInfoCol: {
      flexDirection: 'column',
      alignItems: 'flex-start',
      justifyContent: 'center',
    },
    utilMl: {
      marginLeft: 12,
    },
    tokenNameBox: {
      flexDirection: 'row',
      alignItems: 'center',
      overflow: 'hidden',
      // ...makeDebugBorder(),
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
    tokenNameFullWidth: {
      width: '100%',
    },
    lpTokenIconContainer: {
      marginLeft: 0,
      flexShrink: 0,
      justifyContent: 'flex-start',
    },
    exchangeLogosContainer: {
      maxWidth: '100%',
      flexShrink: 1,
    },
    tokenPrice: {
      color: colors2024['neutral-secondary'],
      fontSize: 14,
      fontWeight: '500',
      lineHeight: 18,
      fontFamily: 'SF Pro Rounded',
    },
    exclude: {
      color: colors2024['neutral-info'],
    },
    percent: {
      textAlign: 'right',
      fontSize: 14,
      fontWeight: '700',
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
    priceInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    tokenHeaderAmount: {
      color: colors2024['neutral-secondary'],
      fontSize: 14,
      fontWeight: '500',
      lineHeight: 18,
      textAlign: 'right',
      width: '100%',
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
    lightDisableBadge: {
      backgroundColor: colors2024['red-light-1'],
      paddingHorizontal: 16,
      paddingVertical: 4,
      borderRadius: 0,
      width: '100%',
      marginTop: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      flex: 1,
      minHeight: 32,
      marginBottom: 0,
    },
    favoriteTag: {
      position: 'absolute',
      right: 0,
      top: 0,
    },
    lightDisableIcon: {},
    lightDisableText: {
      color: colors2024['red-default'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 14,
      fontStyle: 'normal',
      fontWeight: 400,
      lineHeight: 18,
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
