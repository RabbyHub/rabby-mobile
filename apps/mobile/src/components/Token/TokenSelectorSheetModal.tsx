/* eslint-disable react-native/no-inline-styles */
import React, { useMemo, useEffect, useCallback, useState } from 'react';
import {
  View,
  Text,
  Keyboard,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Pressable,
} from 'react-native';
import {
  BottomSheetBackdropProps,
  BottomSheetSectionList,
} from '@gorhom/bottom-sheet';
import RcTipCC from '@/assets2024/icons/common/tips.svg';
import RcFoldCC from '@/assets2024/icons/common/fold.svg';
import RcUnFoldCC from '@/assets2024/icons/common/unfold.svg';
import RcIconChecked from '@/assets/icons/select-chain/icon-checked.svg';
import useDebounce from 'react-use/lib/useDebounce';
import { CHAINS_ENUM, Chain } from '@/constant/chains';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { AppBottomSheetModal } from '../customized/BottomSheet';
import { useSheetModal } from '@/hooks/useSheetModal';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { SearchInput } from '../Form/SearchInput';
import { getTokenSymbol } from '@/utils/token';
import { formatAmount, formatPrice } from '@/utils/number';
import { formatNetworth } from '@/utils/math';
import { AssetAvatar } from '../AssetAvatar';
import { findChainByServerID } from '@/utils/chain';
import ChainFilterItem from './ChainFilterItem';
import { BottomSheetHandlableView } from '../customized/BottomSheetHandle';
import { toast } from '../Toast';
import { ModalLayouts, RootNames } from '@/constant/layout';
import { Skeleton } from '@rneui/themed';
import { NotMatchedHolder } from '@/screens/Approvals/components/Layout';
import AutoLockView from '../AutoLockView';
import { RefreshAutoLockBottomSheetBackdrop } from '../patches/refreshAutoLockUI';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils';
import SearchSVG from '@/assets2024/icons/common/search-cc.svg';
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
import RcIconTipCC from '@/assets2024/icons/common/tips-cc.svg';
import { ensureAbstractPortfolioToken } from '@/screens/Home/utils/token';
import { naviPush } from '@/utils/navigation';
import { useIsFocused, useRoute } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';

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

interface SearchCallbackCtx {
  chainServerId?: Chain['serverId'] | null;
  chainItem: Chain | null;
}
export interface TokenSelectorProps {
  visible: boolean;
  list: TokenItem[];
  foldTokensList?: TokenItem[];
  isLoading?: boolean;
  onConfirm(item: TokenItem): void;
  onCancel(): void;
  onSearch: (
    ctx:
      | (SearchCallbackCtx & {
          keyword: string;
        })
      | string,
  ) => void;
  onRemoveChainFilter?: (ctx: SearchCallbackCtx) => void;
  type?: 'send' | 'swapFrom' | 'swapTo' | 'bridgeFrom' | 'bridgeTo';
  placeholder?: string;
  chainServerId?: string;
  disabledTips?: string;
  supportChains?: CHAINS_ENUM[] | undefined;
  hideChainFilter?: boolean;
  headerTitle?: React.ReactNode;
  selectToken?: TokenItem & { tokenId?: string };
  searchPlaceholder?: string;
  unshiftList?: { data: TokenItem[]; header?: () => React.ReactNode }[];
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
      unshiftList,
    },
    ref,
  ) => {
    const { sheetModalRef: tokenSelectorModal, toggleShowSheetModal } =
      useSheetModal();

    const [fold, setFold] = useState(true);

    const { t } = useTranslation();
    const isBridgeTo = type === 'bridgeTo';
    const isSwapTo = type === 'swapTo';

    useEffect(() => {
      toggleShowSheetModal(visible ? true : false);
      if (!visible) {
        setIsInputActive(false);
        setFold(true);
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

    const [query, setQuery] = useState('');
    const [isInputActive, setIsInputActive] = useState(false);

    const [swapToTokenDetail, setSwapToTokenDetail] = useState(false);
    const route = useRoute();
    const isFocused = useIsFocused();

    const isSingleAddress = useMemo(
      () => route.name === RootNames.Swap,
      [route.name],
    );

    if (
      isSwapTo &&
      swapToTokenDetail &&
      visible &&
      isFocused &&
      ([RootNames.Swap, RootNames.MultiSwap] as string[]).includes(route.name)
    ) {
      setSwapToTokenDetail(false);
    }

    const { chainItem, chainSearchCtx } = useMemo(() => {
      const chain = !chainServerId ? null : findChainByServerID(chainServerId);
      return {
        chainItem: chain,
        chainSearchCtx: {
          chainServerId: chainServerId ?? null,
          chainItem: chain,
        },
      };
    }, [chainServerId]);

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

    const DefaultHeaderTitle = useMemo(() => {
      return (
        <View style={styles.headerBox}>
          <Text style={styles.headerBoxText}>{t('page.bridge.token')}</Text>
          <Text style={styles.headerBoxText}>{t('page.bridge.value')}</Text>
        </View>
      );
    }, [styles, t]);

    const displayList = useMemo(() => {
      if (isBridgeTo) {
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
          natural: [] as TokenItem[],
          disabled: [] as TokenItem[],
          ignored: [] as TokenItem[],
        },
      );

      return [...varied.natural, ...varied.disabled];
    }, [isBridgeTo, supportChains, list, chainServerId]);

    const isFromModalType = useMemo(
      () =>
        type === 'swapFrom' ||
        type === 'swapTo' ||
        type === 'bridgeFrom' ||
        type === 'send',
      [type],
    );

    const tokens = useMemo(() => {
      const allList = [
        ...(displayList || []),
        ...(foldTokensList?.slice(0, fold ? 1 : undefined) || []),
      ];

      const formatList = (allList ?? []).map(x => {
        const _netWorth = isBridgeTo ? 0 : x.amount * x.price || 0;

        return {
          id: x.id,
          amount: x.amount,
          _logo: x.logo_url,
          _symbol: getTokenSymbol(x),
          _amount: formatAmount(x.amount),
          _price: formatPrice(x.price),
          _netWorth: _netWorth,
          _netWorthStr: formatNetworth(_netWorth),
          _chain: x.chain,
          trade_volume_level: x?.trade_volume_level,
          $origin: x,
        };
      });

      return isFromModalType
        ? formatList
        : formatList.sort((m, n) => n._netWorth - m._netWorth);
    }, [displayList, isBridgeTo, foldTokensList, fold, isFromModalType]);

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
      return setFold(pre => !pre);
    }, [setFold]);

    const renderItemRenderComponent = useCallback(
      ({ item: token }) => {
        if (isLoading) {
          return null;
        }

        if (token.$origin.recentList?.length && token.$origin.TokenRender) {
          const TokenRender = token.$origin.TokenRender;
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
              {token.$origin.recentList?.map(tokenItem => (
                <TouchableOpacity
                  key={tokenItem.id}
                  onPress={() => {
                    onConfirm(tokenItem);
                    toggleShowSheetModal('collapse');
                  }}>
                  <TokenRender token={tokenItem} />
                </TouchableOpacity>
              ))}
            </View>
          );
        }

        const isPined = token?.$origin.isPined;
        const isManualFold = token?.$origin.isManualFold;
        const isSelected = selectToken && selectToken.tokenId === token.id;
        const token_key = `${token.$origin.id}-${token._symbol}-${token._chain}`;
        const currentChainItem = findChainByServerID(token._chain);
        const disabled =
          !!supportChains?.length &&
          currentChainItem &&
          !supportChains.includes(currentChainItem.enum);

        const isExcludeBalanceShowTips =
          token.$origin.isExcludeBalance &&
          isFromModalType &&
          (token._netWorth || 0) > 0;

        if (token.$origin.isFakerFoldRow) {
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
                  {token.$origin.smallTokenAllUsdValue}
                </Text>
              </View>
            </View>
          );
        }

        return (
          <TouchableOpacity
            key={token_key}
            onPress={() => {
              if (disabled) {
                disabledTips && toast.info(disabledTips);
                return;
              }
              onConfirm(token.$origin);
              toggleShowSheetModal('collapse');
            }}
            style={[
              styles.tokenItem,
              isSwapTo && { paddingRight: 0, paddingVertical: 0 },
              disabled && styles.tokenItemDisabled,
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
                  {isPined && <TextBadge />}
                  {isManualFold && <TextBadge type="folded" />}
                </View>
                <Text
                  style={[styles.tokenPrice, { marginTop: 4 }]}
                  numberOfLines={1}>
                  {token._price}
                </Text>
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
                }}>
                <View style={[styles.tokenInfoCol, styles.tokenInfoColRight]}>
                  <Text
                    style={[
                      styles.tokenHeaderAmount,
                      isExcludeBalanceShowTips && styles.textSecondary,
                    ]}>
                    {token._amount}
                  </Text>
                  <Text style={[styles.tokenHeaderNetworth, { marginTop: 4 }]}>
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
                </View>
                {isSwapTo ? (
                  <Pressable
                    style={{
                      padding: 16,
                      paddingLeft: 12,
                      height: '100%',
                    }}
                    onPress={() => {
                      setSwapToTokenDetail(true);
                      naviPush(RootNames.TokenDetail, {
                        token: ensureAbstractPortfolioToken(token.$origin),
                        needUseCacheToken: true,
                        isSingleAddress,
                      });
                    }}>
                    <RcIconTipCC
                      width={20}
                      height={20}
                      color={colors2024['neutral-secondary']}
                    />
                  </Pressable>
                ) : null}
              </View>
            )}
          </TouchableOpacity>
        );
      },
      [
        isLoading,
        selectToken,
        supportChains,
        isFromModalType,
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
        styles.tokenHeaderAmount,
        styles.textSecondary,
        styles.tokenHeaderNetworth,
        styles.tips,
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
        isSwapTo,
        onConfirm,
        toggleShowSheetModal,
        onPressToken,
        fold,
        disabledTips,
        isSingleAddress,
      ],
    );

    const section = useMemo(() => {
      if (unshiftList) {
        return [
          ...unshiftList.map(e => ({
            ...e,
            data: (e.data ?? []).map(x => {
              const _netWorth = isBridgeTo ? 0 : x.amount * x.price || 0;

              return {
                id: x.id,
                amount: x.amount,
                _logo: x.logo_url,
                _symbol: getTokenSymbol(x),
                _amount: formatAmount(x.amount),
                _price: formatPrice(x.price),
                _netWorth: _netWorth,
                _netWorthStr: formatNetworth(_netWorth),
                _chain: x.chain,
                trade_volume_level: x?.trade_volume_level,
                $origin: x,
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

    return (
      <AppBottomSheetModal
        ref={tokenSelectorModal}
        snapPoints={[ModalLayouts.defaultHeightPercentText]}
        enableContentPanningGesture={false}
        enableDismissOnClose={true}
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
            backgroundColor: colors2024['neutral-bg-1'],
            paddingVertical: 18,
          },
          backgroundStyle: {
            backgroundColor: isLight
              ? colors2024['neutral-bg-0']
              : colors2024['neutral-bg-1'],
          },
        }}
        backdropComponent={renderBackdrop}>
        <LinearGradient
          start={{ x: 0.5, y: 0.64 }}
          end={{ x: 0.5, y: 1 }}
          colors={
            isLight
              ? [colors2024['neutral-bg-1'], colors2024['neutral-bg-0']]
              : [colors2024['neutral-bg-1'], colors2024['neutral-bg-1']]
          }
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: 120,
          }}
        />
        <AutoLockView
          as="BottomSheetView"
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
            </BottomSheetHandlableView>

            <SearchInput
              isActive={isInputActive}
              containerStyle={styles.searchInputContainer}
              searchIconWrapperStyle={styles.searchIconWrapperStyle}
              inputStyle={styles.inputStyle}
              searchIcon={<SearchSVG color={colors2024['neutral-foot']} />}
              inputProps={{
                value: query,
                onChange: e => handleQueryChange(e.nativeEvent.text),
                onFocus: handleInputFocus,
                onBlur: handleInputBlur,
                placeholder:
                  searchPlaceholder ||
                  t('component.TokenSelector.searchPlaceHolder2'),
                placeholderTextColor: colors2024['neutral-info'],
              }}
            />
          </View>

          {/* TODO: chain selector */}
          {chainItem && !hideChainFilter && (
            <View style={[styles.chainFiltersContainer, styles.internalBlock]}>
              <ChainFilterItem
                chainItem={chainItem}
                onRmove={() => {
                  onRemoveChainFilter?.({ chainServerId, chainItem });
                  onSearch({
                    chainItem: null,
                    chainServerId: '',
                    keyword: query,
                  });
                }}
              />
            </View>
          )}
          {!isSwapTo && <>{customHeaderTitle || DefaultHeaderTitle}</>}
          <BottomSheetSectionList
            contentInset={{ bottom: 30 }}
            sections={section}
            keyboardShouldPersistTaps="handled"
            style={[styles.scrollView]}
            onScrollBeginDrag={() => Keyboard.dismiss()}
            windowSize={5}
            keyExtractor={token =>
              `${token.id}-${token._symbol}-${token._chain}-${
                (token.$origin as any)?.group
              }`
            }
            renderSectionHeader={
              isSwapTo
                ? ({ section }) => {
                    const { header } = section;
                    return (
                      <>
                        {header
                          ? header()
                          : customHeaderTitle || DefaultHeaderTitle}
                      </>
                    );
                  }
                : undefined
            }
            stickySectionHeadersEnabled={true}
            ListHeaderComponent={ListHeader}
            ListEmptyComponent={
              <NotMatchedHolder
                style={{
                  height: 400,
                }}
                text="No tokens"
              />
            }
            extraData={isLoading}
            getItemLayout={(_, index) => ({
              length: ITEM_HEIGHT,
              offset: ITEM_HEIGHT * index,
              index,
            })}
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
      backgroundColor: colors2024['neutral-bg-2'],
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
      paddingHorizontal: 24,
    },
    titleArea: {
      justifyContent: 'center',
    },
    modalTitle: {
      color: colors2024['neutral-title-1'],
      fontFamily: 'SF Pro Rounded',
      marginBottom: 24,
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
      borderRadius: 30,
      backgroundColor: colors2024['neutral-bg-2'],
      paddingHorizontal: 12,
      borderColor: 'transparent',
      alignItems: 'center',
      marginBottom: 16,
    },

    chainFiltersContainer: {
      flexDirection: 'row',
      marginBottom: 16,
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
      paddingHorizontal: 8,
      paddingRight: 16,
      marginHorizontal: 12,
      marginTop: 8,
      backgroundColor: isLight
        ? colors2024['neutral-bg-1']
        : colors2024['neutral-bg-2'],
      borderRadius: 16,
      // // leave here for debug
      // borderWidth: 1,
      // borderColor: 'blue',
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
    tokenInfoColRight: {
      alignItems: 'flex-end',
      textAlign: 'right',
    },
    tokenHeaderAmount: {
      color: colors2024['neutral-title-1'],
      fontSize: 16,
      fontWeight: '700',
      lineHeight: 20,
      textAlign: 'right',
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
      color: colors2024['neutral-foot'],
      fontSize: 14,
      fontWeight: '400',
      lineHeight: 18,
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
  };
});

function LoadingItem() {
  const { styles } = useTheme2024({ getStyle });
  return (
    <View style={[styles.tokenItem]}>
      <View style={styles.tokenLeft}>
        <Skeleton circle width={36} height={36} />

        <View style={[styles.tokenInfoCol, { marginLeft: 12, gap: 8 }]}>
          <Skeleton width={34} height={20} />

          <Skeleton width={70} height={20} />
        </View>
      </View>
      <View style={[styles.tokenInfoCol, styles.tokenInfoColRight, { gap: 8 }]}>
        <Skeleton width={34} height={18} />
        <Skeleton width={70} height={18} />
      </View>
    </View>
  );
}
