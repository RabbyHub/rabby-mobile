import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from 'react';
import { View, TouchableOpacity } from 'react-native';
import { uniqBy } from 'lodash';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { DeferredTokenSelectorSheetModal } from '@/components/Token';
import { getTokenSymbol, tokenItemToITokenItem } from '@/utils/token';
import { openapi } from '@/core/request';
import { useTranslation } from 'react-i18next';
import { RcIconSwapBottomArrow } from '@/assets/icons/swap';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { AssetAvatar } from '@/components';
import { useBridgeSupportedChains } from '../hooks';
import { ellipsisOverflowedText } from '@/utils/text';
import { useMemoizedFn, useUnmount } from 'ahooks';
import { useLongPressTokenAtom } from '@/screens/Swap/hooks';
import { trigger } from 'react-native-haptic-feedback';
import { useSceneAccountInfo } from '@/hooks/accountsSwitcher';
import { FavoriteFilterType } from '@/components/Token/FavoriteFilterItem';
import { useUserTokenSettings } from '@/hooks/useTokenSettings';
import { useFocusEffect } from '@react-navigation/native';
import { useTokenSelectorModalVisible } from '@/components/Token/TokenSelectorSheetModal';
import { useFavoriteTokens } from '@/components/Token/hooks/favorite';
import {
  makeTokenListRequestKey,
  useTokenListAsyncResource,
} from '@/components/Token/hooks/useTokenListAsyncResource';
import { useDebouncedValue } from '@/hooks/common/delayLikeValue';
import { Text } from '@/components/Typography';
import { useRegressionScenarioComponentAction } from '@/devtools/regressionScenarios/react';

interface BridgeToTokenSelectProps {
  // allowClearAccountFilter?: boolean;
  // account?: Account | null;
  token?: TokenItem;
  onChange?(amount: string): void;
  onTokenChange(token: TokenItem): void;
  chainId: string;
  excludeTokens?: TokenItem['id'][];
  placeholder?: string;
  fromChainId?: string;
  fromTokenId?: string;
  address?: string;
}
const defaultExcludeTokens = [];
const BridgeToTokenSelect = ({
  fromChainId,
  fromTokenId,
  // account,
  token,
  onChange,
  onTokenChange,
  chainId,
  excludeTokens = defaultExcludeTokens,
  placeholder,
  address,
}: BridgeToTokenSelectProps) => {
  const [_queryConds, setQueryConds] = useState({
    keyword: '',
  });
  const queryConds = useDebouncedValue(_queryConds, 250);

  const bridgeSupportedChains = useBridgeSupportedChains();
  const {
    visible: tokenSelectorVisible,
    tokenSelectorModalRef,
    setTokenSelectorVisible,
  } = useTokenSelectorModalVisible({
    onVisibleChanged: useMemoizedFn(visible => {
      if (!visible) {
        return;
      }
    }),
  });

  const { finalSceneCurrentAccount: currentAccount } = useSceneAccountInfo({
    forScene: 'MakeTransactionAbout',
  });
  const [_favoriteFilterValue, setFavoriteFilterValue] =
    useState<FavoriteFilterType>('all');

  const favoriteFilterValue = useMemo(() => {
    if (queryConds.keyword?.trim().length > 0) {
      return 'all';
    }
    return _favoriteFilterValue;
  }, [_favoriteFilterValue, queryConds.keyword]);

  const handleCurrentTokenChange = (token: TokenItem) => {
    onChange && onChange('');
    onTokenChange(token);
    // Close the modal without triggering state update
    // The state update will be handled by handleTokenSelectorClose (via onCancel)
    // when the modal finishes closing, which avoids a race condition
    setTokenSelectorVisible(false, { noTriggerRerender: true });
  };

  const { userTokenSettings, fetchUserTokenSettings } = useUserTokenSettings();
  const pinedQueue = useMemo(
    () => userTokenSettings.pinedQueue,
    [userTokenSettings.pinedQueue],
  );

  useFocusEffect(
    useCallback(() => {
      (async () => {
        if (currentAccount?.address) {
          fetchUserTokenSettings();
        }
      })();
    }, [currentAccount?.address, fetchUserTokenSettings]),
  );

  const tokenListRequestKey = useMemo(
    () =>
      makeTokenListRequestKey([
        fromChainId,
        fromTokenId,
        chainId,
        queryConds.keyword,
        address,
      ]),
    [address, chainId, fromChainId, fromTokenId, queryConds.keyword],
  );
  const loadTokenList = useCallback(async () => {
    if (!fromChainId || !chainId) {
      return [];
    }

    const list = await openapi.getBridgeToTokenList({
      from_chain_id: fromChainId,
      from_token_id: fromTokenId,
      to_chain_id: chainId,
      q: queryConds.keyword,
      user_addr: address,
    });
    return list?.token_list || [];
  }, [address, chainId, fromChainId, fromTokenId, queryConds.keyword]);
  const {
    data: tokenList,
    isLoading: tokenListLoading,
    isSettled: isTokenListSettled,
  } = useTokenListAsyncResource({
    enabled: Boolean(fromChainId && chainId),
    requestKey: tokenListRequestKey,
    load: loadTokenList,
  });

  const { data: favoriteTokens, loading: favoriteTokensLoading } =
    useFavoriteTokens({
      focus: favoriteFilterValue === 'favorite',
      address,
      chainId,
      pinnedTokens: pinedQueue,
    });

  const displayTokenList = useMemo(() => {
    return uniqBy(
      (favoriteFilterValue === 'favorite'
        ? favoriteTokens
        : tokenList || []
      ).map(item => tokenItemToITokenItem(item, '')),
      item => {
        return `${item.chain}-${item.id}`;
      },
    )
      .map(e => ({
        ...e,
        isPin: pinedQueue?.some(
          x => x.chainId === e.chain && x.tokenId === e.id,
        ),
      }))
      .filter(e => !excludeTokens.includes(e.id));
  }, [
    favoriteFilterValue,
    favoriteTokens,
    tokenList,
    pinedQueue,
    excludeTokens,
  ]);

  const isListLoading = useMemo(() => {
    return favoriteFilterValue === 'favorite'
      ? favoriteTokensLoading
      : Boolean(fromChainId && chainId) &&
          (tokenListLoading || !isTokenListSettled);
  }, [
    chainId,
    favoriteFilterValue,
    favoriteTokensLoading,
    fromChainId,
    isTokenListSettled,
    tokenListLoading,
  ]);

  const handleSearchTokens = React.useCallback(async keyword => {
    setQueryConds({
      keyword,
    });
  }, []);

  const handleTokenSelectorClose = useCallback(() => {
    setTokenSelectorVisible(false);
  }, [setTokenSelectorVisible]);

  const handleSelectToken = useCallback(() => {
    setTokenSelectorVisible(true);
  }, [setTokenSelectorVisible]);

  useRegressionScenarioComponentAction(
    'token-selector.bridgeTo.open',
    handleSelectToken,
  );
  useRegressionScenarioComponentAction(
    'token-selector.bridgeTo.close',
    handleTokenSelectorClose,
  );

  useEffect(() => {
    setQueryConds(prev => ({
      ...prev,
      chainServerId: chainId,
    }));
  }, [chainId]);

  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const [_, setLongPressToken] = useLongPressTokenAtom();

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

  return (
    <>
      <TouchableOpacity
        onPress={handleSelectToken}
        style={styles.wrapper}
        onLongPress={handleLongPressToken}
        ref={tokenPressRef}>
        {token ? (
          <>
            <View style={styles.token}>
              <AssetAvatar
                size={26}
                chain={token.chain}
                logo={token.logo_url}
                chainSize={0}
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

      <DeferredTokenSelectorSheetModal
        ref={tokenSelectorModalRef}
        visible={tokenSelectorVisible}
        list={displayTokenList}
        onConfirm={handleCurrentTokenChange}
        onCancel={handleTokenSelectorClose}
        onSearch={handleSearchTokens}
        isLoading={isListLoading}
        displayAccountFilter={false}
        disableSort
        // filterAccount={account}
        hideChainFilter={true}
        showFavoriteFilter={!queryConds.keyword}
        favoriteFilterValue={favoriteFilterValue}
        onFavoriteFilterChange={setFavoriteFilterValue}
        selectToken={token}
        headerTitle={null}
        type={'bridgeTo'}
        placeholder={placeholder}
        chainServerId={chainId}
        disabledTips={'Not supported'}
        supportChains={bridgeSupportedChains}
      />
    </>
  );
};
const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  wrapper: {
    borderRadius: 100,
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
    backgroundColor: isLight
      ? colors2024['neutral-bg-0']
      : colors2024['neutral-bg-1'],

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
}));

export default BridgeToTokenSelect;
