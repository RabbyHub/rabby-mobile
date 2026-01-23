import React, {
  useState,
  useEffect,
  useCallback,
  ComponentProps,
  useMemo,
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
} from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { trigger } from 'react-native-haptic-feedback';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { TokenSelectorSheetModal } from '@/components/Token';
import {
  ITokenCheck,
  useTokenSelectorModalVisible,
} from '@/components/Token/TokenSelectorSheetModal';
import { getTokenSymbol, tokenItemToITokenItem } from '@/utils/token';
import { openapi } from '@/core/request';
import { useTranslation } from 'react-i18next';
import { RcIconSwapBottomArrow } from '@/assets/icons/swap';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { AssetAvatar } from '@/components';
import { ellipsisOverflowedText } from '@/utils/text';
import { customTestnetService } from '@/core/services';
import { CHAINS_ENUM } from '@debank/common';
import { Account } from '@/core/services/preference';
import { useDebouncedValue } from '@/hooks/common/delayLikeValue';
import { useScreenSceneAccountContext } from '@/hooks/accountsSwitcher';
import { RootNames } from '@/constant/layout';
import { isWatchOrSafeAccount } from '@/utils/account';
import { useLongPressTokenAtom } from '../hooks';
import { useMemoizedFn, useUnmount } from 'ahooks';
import { useFocusEffect } from '@react-navigation/native';
import { useSelectTokens } from '../hooks/useSelectTokens';
import { useSwitchNetTab } from '@/components2024/PillsSwitch/NetSwitchTabs';
import { useSearchTestnetToken } from '@/hooks/chainAndToken/useSearchTestnetToken';
import { useUserTokenSettings } from '@/hooks/useTokenSettings';
import { FavoriteFilterType } from '@/components/Token/FavoriteFilterItem';
import { tagTokenItemFavorite } from '@/screens/Home/utils/token';
import { ITokenItem } from '@/store/tokens';
import { useFavoriteTokens } from '@/components/Token/hooks/favorite';

interface TokenSelectProps {
  token?: TokenItem;
  onChange?(amount: string): void;
  onTokenChange(token: TokenItem): void;
  accountInScreen?: Account | null;
  chainId: string;
  type?: ComponentProps<typeof TokenSelectorSheetModal>['type'];
  disableItemCheck?: ITokenCheck;
  placeholder?: string;
  hideChainIcon?: boolean;
  value?: string;
  loading?: boolean;
  tokenRender?:
    | (({
        token,
        openTokenModal,
      }: {
        token?: TokenItem;
        openTokenModal: () => void;
      }) => React.ReactNode)
    | React.ReactNode;
  supportChains?: CHAINS_ENUM[];
  searchPlaceholder?: string;
}

type QueryConditions = {
  keyword: string;
  account?: Account | null;
  chainServerId: string;
};
export type TokenSelectInst = {
  openTokenModal: (conds?: Partial<QueryConditions>) => void;
};

const SHOW_CHAIN_FILTER_SCENES = ['swapFrom', 'bridgeFrom'];

const TokenSelect = forwardRef<TokenSelectInst, TokenSelectProps & RNViewProps>(
  (
    {
      token,
      onChange,
      onTokenChange,
      accountInScreen,
      chainId,
      type = 'send',
      placeholder,
      supportChains,
      searchPlaceholder,
      disableItemCheck,
      style,
    },
    ref,
  ) => {
    const [_queryConds, setQueryConds] = useState<QueryConditions>({
      keyword: '',
      account: accountInScreen,
      chainServerId: chainId,
    });

    const [_favoriteFilterValue, setFavoriteFilterValue] =
      useState<FavoriteFilterType>('all');

    const [_, setLongPressToken] = useLongPressTokenAtom();
    const queryConds = useDebouncedValue(_queryConds, 250);
    const [isLpTokenEnabled, setIsLpTokenEnabled] = useState(false);
    const currentAccount = queryConds.account;

    const favoriteFilterValue = useMemo(() => {
      if (queryConds.keyword?.trim().length > 0) {
        return 'all';
      }
      return _favoriteFilterValue;
    }, [_favoriteFilterValue, queryConds.keyword]);

    const {
      visible: tokenSelectorVisible,
      tokenSelectorModalRef,
      setTokenSelectorVisible,
    } = useTokenSelectorModalVisible({
      onVisibleChanged: visible => {
        loadOnVisibleChanged(visible);
      },
    });

    const {
      tokens,
      checkIsExpireAndUpdate,
      loadToken,
      loadOnVisibleChanged,
      isLoading: isLoadingAllTokens,
      isSearching,
    } = useSelectTokens({
      currentAccount,
      chain_server_id: queryConds.chainServerId,
      isLpTokenEnabled,
      keyword: queryConds.keyword,
    });

    useImperativeHandle(ref, () => ({
      openTokenModal: conds => {
        setQueryConds(prev => ({ ...prev, ...conds }));
        setTokenSelectorVisible(true, { noTriggerRerender: false });
      },
    }));

    const hasHandledTokenSelectorVisibleRef = useRef(false);

    // fetch tokens
    useEffect(() => {
      (async () => {
        if (!tokenSelectorVisible) {
          return;
        }
        if (!hasHandledTokenSelectorVisibleRef.current) {
          hasHandledTokenSelectorVisibleRef.current = true;
          return;
        }
        if (currentAccount?.address) {
          loadToken(currentAccount.address);
        } else {
          checkIsExpireAndUpdate();
        }
      })();
    }, [
      tokenSelectorVisible,
      currentAccount?.address,
      loadToken,
      checkIsExpireAndUpdate,
    ]);

    const { userTokenSettings, fetchUserTokenSettings } =
      useUserTokenSettings();
    const pinedQueue = useMemo(
      () => userTokenSettings.pinedQueue,
      [userTokenSettings.pinedQueue],
    );

    const { data: favoriteTokens, loading: favoriteTokensLoading } =
      useFavoriteTokens({
        focus: favoriteFilterValue === 'favorite',
        address: currentAccount?.address,
        chainId: queryConds.chainServerId,
      });

    const isListLoading = useMemo(() => {
      if (isSearching) {
        return true;
      }
      if (isLpTokenEnabled) {
        return isLoadingAllTokens;
      }
      if (favoriteFilterValue === 'favorite') {
        return favoriteTokensLoading;
      }
      if (hasHandledTokenSelectorVisibleRef.current) {
        return false;
      }
      return isLoadingAllTokens;
    }, [
      favoriteFilterValue,
      favoriteTokensLoading,
      isLoadingAllTokens,
      isLpTokenEnabled,
      isSearching,
    ]);

    const handleSearchTokens = useCallback<
      React.ComponentProps<typeof TokenSelectorSheetModal>['onSearch']
    >(
      async ctx => {
        setQueryConds(prev => ({
          ...prev,
          ...(typeof ctx === 'string'
            ? { keyword: ctx }
            : {
                account: ctx.filterAccountItem ?? null,
                keyword: ctx.keyword,
                chainServerId: ctx.chainServerId ?? prev.chainServerId,
              }),
        }));
      },
      [setQueryConds],
    );

    const handleCurrentTokenChange = useCallback<
      React.ComponentProps<typeof TokenSelectorSheetModal>['onConfirm']
    >(
      t => {
        onChange && onChange('');
        onTokenChange(t);
        setTokenSelectorVisible(false);
        setIsLpTokenEnabled(false);
      },
      [onChange, onTokenChange, setTokenSelectorVisible, setIsLpTokenEnabled],
    );

    const handleTokenSelectorClose = useCallback(() => {
      //FIXME: snap to close will retrigger render
      setTimeout(() => {
        setTokenSelectorVisible(false);
        setIsLpTokenEnabled(false);
      }, 0);
    }, [setTokenSelectorVisible, setIsLpTokenEnabled]);

    const resetQueryConds = useCallback(() => {
      setQueryConds(prev => ({
        ...prev,
        chainServerId: chainId,
        account: accountInScreen,
      }));
    }, [chainId, accountInScreen]);

    const handleSelectToken = useCallback(() => {
      resetQueryConds();
      setTokenSelectorVisible(true);
    }, [resetQueryConds, setTokenSelectorVisible]);

    useEffect(() => {
      setQueryConds(prev => ({ ...prev, chainServerId: chainId }));
    }, [chainId]);

    useLayoutEffect(() => {
      setQueryConds(prev => ({ ...prev, account: accountInScreen }));
    }, [accountInScreen]);

    const { t } = useTranslation();
    const { styles } = useTheme2024({ getStyle });

    useFocusEffect(
      useCallback(() => {
        (async () => {
          if (currentAccount?.address) {
            fetchUserTokenSettings();
          }
        })();
      }, [currentAccount?.address, fetchUserTokenSettings]),
    );

    const unFoldTokenList = useMemo(() => {
      if (favoriteFilterValue === 'favorite') {
        return favoriteTokens.map(e => ({
          ...e,
          isPin: true,
        }));
      }
      const tokensWithPinStatus = tokens?.map(e => ({
        ...e,
        isPin: pinedQueue?.some(
          x => x.chainId === e.chain && x.tokenId === e.id,
        ),
      })) as ITokenItem[];
      return tokensWithPinStatus;
    }, [favoriteFilterValue, tokens, favoriteTokens, pinedQueue]);

    const { forScene, ofScreen } = useScreenSceneAccountContext();
    const allowClearAccountFilter = useMemo(() => {
      if (
        queryConds.keyword ||
        !currentAccount?.type ||
        isWatchOrSafeAccount(currentAccount?.type)
      ) {
        return false;
      }

      return (
        forScene === 'MakeTransactionAbout' &&
        ((RootNames.MultiBridge === ofScreen && type === 'bridgeFrom') ||
          (RootNames.MultiSwap === ofScreen && type === 'swapFrom'))
      );
    }, [queryConds.keyword, currentAccount?.type, forScene, ofScreen, type]);

    const handleTokenChange = useMemoizedFn(async (tokenItem?: TokenItem) => {
      if (!tokenItem || !tokenItem.id) {
        return;
      }
      const res = await openapi.getTokenEntity(tokenItem.id, tokenItem.chain);
      setLongPressToken(prev => ({
        ...prev,
        tokenEntity: {
          ...tokenItem,
          identity: res,
        },
      }));
    });

    const tokenPressRef = useRef<typeof TouchableOpacity & View>(null);
    const handleLongPressToken = () => {
      if (!token) {
        return;
      }
      trigger('impactLight', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
      handleTokenChange(token);
      tokenPressRef.current?.measureInWindow((x, y) => {
        tokenPressRef.current?.measure((_, __, ___, height) => {
          setLongPressToken(prev => ({
            ...prev,
            visible: true,
            tokenItem: token || null,
            position: { x, y, height },
          }));
        });
      });
    };

    useUnmount(() => {
      setLongPressToken({
        visible: false,
        tokenItem: null,
        position: { x: 0, y: 0, height: 0 },
        tokenEntity: null,
      });
    });

    const isSend = type === 'send';

    const { isShowTestnet, selectedTab, onTabChange } = useSwitchNetTab({
      hideTestnetTab: !isSend || customTestnetService.getList().length === 0,
    });

    const {
      testnetTokenList: rawTestnetTokenList,
      loading: testnetTokenListLoading,
    } = useSearchTestnetToken({
      address: currentAccount?.address,
      withBalance: false,
      q: queryConds.keyword,
      enabled: selectedTab === 'testnet' && isSend,
    });

    const testnetTokenList = useMemo(() => {
      if (!currentAccount?.address) {
        return [];
      }
      const list = rawTestnetTokenList.map(item => {
        const i = tokenItemToITokenItem(item, currentAccount.address);
        return tagTokenItemFavorite(i, { pinedQueue }) as ITokenItem;
      });
      if (favoriteFilterValue === 'favorite') {
        return list.filter(token =>
          pinedQueue?.some(
            x => x.chainId === token.chain && x.tokenId === token.id,
          ),
        );
      }
      return list;
    }, [
      rawTestnetTokenList,
      favoriteFilterValue,
      pinedQueue,
      currentAccount?.address,
    ]);

    return (
      <>
        <TouchableOpacity
          onPress={handleSelectToken}
          onLongPress={handleLongPressToken}
          ref={tokenPressRef}>
          <View
            style={[
              type === 'bridgeFrom' ? styles.bridgeWrapper : styles.wrapper,
              style,
            ]}>
            {token ? (
              <>
                <View style={styles.token}>
                  <AssetAvatar
                    size={26}
                    chain={token.chain}
                    logo={token.logo_url}
                    chainSize={type === 'send' ? 12 : 0}
                  />
                  <Text numberOfLines={1} style={styles.tokenSymbol}>
                    {ellipsisOverflowedText(getTokenSymbol(token), 5)}
                  </Text>
                </View>
                <RcIconSwapBottomArrow />
              </>
            ) : (
              <View style={styles.token}>
                <Text style={styles.selectText}>{t('page.bridge.Select')}</Text>
                <RcIconSwapBottomArrow />
              </View>
            )}
          </View>
        </TouchableOpacity>

        <TokenSelectorSheetModal
          searchPlaceholder={searchPlaceholder}
          ref={tokenSelectorModalRef}
          visible={tokenSelectorVisible}
          unshiftList={[]}
          list={selectedTab === 'testnet' ? testnetTokenList : unFoldTokenList}
          onConfirm={handleCurrentTokenChange}
          onCancel={handleTokenSelectorClose}
          onSearch={handleSearchTokens}
          isLoading={
            selectedTab === 'testnet' ? testnetTokenListLoading : isListLoading
          }
          showFavoriteFilter={!queryConds.keyword}
          favoriteFilterValue={favoriteFilterValue}
          onFavoriteFilterChange={setFavoriteFilterValue}
          type={type}
          disableItemCheck={disableItemCheck}
          selectToken={token}
          placeholder={placeholder}
          displayAccountFilter={allowClearAccountFilter}
          filterAccount={queryConds.account}
          chainServerId={queryConds.chainServerId}
          disabledTips={'Not supported'}
          supportChains={supportChains}
          hideChainFilter={!SHOW_CHAIN_FILTER_SCENES.includes(type)}
          showTestNetSwitch={isShowTestnet}
          selectTab={selectedTab}
          onTabChange={onTabChange}
          showLpTokenSwitch={!queryConds.keyword}
          isLpTokenEnabled={isLpTokenEnabled}
          onLpTokenChange={setIsLpTokenEnabled}
        />
      </>
    );
  },
);
const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  wrapper: {
    borderRadius: 12,
    // TODO: backgroundColor: colors2024['neutral-card-2'],
    backgroundColor: colors2024['neutral-line'],
    // backgroundColor: colors2024['neutral-bg-2'],

    // paddingLeft: 16,
    // paddingRight: 12,
    padding: 4,
    height: 34,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bridgeWrapper: {
    borderRadius: 12,
    backgroundColor: colors2024['neutral-line'],
    padding: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recentItemWrapper: {
    borderRadius: 8,
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    padding: 8,
    paddingRight: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  token: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  tokenSymbol: {
    lineHeight: 20,
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
  },
  headerBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 8,
    backgroundColor: isLight
      ? colors2024['neutral-bg-0']
      : colors2024['neutral-bg-1'],
  },
  headerBoxNoPb: {
    paddingBottom: 0,
  },
  headerBoxText: {
    fontSize: 17,
    fontWeight: '400',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-secondary'],
  },
  selectText: {
    paddingLeft: 12,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
  },
}));

export default TokenSelect;
