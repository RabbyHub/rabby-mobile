import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from 'react';
import { View, Text, TouchableOpacity, Keyboard } from 'react-native';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import useAsync from 'react-use/lib/useAsync';
import { useTokens } from '@/hooks/chainAndToken/useToken';
import { useCurrentAccount } from '@/hooks/account';
import { getTokenSymbol } from '@/utils/token';
import { openapi } from '@/core/request';
import { useTranslation } from 'react-i18next';
import { RcIconSwapBottomArrow } from '@/assets/icons/swap';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { AppBottomSheetModal, AssetAvatar } from '@/components';
import { ellipsisOverflowedText } from '@/utils/text';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { SearchInput } from '@/components/Form/SearchInput';
import SearchSVG from '@/assets2024/icons/common/search-cc.svg';
import { Skeleton } from '@rneui/themed';
import { formatPrice, formatTokenAmount, formatUsdValue } from '@/utils/number';
import BigNumber from 'bignumber.js';
import { toast } from '@/components2024/Toast';
import { BottomSheetModalMethods } from '@gorhom/bottom-sheet/src/types';
import { ModalLayouts } from '@/constant/layout';
import CheckedIcon from '@/assets2024/icons/common/check.svg';
import { NotMatchedHolder } from '@/screens/Approvals/components/Layout';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface TokenSelectProps {
  token?: TokenItem;
  onTokenChange(token: TokenItem): void;
}

export const BuyTokenSelect = ({ token, onTokenChange }: TokenSelectProps) => {
  const { currentAccount } = useCurrentAccount({ disableAutoFetch: true });
  const [tokenSelectorVisible, setTokenSelectorVisible] = useState(false);

  const handleCurrentTokenChange = (token: TokenItem) => {
    onTokenChange(token);
    setTokenSelectorVisible(false);
  };

  const handleTokenSelectorClose = () => {
    setTokenSelectorVisible(false);
  };

  const handleSelectToken = () => {
    setTokenSelectorVisible(true);
  };

  const { t } = useTranslation();
  const { styles } = useTheme2024({ getStyle });

  return (
    <>
      <TouchableOpacity onPress={handleSelectToken} style={styles.wrapper}>
        {token ? (
          <>
            <View style={styles.token}>
              <AssetAvatar
                size={22}
                chain={token.chain}
                logo={token.logo_url}
                chainSize={10}
              />
              <Text numberOfLines={1} style={styles.tokenSymbol}>
                {ellipsisOverflowedText(getTokenSymbol(token), 5)}
              </Text>
            </View>
            <RcIconSwapBottomArrow />
          </>
        ) : (
          <>
            <Text style={styles.selectText}>{t('page.bridge.Select')}</Text>
            <RcIconSwapBottomArrow />
          </>
        )}
      </TouchableOpacity>

      <TokenSelector
        visible={tokenSelectorVisible}
        onClose={handleTokenSelectorClose}
        onChange={handleCurrentTokenChange}
        address={currentAccount?.address || ''}
        token={token}
      />
    </>
  );
};

const TokenSelectorInner = ({
  onChange,
  address,
  onClose,
  token,
}: {
  onChange: (token: TokenItem) => void;
  address: string;
  onClose: () => void;
  token?: TokenItem;
}) => {
  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({
    getStyle: getStyle,
  });

  const [query, setQuery] = useState('');
  const [isInputActive, setIsInputActive] = useState(false);

  const { bottom } = useSafeAreaInsets();

  const handleInputFocus = () => {
    setIsInputActive(true);
  };

  const handleInputBlur = () => {
    setIsInputActive(false);
  };

  const handleQueryChange = (value: string) => {
    setQuery(value);
  };

  const {
    value: list,
    loading,
    error,
  } = useAsync(() => openapi.getBuySupportedTokenList(), [address]);

  if (error) {
    toast.error(error?.message ? String(error?.message) : String(error));
  }

  const displayList = useMemo(() => {
    const k = query?.trim();
    if (k) {
      return (
        list?.filter(
          e =>
            e.symbol.toLowerCase().includes(query.toLowerCase()) ||
            e.name.toLowerCase().includes(query.toLowerCase()) ||
            e.id.toLowerCase()?.includes(query.toLowerCase()),
        ) || []
      );
    }
    return list || [];
  }, [query, list]);

  const { tokens, updateData } = useTokens(address, false, 0, undefined, true);

  useEffect(() => {
    updateData();
  }, [updateData]);

  const Row = useCallback(
    ({ item }: { item: TokenItem & { pinned?: boolean } }) => {
      const isSelected = token?.id === item.id && token.chain === item.chain;

      const cachedToken = tokens?.find(
        e => e._tokenId === item.id && e.chain === item.chain,
      );

      return (
        <TouchableOpacity
          style={[styles.tokenListItem, isSelected && styles.selectedToken]}
          onPress={() => {
            onChange(item);
            onClose();
          }}>
          <View style={styles.tokenLeft}>
            <AssetAvatar
              logo={item.logo_url}
              size={40}
              chain={item.chain}
              chainSize={16}
            />
            <View style={[styles.tokenInfoCol, { marginLeft: 12 }]}>
              <View style={styles.tokenNameBox}>
                <Text style={styles.tokenName} numberOfLines={1}>
                  {ellipsisOverflowedText(getTokenSymbol(item), 15)}
                </Text>
                {isSelected && <CheckedIcon width={16} height={16} />}
              </View>
              <Text
                style={[styles.tokenPrice, { marginTop: 4 }]}
                numberOfLines={1}>
                ${formatPrice(item.price)}
              </Text>
            </View>
          </View>

          <View style={[styles.tokenInfoCol, styles.tokenInfoColRight]}>
            <Text style={[styles.tokenHeaderAmount]}>
              {formatTokenAmount(cachedToken?.amount || 0)}
            </Text>
            <Text style={[styles.tokenHeaderNetworth, { marginTop: 4 }]}>
              {formatUsdValue(
                new BigNumber(cachedToken?.amount || 0)
                  .times(item.price)
                  .toString(10),
              )}
            </Text>
          </View>
        </TouchableOpacity>
      );
    },
    [
      onChange,
      onClose,
      styles.selectedToken,
      styles.tokenHeaderAmount,
      styles.tokenHeaderNetworth,
      styles.tokenInfoCol,
      styles.tokenInfoColRight,
      styles.tokenLeft,
      styles.tokenListItem,
      styles.tokenName,
      styles.tokenNameBox,
      styles.tokenPrice,
      token?.chain,
      token?.id,
      tokens,
    ],
  );

  const ListHeader = useMemo(() => {
    return loading ? (
      <>
        {Array.from({ length: 10 }).map((_, index) => (
          <View key={index} style={styles.tokenListItem}>
            <View style={[styles.box, { gap: 16 }]}>
              <Skeleton circle width={40} height={40} />
              <Skeleton width={70} height={20} />
            </View>
            <Skeleton width={50} height={20} />
          </View>
        ))}
      </>
    ) : null;
  }, [loading, styles.box, styles.tokenListItem]);

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 20 }}>
        <Text style={styles.title}>
          {t('page.gasTopUp.Select-from-supported-tokens')}
        </Text>

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
            placeholder: 'Search Token',
            placeholderTextColor: colors2024['neutral-info'],
          }}
        />
      </View>

      <View style={styles.headerBox}>
        <Text style={styles.headerBoxText}>{t('page.bridge.token')}</Text>
        <Text style={styles.headerBoxText}>{t('page.bridge.value')}</Text>
      </View>

      <BottomSheetFlatList
        contentInset={{ bottom }}
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={() => Keyboard.dismiss()}
        data={displayList}
        style={styles.flatList}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          <NotMatchedHolder
            style={{
              height: 400,
            }}
            text="No tokens"
          />
        }
        renderItem={Row}
        keyExtractor={item => item.id + item.chain}
      />
    </View>
  );
};

const TokenSelector = ({
  visible,
  onClose,
  onChange,
  address,
  token,
}: {
  visible: boolean;
  onClose: () => void;
  onChange: (token: TokenItem) => void;
  address: string;
  token?: TokenItem;
}) => {
  const { t } = useTranslation();
  const { styles, colors2024, isLight } = useTheme2024({ getStyle });
  const bottomRef = useRef<BottomSheetModalMethods>(null);

  const snapPoints = useMemo(() => [ModalLayouts.defaultHeightPercentText], []);

  useEffect(() => {
    if (visible) {
      bottomRef.current?.present();
    } else {
      bottomRef.current?.dismiss();
    }
  }, [visible]);

  return (
    <AppBottomSheetModal
      ref={bottomRef}
      snapPoints={snapPoints}
      onDismiss={onClose}
      // renderBackdrop={renderBackdrop}
      {...{
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
      }}>
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

      <TokenSelectorInner
        onChange={onChange}
        address={address}
        onClose={onClose}
        token={token}
      />
    </AppBottomSheetModal>
  );
};

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  wrapper: {
    borderRadius: 12,
    backgroundColor: colors2024['neutral-line'],
    padding: 4,
    paddingHorizontal: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  liquidityBox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerBox: {
    height: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',

    paddingHorizontal: 24,
  },
  headerBoxText: {
    fontSize: 17,
    marginRight: 2,
    fontWeight: '400',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-secondary'],
  },
  token: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  tokenSymbol: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
  },
  selectText: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
  },

  title: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    fontStyle: 'normal',
    fontWeight: '800',
    color: colors2024['neutral-title-1'],
    marginBottom: 18,
    textAlign: 'center',
  },
  inputStyle: {
    fontFamily: 'SF Pro Rounded',
    lineHeight: 22,
    fontSize: 17,
    color: colors2024['neutral-title-1'],
  },
  flatList: {
    flexShrink: 1,
    paddingHorizontal: 20,
  },

  tokenListItem: {
    height: 72,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 12,
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    borderRadius: 16,
  },
  searchInputContainer: {
    borderRadius: 30,
    backgroundColor: colors2024['neutral-bg-2'],
    paddingHorizontal: 12,
    borderColor: 'transparent',
    alignItems: 'center',
    marginBottom: 16,
  },
  searchIconWrapperStyle: {
    paddingLeft: 0,
  },
  box: { flexDirection: 'row', alignItems: 'center' },
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
  text: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 20,
  },
  selectedToken: {
    backgroundColor: colors2024['brand-light-1'],
    borderRadius: 16,
    borderColor: colors2024['brand-light-2'],
    borderWidth: 1,
    borderStyle: 'solid',
  },
  flatListContentContainerStyle: {
    borderRadius: 24,
    overflow: 'hidden',
    gap: 8,
  },
}));
