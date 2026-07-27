import type { ComponentProps } from 'react';
import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  type Ref,
} from 'react';
import { View, TouchableOpacity } from 'react-native';
import { trigger } from 'react-native-haptic-feedback';
import type { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { TokenSelectorSheetModal } from '@/components/Token';
import type { ITokenCheck } from '@/components/Token/TokenSelectorSheetModal';
import { useTokenSelectorModalVisible } from '@/components/Token/TokenSelectorSheetModal';
import { getTokenSymbol, tokenItemToITokenItem } from '@/utils/token';
import { openapi } from '@/core/request';
import { useTranslation } from 'react-i18next';
import { RcIconSwapBottomArrow } from '@/assets/icons/swap';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { AssetAvatar } from '@/components';
import { ellipsisOverflowedText } from '@/utils/text';
import type { CHAINS_ENUM } from '@debank/common';
import type { Account } from '@/core/startupServices/preference';
import { useCustomTestnetStore } from '@/store/customTestnet';
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
import type { FavoriteFilterType } from '@/components/Token/FavoriteFilterItem';
import { tagTokenItemFavorite } from '@/screens/Home/utils/token';
import type { ITokenItem } from '@/store/tokens';
import { useFavoriteTokens } from '@/components/Token/hooks/favorite';
import { Text } from '@/components/Typography';
import { isSameAccount } from '@/utils/isSameAccount';
import { useRegressionScenarioComponentAction } from '@/devtools/regressionScenarios/react';

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
const EMPTY_TOKEN_LIST: ITokenItem[] = [];

const TokenSelect = ({
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
  testID,
  accessibilityLabel,
  ref,
}: TokenSelectProps & RNViewProps & { ref?: Ref<TokenSelectInst> }) => {
  const [_queryConds, setQueryConds] = useState<QueryConditions>({
    keyword: '',
    account: accountInScreen,
    chainServerId: chainId,
  });

  const [_favoriteFilterValue, setFavoriteFilterValue] =
    useState<FavoriteFilterType>('all');

  const [_, setLongPressToken] = useLongPressTokenAtom();
  const debouncedKeyword = useDebouncedValue(_queryConds.keyword, 250);
  const queryConds = useMemo(
    () => ({
      ..._queryConds,
      keyword: debouncedKeyword,
    }),
    [_queryConds, debouncedKeyword],
  );
  const [isLpTokenEnabled, setIsLpTokenEnabled] = useState(false);
  const currentAccount = queryConds.account;
  const customTestnetMap = useCustomTestnetStore(state => state.customTestnet);
  const customTestnetList = useMemo(
    () => Object.values(customTestnetMap),
    [customTestnetMap],
  );

  const favoriteFilterValue = useMemo(() => {
    if (queryConds.keyword?.trim().length > 0) {
      return 'all';
    }
    return _favoriteFilterValue;
  }, [_favoriteFilterValue, queryConds.keyword]);

  const isSend = type === 'send';
  const customNetworkTop3Chains = useMemo(
    () => customTestnetList.slice(0, 3).map(chain => chain.serverId),
    [customTestnetList],
  );
  const { isShowTestnet, selectedTab, onTabChange } = useSwitchNetTab({
    hideTestnetTab: !isSend || customTestnetList.length === 0,
  });
  const isCustomNetworkTab = isSend && selectedTab === 'testnet';
  const effectiveFavoriteFilterValue = isCustomNetworkTab
    ? 'all'
    : favoriteFilterValue;
  const effectiveIsLpTokenEnabled = isCustomNetworkTab
    ? false
    : isLpTokenEnabled;

  const isSameSourceTokenSelect =
    type === 'send' || type === 'swapFrom' || type === 'bridgeFrom';
  const shouldUseTokenRows =
    isSameSourceTokenSelect &&
    !isCustomNetworkTab &&
    effectiveFavoriteFilterValue !== 'favorite';
  const shouldUseTokenObjects =
    !isCustomNetworkTab &&
    effectiveFavoriteFilterValue !== 'favorite' &&
    !shouldUseTokenRows;

  const {
    visible: tokenSelectorVisible,
    visibleRef: tokenSelectorVisibleRef,
    tokenSelectorModalRef,
    setTokenSelectorVisible,
  } = useTokenSelectorModalVisible({
    onVisibleChanged: visible => {
      loadOnVisibleChanged(visible);
    },
  });

  const {
    tokens,
    tokenRows,
    checkIsExpireAndUpdate,
    ensureInitialTokenLoad,
    loadToken,
    loadOnVisibleChanged,
    isLoading: isLoadingAllTokens,
    isSearching,
  } = useSelectTokens({
    currentAccount,
    chain_server_id: queryConds.chainServerId,
    isLpTokenEnabled: effectiveIsLpTokenEnabled,
    keyword: queryConds.keyword,
    returnTokenObjects: shouldUseTokenObjects,
    skipEmptyChainInit: type === 'bridgeFrom',
    deferInitialRemoteLoad: type === 'send',
  });

  useImperativeHandle(ref, () => ({
    openTokenModal: conds => {
      setQueryConds(prev => ({ ...prev, ...conds }));
      setTokenSelectorVisible(true, { noTriggerRerender: false });
    },
  }));

  const hasHandledTokenSelectorVisibleRef = useRef(false);

  const refreshVisibleTokenList = useCallback(() => {
    if (currentAccount?.address) {
      loadToken(currentAccount.address);
      return;
    }
    checkIsExpireAndUpdate();
  }, [checkIsExpireAndUpdate, currentAccount?.address, loadToken]);

  const ensureVisibleTokenListLoaded = useCallback(() => {
    if (currentAccount?.address) {
      ensureInitialTokenLoad(currentAccount.address);
      return;
    }
    checkIsExpireAndUpdate();
  }, [checkIsExpireAndUpdate, currentAccount?.address, ensureInitialTokenLoad]);

  const handleTokenSelectorOpened = useCallback(() => {
    if (!hasHandledTokenSelectorVisibleRef.current) {
      hasHandledTokenSelectorVisibleRef.current = true;
      ensureInitialTokenLoad(currentAccount?.address);
      return;
    }
    refreshVisibleTokenList();
  }, [
    currentAccount?.address,
    ensureInitialTokenLoad,
    refreshVisibleTokenList,
  ]);

  // Refresh account/chain changes while open. Opening itself refreshes only
  // after the native sheet animation completes via handleTokenSelectorOpened.
  useEffect(() => {
    if (
      !tokenSelectorVisibleRef.current ||
      !hasHandledTokenSelectorVisibleRef.current
    ) {
      return;
    }
    ensureVisibleTokenListLoaded();
  }, [
    currentAccount?.address,
    ensureVisibleTokenListLoaded,
    queryConds.chainServerId,
    tokenSelectorVisibleRef,
  ]);

  const { userTokenSettings, fetchUserTokenSettings } = useUserTokenSettings();
  const pinedQueue = useMemo(
    () => userTokenSettings.pinedQueue,
    [userTokenSettings.pinedQueue],
  );
  const favoriteTokenKeySet = useMemo(() => {
    return new Set(pinedQueue?.map(x => `${x.chainId}:${x.tokenId}`));
  }, [pinedQueue]);

  const { data: favoriteTokens, loading: favoriteTokensLoading } =
    useFavoriteTokens({
      focus: effectiveFavoriteFilterValue === 'favorite',
      address: currentAccount?.address,
      chainId: queryConds.chainServerId,
    });

  const isListLoading = useMemo(() => {
    if (isSearching) {
      return true;
    }
    if (effectiveIsLpTokenEnabled) {
      return isLoadingAllTokens;
    }
    if (effectiveFavoriteFilterValue === 'favorite') {
      return favoriteTokensLoading;
    }
    if (hasHandledTokenSelectorVisibleRef.current) {
      return false;
    }
    return isLoadingAllTokens;
  }, [
    effectiveFavoriteFilterValue,
    effectiveIsLpTokenEnabled,
    favoriteTokensLoading,
    isLoadingAllTokens,
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
              chainServerId: Object.prototype.hasOwnProperty.call(
                ctx,
                'chainServerId',
              )
                ? ctx.chainServerId || ''
                : prev.chainServerId,
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
      // Close the modal without triggering state update
      // The state update will be handled by handleTokenSelectorClose (via onCancel)
      // when the modal finishes closing, which avoids a race condition
      setTokenSelectorVisible(false, { noTriggerRerender: true });
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
    setQueryConds(prev => {
      const isSameQueryAccount =
        prev.account === accountInScreen ||
        isSameAccount(prev.account, accountInScreen);
      if (prev.chainServerId === chainId && isSameQueryAccount) {
        return prev;
      }

      return {
        ...prev,
        chainServerId: chainId,
        account: accountInScreen,
      };
    });
  }, [chainId, accountInScreen]);

  const handleSelectToken = useCallback(() => {
    resetQueryConds();
    setTokenSelectorVisible(true);
  }, [resetQueryConds, setTokenSelectorVisible]);

  const regressionSelectorActionPrefix =
    type === 'send' ? 'send-token-selector' : `token-selector.${type}`;
  useRegressionScenarioComponentAction(
    `${regressionSelectorActionPrefix}.open`,
    handleSelectToken,
  );
  useRegressionScenarioComponentAction(
    `${regressionSelectorActionPrefix}.close`,
    handleTokenSelectorClose,
  );

  useEffect(() => {
    setQueryConds(prev =>
      prev.chainServerId === chainId
        ? prev
        : { ...prev, chainServerId: chainId },
    );
  }, [chainId]);

  useLayoutEffect(() => {
    setQueryConds(prev => {
      const isSameQueryAccount =
        prev.account === accountInScreen ||
        isSameAccount(prev.account, accountInScreen);
      return isSameQueryAccount ? prev : { ...prev, account: accountInScreen };
    });
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
    if (shouldUseTokenRows) {
      return [];
    }
    if (effectiveFavoriteFilterValue === 'favorite') {
      return favoriteTokens.map(e => ({
        ...e,
        isPin: true,
      }));
    }
    const tokensWithPinStatus = tokens?.map(e => ({
      ...e,
      isPin: pinedQueue?.some(x => x.chainId === e.chain && x.tokenId === e.id),
    })) as ITokenItem[];
    return tokensWithPinStatus;
  }, [
    shouldUseTokenRows,
    effectiveFavoriteFilterValue,
    tokens,
    favoriteTokens,
    pinedQueue,
  ]);

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
      RootNames.MultiSwapBridge === ofScreen &&
      (type === 'bridgeFrom' || type === 'swapFrom')
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
    if (effectiveFavoriteFilterValue === 'favorite') {
      return list.filter(token =>
        pinedQueue?.some(
          x => x.chainId === token.chain && x.tokenId === token.id,
        ),
      );
    }
    return list;
  }, [
    rawTestnetTokenList,
    effectiveFavoriteFilterValue,
    pinedQueue,
    currentAccount?.address,
  ]);

  return (
    <>
      <TouchableOpacity
        onPress={handleSelectToken}
        onLongPress={handleLongPressToken}
        ref={tokenPressRef}
        testID={testID}
        accessibilityLabel={accessibilityLabel}>
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
                  innerChainStyle={styles.avatarLogo}
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
        list={
          shouldUseTokenRows
            ? EMPTY_TOKEN_LIST
            : selectedTab === 'testnet'
            ? testnetTokenList
            : unFoldTokenList
        }
        tokenRows={shouldUseTokenRows ? tokenRows : undefined}
        onConfirm={handleCurrentTokenChange}
        onCancel={handleTokenSelectorClose}
        onOpened={handleTokenSelectorOpened}
        onSearch={handleSearchTokens}
        isLoading={isCustomNetworkTab ? testnetTokenListLoading : isListLoading}
        showFavoriteFilter={!queryConds.keyword && !isCustomNetworkTab}
        favoriteFilterValue={effectiveFavoriteFilterValue}
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
        showLpTokenSwitch={!queryConds.keyword && !isCustomNetworkTab}
        isLpTokenEnabled={effectiveIsLpTokenEnabled}
        onLpTokenChange={setIsLpTokenEnabled}
        favoriteTokenKeySet={favoriteTokenKeySet}
        showCustomNetworkChainPreview={isCustomNetworkTab}
        customNetworkTop3Chains={customNetworkTop3Chains}
      />
    </>
  );
};
const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  wrapper: {
    borderRadius: 100,
    // TODO: backgroundColor: colors2024['neutral-card-2'],
    backgroundColor: colors2024['neutral-line'],
    padding: 4,
    height: 34,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bridgeWrapper: {
    borderRadius: 100,
    backgroundColor: colors2024['neutral-line'],
    padding: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  selectText: {
    paddingLeft: 12,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
  },
  avatarLogo: {
    overflow: 'hidden',
  },
}));

export default TokenSelect;
