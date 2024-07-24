import React, { useMemo, useEffect, useCallback, useState } from 'react';
import { View, Text } from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetFlatList,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import useDebounce from 'react-use/lib/useDebounce';
import { CHAINS_ENUM, Chain } from '@/constant/chains';

import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { AppBottomSheetModal } from '../customized/BottomSheet';
import { useSheetModal } from '@/hooks/useSheetModal';
import { createGetStyles } from '@/utils/styles';
import { useThemeColors } from '@/hooks/theme';
import { SearchInput } from '../Form/SearchInput';
import { getTokenSymbol } from '@/utils/token';
import { formatAmount, formatUsdValue } from '@/utils/number';
import { formatNetworth } from '@/utils/math';
import { AssetAvatar } from '../AssetAvatar';
import TouchableView from '../Touchable/TouchableView';
import { findChainByServerID } from '@/utils/chain';

import ChainFilterItem from './ChainFilterItem';
import { BottomSheetHandlableView } from '../customized/BottomSheetHandle';
import { toast } from '../Toast';
import { ModalLayouts } from '@/constant/layout';
import { Skeleton } from '@rneui/themed';
import { NotMatchedHolder } from '@/screens/Approvals/components/Layout';

export const isSwapTokenType = (s?: string) =>
  s && ['swapFrom', 'swapTo'].includes(s);

const ITEM_HEIGHT = 68;

interface SearchCallbackCtx {
  chainServerId?: Chain['serverId'] | null;
  chainItem: Chain | null;
}
export interface TokenSelectorProps {
  visible: boolean;
  list: TokenItem[];
  isLoading?: boolean;
  onConfirm(item: TokenItem): void;
  onCancel(): void;
  onSearch: (
    ctx: SearchCallbackCtx & {
      keyword: string;
    },
  ) => void;
  onRemoveChainFilter?: (ctx: SearchCallbackCtx) => void;
  type?: 'default' | 'swapFrom' | 'swapTo';
  placeholder?: string;
  chainServerId?: string;
  disabledTips?: string;
  supportChains?: CHAINS_ENUM[] | undefined;
}
const filterTestnetTokenItem = (token: TokenItem) => {
  return !findChainByServerID(token.chain)?.isTestnet;
};

type TokenSelectorInst = {};
export const TokenSelectorSheetModal = React.forwardRef<
  TokenSelectorInst,
  RNViewProps & TokenSelectorProps
>(
  (
    {
      visible,
      list,
      chainServerId,
      onConfirm,
      onCancel,
      onRemoveChainFilter,
      onSearch,
      supportChains,
      disabledTips,
      isLoading,
    },
    ref,
  ) => {
    const { sheetModalRef: tokenSelectorModal, toggleShowSheetModal } =
      useSheetModal();

    useEffect(() => {
      toggleShowSheetModal(visible ? true : false);
      if (!visible) {
        setIsInputActive(false);
      }
    }, [visible, toggleShowSheetModal]);

    const colors = useThemeColors();
    const styles = useMemo(() => getStyles(colors), [colors]);

    const [query, setQuery] = useState('');
    const [isInputActive, setIsInputActive] = useState(false);

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
        onSearch({ ...chainSearchCtx, keyword: query });
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
      if (!visible) setQuery('');
    }, [visible]);

    const displayList = useMemo(() => {
      if (!supportChains?.length) {
        const resultList = list || [];
        if (!chainServerId) return resultList.filter(filterTestnetTokenItem);

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
    }, [list, supportChains, chainServerId]);

    const tokens = useMemo(() => {
      return (displayList ?? [])
        .map(x => {
          const _netWorth = x.amount * x.price || 0;

          return {
            id: x.id,
            amount: x.amount,
            _logo: x.logo_url,
            _symbol: getTokenSymbol(x),
            _amount: formatAmount(x.amount),
            _price: formatUsdValue(x.price),
            _netWorth: _netWorth,
            _netWorthStr: formatNetworth(_netWorth),
            _chain: x.chain,
            $origin: x,
          };
        })
        .sort((m, n) => n._netWorth - m._netWorth);
    }, [displayList]);

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => {
        return (
          <BottomSheetBackdrop
            {...props}
            onPress={onCancel}
            disappearsOnIndex={-1}
            appearsOnIndex={0}
          />
        );
      },
      [onCancel],
    );

    return (
      <AppBottomSheetModal
        ref={tokenSelectorModal}
        snapPoints={[ModalLayouts.defaultHeightPercentText]}
        enableContentPanningGesture={false}
        backgroundStyle={styles.sheet}
        enableDismissOnClose={true}
        onChange={idx => {
          if (idx < 0) {
            onCancel();
          }
        }}
        bottomInset={1}
        backdropComponent={renderBackdrop}>
        <BottomSheetView style={styles.container}>
          <View style={[styles.titleArea, styles.internalBlock]}>
            <BottomSheetHandlableView>
              <Text style={[styles.modalTitle, styles.modalMainTitle]}>
                Select a token
              </Text>
            </BottomSheetHandlableView>

            <SearchInput
              isActive={isInputActive}
              containerStyle={styles.searchInputContainer}
              inputProps={{
                value: query,
                onChange: e => handleQueryChange(e.nativeEvent.text),
                onFocus: handleInputFocus,
                onBlur: handleInputBlur,
                placeholder: 'Search by Name / Address',
                placeholderTextColor: colors['neutral-foot'],
              }}
            />
          </View>

          {/* TODO: chain selector */}
          {chainItem && (
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

          <BottomSheetFlatList
            keyboardShouldPersistTaps="handled"
            style={[styles.scrollView, styles.internalBlock]}
            data={tokens}
            windowSize={5}
            keyExtractor={token =>
              `${token.id}-${token._symbol}-${token._chain}`
            }
            ListHeaderComponent={useMemo(
              () =>
                isLoading
                  ? () => {
                      return (
                        <>
                          {Array.from({ length: 10 }).map((_, index) => (
                            <LoadingItem key={index} />
                          ))}
                        </>
                      );
                    }
                  : null,
              [isLoading],
            )}
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
            renderItem={useCallback(
              ({ item: token }) => {
                if (isLoading) {
                  return null;
                }
                const token_key = `${token.$origin.id}-${token._symbol}-${token._chain}`;
                const currentChainItem = findChainByServerID(token._chain);
                const disabled =
                  !!supportChains?.length &&
                  currentChainItem &&
                  !supportChains.includes(currentChainItem.enum);

                return (
                  <TouchableView
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
                      disabled && styles.tokenItemDisabled,
                    ]}>
                    <View style={styles.tokenLeft}>
                      <AssetAvatar
                        logo={token?._logo}
                        size={36}
                        chain={token?._chain}
                        chainSize={16}
                      />
                      <View style={[styles.tokenInfoCol, { marginLeft: 12 }]}>
                        <Text style={styles.tokenName} numberOfLines={1}>
                          {token?._symbol}
                        </Text>
                        <Text
                          style={[styles.tokenPrice, { marginTop: 4 }]}
                          numberOfLines={1}>
                          {token._price}
                        </Text>
                      </View>
                    </View>
                    <View
                      style={[styles.tokenInfoCol, styles.tokenInfoColRight]}>
                      <Text style={styles.tokenHeaderAmount}>
                        {token._amount}
                      </Text>
                      <Text
                        style={[styles.tokenHeaderNetworth, { marginTop: 4 }]}>
                        {token._netWorthStr}
                      </Text>
                    </View>
                  </TouchableView>
                );
              },
              [
                isLoading,
                supportChains,
                disabledTips,
                onConfirm,
                toggleShowSheetModal,
                styles.tokenItem,
                styles.tokenItemDisabled,
                styles.tokenLeft,
                styles.tokenInfoCol,
                styles.tokenName,
                styles.tokenPrice,
                styles.tokenInfoColRight,
                styles.tokenHeaderAmount,
                styles.tokenHeaderNetworth,
              ],
            )}
          />
        </BottomSheetView>
      </AppBottomSheetModal>
    );
  },
);

const getStyles = createGetStyles(colors => {
  return {
    container: {
      paddingTop: ModalLayouts.titleTopOffset,
      paddingBottom: 20,
      flex: 1,
    },
    internalBlock: {
      paddingHorizontal: 20,
    },
    titleArea: {
      justifyContent: 'center',
    },
    modalTitle: {
      color: colors['neutral-title1'],
    },
    modalMainTitle: {
      fontSize: 20,
      fontWeight: '500',
      textAlign: 'center',
    },

    searchInputContainer: {
      borderRadius: 8,
      backgroundColor: colors['neutral-card1'],
      marginVertical: 16,
    },

    chainFiltersContainer: {
      flexDirection: 'row',
      marginBottom: 2,
    },

    scrollView: {
      flexShrink: 1,
    },

    tokenItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      height: ITEM_HEIGHT,

      // // leave here for debug
      // borderWidth: 1,
      // borderColor: 'blue'
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
    tokenName: {
      color: colors['neutral-title-1'],
      fontSize: 15,
      fontWeight: '600',
    },
    tokenPrice: {
      color: colors['neutral-foot'],
      fontSize: 13,
      fontWeight: '400',
    },
    tokenInfoColRight: {
      alignItems: 'flex-end',
      textAlign: 'right',
    },
    tokenHeaderAmount: {
      color: colors['neutral-title-1'],
      fontSize: 16,
      fontWeight: '600',
      textAlign: 'right',
    },
    tokenHeaderNetworth: {
      color: colors['neutral-foot'],
      fontSize: 13,
      fontWeight: '400',
      textAlign: 'right',
    },
    sheet: {
      backgroundColor: colors['neutral-bg-1'],
    },
  };
});

function LoadingItem() {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
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
