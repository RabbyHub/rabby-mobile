import React, {
  useState,
  useEffect,
  useCallback,
  ComponentProps,
  useMemo,
} from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import RcIcHelp from '@/assets2024/icons/bridge/IcHelp.svg';
import { uniqBy } from 'lodash';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { TokenSelectorSheetModal } from '@/components/Token';
import { isSwapTokenType } from '@/components/Token/TokenSelectorSheetModal';
import useAsync from 'react-use/lib/useAsync';
import { useSortToken, useTokens } from '@/hooks/chainAndToken/useToken';
import { useCurrentAccount } from '@/hooks/account';
import { abstractTokenToTokenItem, getTokenSymbol } from '@/utils/token';
import useSearchToken from '@/hooks/chainAndToken/useSearchToken';
import { openapi } from '@/core/request';
import { SWAP_SUPPORT_CHAINS } from '@/constant/swap';
import { useTranslation } from 'react-i18next';
import { RcIconSwapBottomArrow } from '@/assets/icons/swap';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { AssetAvatar } from '@/components';
import { useBridgeSupportedChains } from '../hooks';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { createGlobalBottomSheetModal2024 } from '@/components2024/GlobalBottomSheetModal';
import { ellipsisOverflowedText } from '@/utils/text';

interface TokenSelectProps {
  token?: TokenItem;
  onChange?(amount: string): void;
  onTokenChange(token: TokenItem): void;
  chainId: string;
  excludeTokens?: TokenItem['id'][];
  placeholder?: string;
  fromChainId?: string;
  fromTokenId?: string;
}
const defaultExcludeTokens = [];
const TokenSelect = ({
  fromChainId,
  fromTokenId,
  token,
  onChange,
  onTokenChange,
  chainId,
  excludeTokens = defaultExcludeTokens,
  placeholder,
}: TokenSelectProps) => {
  const [queryConds, setQueryConds] = useState({
    keyword: '',
  });

  const bridgeSupportedChains = useBridgeSupportedChains();
  const [tokenSelectorVisible, setTokenSelectorVisible] = useState(false);

  const { currentAccount } = useCurrentAccount();

  const handleCurrentTokenChange = (token: TokenItem) => {
    onChange && onChange('');
    onTokenChange(token);
    setTokenSelectorVisible(false);

    setQueryConds(prev => ({ ...prev }));
  };

  const { value: tokenList, loading: tokenListLoading } = useAsync(async () => {
    if (fromChainId && chainId) {
      const list = await openapi.getBridgeToTokenList({
        from_chain_id: fromChainId,
        from_token_id: fromTokenId,
        to_chain_id: chainId,
        q: queryConds.keyword,
      });
      return list?.token_list;
    }
    return [];
  }, [currentAccount, chainId, tokenSelectorVisible, queryConds.keyword]);

  const availableToken = useMemo(() => {
    return uniqBy(tokenList, item => {
      return `${item.chain}-${item.id}`;
    }).filter(e => !excludeTokens.includes(e.id));
  }, [tokenList, excludeTokens]);

  const displayTokenList = useSortToken(availableToken);

  const isListLoading = tokenListLoading;

  const handleSearchTokens = React.useCallback(async keyword => {
    setQueryConds({
      keyword,
    });
  }, []);

  const handleTokenSelectorClose = () => {
    setTokenSelectorVisible(false);

    setQueryConds(prev => ({
      ...prev,
    }));
  };

  const handleSelectToken = () => {
    setTokenSelectorVisible(true);
  };

  useEffect(() => {
    setQueryConds(prev => ({
      ...prev,
      chainServerId: chainId,
    }));
  }, [chainId]);

  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({ getStyle });

  return (
    <>
      <TouchableOpacity onPress={handleSelectToken} style={styles.wrapper}>
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

      <TokenSelectorSheetModal
        visible={tokenSelectorVisible}
        list={displayTokenList}
        onConfirm={handleCurrentTokenChange}
        onCancel={handleTokenSelectorClose}
        onSearch={handleSearchTokens}
        isLoading={isListLoading}
        hideChainFilter={true}
        selectToken={token}
        headerTitle={
          <View style={styles.headerBox}>
            <Text style={styles.headerBoxText}>{t('page.bridge.token')}</Text>
            <View style={styles.liquidityBox}>
              <Text style={styles.headerBoxText}>
                {t('page.bridge.liquidity')}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  createGlobalBottomSheetModal2024({
                    name: MODAL_NAMES.DESCRIPTION,
                    bottomSheetModalProps: {
                      enableContentPanningGesture: true,
                      enablePanDownToClose: true,
                      snapPoints: [200],
                    },
                    title: 'About Liquidity',
                    sections: [
                      {
                        description:
                          'The higher the historical trade volume, the more likely the bridge will succeed.',
                      },
                    ],
                  });
                }}>
                <RcIcHelp color={colors2024['neutral-secondary']} />
              </TouchableOpacity>
            </View>
          </View>
        }
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

export default TokenSelect;
