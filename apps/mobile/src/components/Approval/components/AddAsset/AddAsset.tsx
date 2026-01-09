import { RcIconInfoFillCC } from '@/assets/icons/common';
import {
  CopyAddressIcon,
  CopyAddressIconType,
} from '@/components/AddressViewer/CopyAddress';
import { AssetAvatar } from '@/components/AssetAvatar';
import { Button } from '@/components/Button';
import { ChainIconFastImage } from '@/components/Chain/ChainIconImage';
import { AppBottomSheetModalTitle } from '@/components/customized/BottomSheet';
import { NotFoundHolder } from '@/components/EmptyHolder/NotFound';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { Tip } from '@/components/Tip';
import { HistoryItem } from '@/components/TokenDetailPopup/HistoryItem';
import { SkeletonHistoryListOfTokenDetail } from '@/components/TokenDetailPopup/Skeleton';
import TouchableView from '@/components/Touchable/TouchableView';
import { Chain, CHAINS_ENUM } from '@/constant/chains';
import { ModalLayouts } from '@/constant/layout';
import { apiCustomTestnet } from '@/core/apis';
import { openapi } from '@/core/request';
import { dappService, preferenceService } from '@/core/services';
import { CustomTestnetToken } from '@/core/services/customTestnetService';
import { Account, Token } from '@/core/services/preference';
import { useThemeStyles } from '@/hooks/theme';
import { useApproval } from '@/hooks/useApproval';
import { ellipsisAddress } from '@/utils/address';
import { findChain } from '@/utils/chain';
import { formatUsdValue } from '@/utils/number';
import { createGetStyles } from '@/utils/styles';
import { ellipsisOverflowedText } from '@/utils/text';
import { getTokenSymbol } from '@/utils/token';
import { formatTokenAmount } from '@debank/common';
import {
  BottomSheetFlatList,
  BottomSheetFlatListMethods,
} from '@gorhom/bottom-sheet';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import {
  TokenItem,
  TxDisplayItem,
  TxHistoryItem,
  TxHistoryResult,
} from '@rabby-wallet/rabby-api/dist/types';
import { useMemoizedFn, useMount } from 'ahooks';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Dimensions,
  StyleSheet,
  Text,
  View,
} from 'react-native';

interface AddAssetProps {
  data: {
    type: string;
    options: {
      address: string;
      symbol: string;
      decimals: number;
      image: string;
    };
  };
  session: {
    origin: string;
    icon: string;
    name: string;
  };
}

interface TokenHistoryItem extends TxHistoryItem {
  projectDict: TxHistoryResult['project_dict'];
  cateDict: TxHistoryResult['cate_dict'];
  tokenDict: TxHistoryResult['token_dict'];
}

export const AddAsset = ({
  params,
  account,
}: {
  params: AddAssetProps;
  account: Account;
}) => {
  // const wallet = useWallet();
  const [, resolveApproval, rejectApproval] = useApproval();
  const { t } = useTranslation();
  const { styles, colors } = useThemeStyles(getStyles);
  const [tokens, setTokens] = useState<TokenItem[]>([]);
  const [token, setToken] = useState<TokenItem | null>(null);
  const [chainSelectorVisible, setChainSelectorVisible] = useState(false);
  const [tokenHistory, setTokenHistory] = useState<TokenHistoryItem[]>([]);
  const [isTokenHistoryLoaded, setIsTokenHistoryLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [customTokens, setCustomTokens] = useState<Token[]>([]);
  const [currentChain, setCurrentChain] = useState<Chain | null | undefined>(
    null,
  );
  const [customTestnetToken, setCustomTestnetToken] =
    useState<CustomTestnetToken | null>(null);
  const [isCustomTestnetTokenAdded, setIsCustomTestnetTokenAdded] =
    useState(false);

  const copyAddressIconRef = React.useRef<CopyAddressIconType>(null);
  const copyAddressIconRef1 = React.useRef<CopyAddressIconType>(null);

  const addButtonStatus = useMemo(() => {
    if (customTestnetToken) {
      if (isCustomTestnetTokenAdded) {
        return {
          disable: true,
          reason: t('page.addToken.hasAdded'),
        };
      }
      return {
        disable: false,
        reason: '',
      };
    }
    if (!token)
      return {
        disable: true,
        reason: t('page.addToken.noTokenFound'),
      };
    if (token?.is_core) {
      return {
        disable: true,
        reason: t('page.addToken.tokenSupported'),
      };
    }
    const isCustom = customTokens.some(
      t => isSameAddress(t.address, token.id) && token.chain === t.chain,
    );
    if (isCustom) {
      return {
        disable: true,
        reason: t('page.addToken.tokenCustomized'),
      };
    }
    return {
      disable: false,
      reason: '',
    };
  }, [customTestnetToken, token, t, customTokens, isCustomTestnetTokenAdded]);

  const supportChains = useMemo(() => {
    const chains: CHAINS_ENUM[] = [];
    tokens.forEach(token => {
      const targetChain = findChain({
        serverId: token.chain,
      });
      if (targetChain) {
        chains.push(targetChain.enum);
      }
    });
    return chains;
  }, [tokens]);

  const handleChainChanged = useMemoizedFn((id: CHAINS_ENUM) => {
    const chain = findChain({ enum: id });
    if (chain) {
      const t = tokens.find(token => token.chain === chain.serverId);
      if (t) {
        setToken(t);
      }
    }
    setChainSelectorVisible(false);
  });

  const hasSelectedChain = useRef(false);
  const activeSelectChainPopup = useMemoizedFn(() => {
    const id = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.SELECT_CHAIN_WITH_SUMMARY,
      supportChains: supportChains,
      hideTestnetTab: true,
      onChange: (v: CHAINS_ENUM) => {
        hasSelectedChain.current = true;
        handleChainChanged?.(v);
        removeGlobalBottomSheetModal2024(id);
      },
      account,

      bottomSheetModalProps: {
        onDismiss() {
          if (!hasSelectedChain.current) {
            rejectApproval('User rejected the request.');
          }
        },
        backgroundStyle: {
          backgroundColor: colors['neutral-bg-1'],
        },
      },
    });
  });

  // console.log(token, customTokens, customTestnetToken, params);
  const init = useMemoizedFn(async () => {
    const site = await dappService.getDapp(params.session.origin);
    const chain = findChain({
      enum: site?.chainId,
    });
    setCurrentChain(chain);
    if (chain?.isTestnet) {
      if (account) {
        const { address } = params.data.options;
        const isAdded = await apiCustomTestnet.isAddedCustomTestnetToken({
          id: address,
          chainId: chain.id,
        });
        const result = await apiCustomTestnet.getCustomTestnetToken({
          chainId: chain.id,
          address: account?.address,
          tokenId: address,
        });
        setCustomTestnetToken(result);
        setIsCustomTestnetTokenAdded(isAdded);
      }
    } else {
      const customTokens = await preferenceService.getCustomizedToken();
      if (account) {
        const { address } = params.data.options;
        const result = await openapi.searchToken(
          account.address,
          address,
          undefined,
          true,
        );
        setTokens(result);
        if (result.length === 1) {
          setToken(result[0]);
        }
        if (result.length > 1) {
          setChainSelectorVisible(true);
          activeSelectChainPopup();
        }
        const token = result[0];
        if (token) {
          const target = findChain({
            serverId: token.chain,
          });
          setCurrentChain(target || findChain({ enum: CHAINS_ENUM.ETH })!);
        }
      }
      setCustomTokens(customTokens);
    }

    setIsLoading(false);
  });

  const getTokenHistory = useMemoizedFn(async (token: TokenItem) => {
    const currentAccount = account;
    if (!currentAccount) {
      return;
    }
    const history = await openapi.listTxHisotry({
      id: currentAccount.address,
      chain_id: token.chain,
      page_count: 10,
      token_id: token.id,
    });
    const { project_dict, cate_dict, token_dict, history_list: list } = history;
    const displayList = list
      .map(item => ({
        ...item,
        projectDict: project_dict,
        cateDict: cate_dict,
        tokenDict: token_dict,
      }))
      .sort((v1, v2) => v2.time_at - v1.time_at);
    setTokenHistory(displayList);
    setIsTokenHistoryLoaded(true);
  });

  const handleConfirm = useMemoizedFn(() => {
    if (token) {
      resolveApproval({
        id: token.id,
        chain: token.chain,
        symbol: token.symbol,
        decimals: token.decimals,
        chainId: currentChain?.id || '',
      });
    } else if (customTestnetToken) {
      resolveApproval({
        id: customTestnetToken.id,
        chain: currentChain?.serverId || '',
        symbol: customTestnetToken.symbol,
        decimals: customTestnetToken.decimals,
        chainId: currentChain?.id || '',
      });
    }
  });
  useMount(() => {
    init();
  });

  useEffect(() => {
    if (token) {
      getTokenHistory(token);
    }
  }, [getTokenHistory, token]);

  useEffect(() => {
    if (customTestnetToken) {
      setIsTokenHistoryLoaded(true);
    }
  }, [customTestnetToken]);

  const historyListRef = useRef<BottomSheetFlatListMethods>(null);

  const renderItem = useCallback(({ item }: { item: TxDisplayItem }) => {
    return (
      <HistoryItem
        data={item}
        // canClickToken={!isLoadingFirst && canClickToken}
        projectDict={item.projectDict}
        cateDict={item.cateDict}
        tokenDict={item.tokenDict || {}}
      />
    );
  }, []);

  const keyExtractor = useCallback((item: TxDisplayItem) => {
    return `${item.chain}/${item.cate_id}/${item.id}/${item.time_at || '-'}`;
  }, []);

  const ListEmptyComponent = React.useMemo(() => {
    return isLoading ? (
      <SkeletonHistoryListOfTokenDetail />
    ) : (
      <View style={[styles.emptyHolderContainer]}>
        <NotFoundHolder
          text={t('page.dashboard.tokenDetail.noTransactions')}
          iconSize={52}
          colorVariant="foot"
        />
      </View>
    );
  }, [isLoading, styles.emptyHolderContainer, t]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!token && !customTestnetToken && !isLoading && !chainSelectorVisible) {
    return (
      <View style={styles.tokenNotFound}>
        <View style={styles.tokenNotFoundMain}>
          {/* <img src={IconWarning} className="icon icon-warning" /> */}
          <RcIconInfoFillCC color={colors['neutral-line']} />
          <Text style={styles.tokenNotFoundText}>
            {t('page.addToken.tokenNotFound')}
          </Text>
        </View>
        <View style={styles.tokenNotFoundFooter}>
          <Button
            title={t('global.ok')}
            type="primary"
            containerStyle={{ width: '100%' }}
            onPress={() => rejectApproval('User rejected the request.')}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppBottomSheetModalTitle
        title={t('page.addToken.title')}
        style={{ paddingTop: ModalLayouts.titleTopOffset }}
      />
      <View style={styles.main}>
        <View>
          {token ? (
            <>
              <View style={[styles.tokenDetailHeaderWrap]}>
                <View style={styles.tokenDetailHeaderF1}>
                  <AssetAvatar
                    logo={token?.logo_url}
                    // chain={token?.chain}
                    // chainSize={16}
                    style={[styles.tokenDetailHeaderLogo]}
                    // size={SIZES.headerTokenLogo}
                  />

                  <Text style={[styles.tokenSymbol]}>
                    {ellipsisOverflowedText(getTokenSymbol(token), 8)}
                  </Text>
                  <View style={styles.tokenAddrInfo}>
                    <ChainIconFastImage
                      style={styles.tokenChainIcon}
                      size={14}
                      chainServerId={token.chain}
                    />

                    {token.id && (
                      <TouchableView
                        style={[styles.tokenAddressWrapper]}
                        onPress={evt => {
                          copyAddressIconRef.current?.doCopy(evt);
                        }}>
                        <Text style={[styles.tokenAddressText]}>
                          {ellipsisAddress(token.id)}
                        </Text>
                        <CopyAddressIcon
                          ref={copyAddressIconRef}
                          address={token.id}
                          style={styles.copyIcon}
                        />
                      </TouchableView>
                    )}
                  </View>
                </View>

                <View style={styles.tokenDetailHeaderF2}>
                  <Text style={styles.balanceTitle}>
                    {getTokenSymbol(token)} {t('page.newAddress.hd.balance')}
                  </Text>
                  <View style={styles.tokenDetailHeaderF2Inner}>
                    <View style={styles.tokenDetailHeaderUsdValueWrap}>
                      <Text style={styles.tokenDetailHeaderAmount}>
                        {formatTokenAmount(token.amount)}
                      </Text>
                      <Text
                        style={[
                          styles.aboutEqual,
                          styles.tokenDetailHeaderUsdValue,
                        ]}>
                        ≈
                      </Text>
                      <Text style={styles.tokenDetailHeaderUsdValue}>
                        {formatUsdValue(token.usd_value || 0)}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </>
          ) : customTestnetToken ? (
            <>
              <View style={[styles.tokenDetailHeaderWrap]}>
                <View style={styles.tokenDetailHeaderF1}>
                  <AssetAvatar
                    // logo={token?.logo_url}
                    // chain={token?.chain}
                    // chainSize={16}
                    style={[styles.tokenDetailHeaderLogo]}
                    // size={SIZES.headerTokenLogo}
                  />

                  <Text style={[styles.tokenSymbol]}>
                    {ellipsisOverflowedText(
                      getTokenSymbol(customTestnetToken),
                      8,
                    )}
                  </Text>
                  <View style={styles.tokenAddrInfo}>
                    <ChainIconFastImage
                      style={styles.tokenChainIcon}
                      size={14}
                      chainServerId={
                        findChain({ id: customTestnetToken.chainId })?.serverId
                      }
                    />

                    {customTestnetToken.id && (
                      <TouchableView
                        style={[styles.tokenAddressWrapper]}
                        onPress={evt => {
                          copyAddressIconRef1.current?.doCopy(evt);
                        }}>
                        <Text style={[styles.tokenAddressText]}>
                          {ellipsisAddress(customTestnetToken.id)}
                        </Text>
                        <CopyAddressIcon
                          ref={copyAddressIconRef1}
                          address={customTestnetToken.id}
                          style={styles.copyIcon}
                        />
                      </TouchableView>
                    )}
                  </View>
                </View>

                <View style={styles.tokenDetailHeaderF2}>
                  <Text style={styles.balanceTitle}>
                    {getTokenSymbol(customTestnetToken)}{' '}
                    {t('page.newAddress.hd.balance')}
                  </Text>
                  <View style={styles.tokenDetailHeaderF2Inner}>
                    <View style={styles.tokenDetailHeaderUsdValueWrap}>
                      <Text style={styles.tokenDetailHeaderAmount}>
                        {formatTokenAmount(customTestnetToken.amount)}
                      </Text>
                      <Text
                        style={[
                          styles.aboutEqual,
                          styles.tokenDetailHeaderUsdValue,
                        ]}>
                        ≈
                      </Text>
                      <Text style={styles.tokenDetailHeaderUsdValue}>
                        {formatUsdValue(0)}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </>
          ) : null}
        </View>
        {isTokenHistoryLoaded ? (
          <BottomSheetFlatList
            ref={historyListRef}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            ListEmptyComponent={ListEmptyComponent}
            data={tokenHistory}
            style={styles.scrollView}
          />
        ) : null}
      </View>
      <View style={styles.footer}>
        <Button
          type="primary"
          ghost
          containerStyle={{ width: 172, flex: 1, minWidth: 0 }}
          title={t('global.cancelButton')}
          onPress={() => rejectApproval()}
        />

        <Tip
          content={addButtonStatus.reason}
          pressableProps={{
            style: {
              width: 172,
              flex: 1,
              minWidth: 0,
            },
          }}>
          <Button
            type="primary"
            // style={{ width: '100%' }}
            // containerStyle={{ width: '100%' }}
            title={t('global.addButton')}
            disabled={addButtonStatus.disable}
            onPress={handleConfirm}
          />
        </Tip>
      </View>
    </View>
  );
};

const getStyles = createGetStyles(colors => {
  return {
    container: {
      height: '100%',
      position: 'relative',
      flexDirection: 'column',
    },
    tokenDetailHeaderWrap: {
      // height: SIZES.headerHeight,
      width: '100%',
      paddingVertical: 4,
      alignItems: 'flex-start',
    },
    tokenDetailHeaderF1: {
      flexDirection: 'row',
      justifyContent: 'flex-start',
      alignItems: 'center',
      paddingVertical: 0,
      // ...makeDebugBorder(),
    },
    tokenDetailHeaderLogo: {
      width: 24,
      height: 24,
      marginRight: 8,
    },
    tokenSymbol: {
      color: colors['neutral-title-1'],
      fontSize: 20,
      lineHeight: 24,
      fontWeight: '500',
    },
    tokenAddrInfo: {
      marginLeft: 8,
      paddingVertical: 5,
      paddingHorizontal: 8,
      backgroundColor: colors['neutral-card2'],
      borderRadius: 4,

      flexDirection: 'row',
      alignItems: 'center',

      color: colors['neutral-foot'],
    },
    tokenChainIcon: {
      width: 14,
      height: 14,
    },
    tokenChainNameText: {
      color: colors['neutral-foot'],
      fontSize: 12,
      fontWeight: '400',

      marginLeft: 6,
    },
    tokenAddressWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    tokenAddressText: {
      color: colors['neutral-foot'],
      fontSize: 12,
      fontWeight: '400',

      marginHorizontal: 6,
    },
    copyIcon: {
      height: '100%',
      // ...makeDebugBorder(),
    },
    tokenDetailHeaderF2: {
      width: '100%',
      position: 'relative',
      flexDirection: 'column',
      // alignItems: 'center',
      marginTop: 16,
      marginBottom: 0,
    },
    balanceTitle: {
      color: colors['neutral-foot'],
      fontSize: 14,
      lineHeight: 17,
      fontWeight: '400',
      marginBottom: 5,
    },
    tokenDetailHeaderF2Inner: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    tokenDetailHeaderUsdValueWrap: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    tokenDetailHeaderAmount: {
      textAlign: 'left',
      color: colors['neutral-title-1'],
      fontSize: 24,
      lineHeight: 29,
      fontWeight: '700',
    },
    aboutEqual: {
      marginLeft: 6,
    },
    tokenDetailHeaderUsdValue: {
      textAlign: 'right',
      color: colors['neutral-foot'],
      fontSize: 14,
      lineHeight: 17,
      fontWeight: '400',
      position: 'relative',
      top: 2,
    },
    tokenDetailHeaderPrice: {
      marginTop: 2,
      color: colors['neutral-foot'],
      fontSize: 13,
      fontWeight: '400',
    },
    tokenDetailHeaderChange: {
      fontSize: 10,
      fontWeight: '500',
    },
    main: {
      flex: 1,
      paddingHorizontal: 20,
      flexDirection: 'column',
    },

    footer: {
      width: '100%',
      maxWidth: Dimensions.get('window').width,
      display: 'flex',
      flexDirection: 'row',
      gap: 16,
      justifyContent: 'space-between',
      borderTopColor: colors['neutral-line'],
      borderTopWidth: StyleSheet.hairlineWidth,
      paddingTop: 20,
      paddingHorizontal: 20,
      paddingBottom: 35,
    },
    scrollView: {
      flex: 1,
      height: '100%',
    },
    emptyHolderContainer: {
      // ...makeDebugBorder('yellow'),
      paddingTop: 150,
      height: '100%',
      maxHeight: '100%',
      flexShrink: 1,
    },
    tokenNotFound: {
      height: '100%',
      flexDirection: 'column',
      alignItems: 'center',
    },
    tokenNotFoundMain: {
      paddingTop: 140,
      flex: 1,
      flexDirection: 'column',
      alignItems: 'center',
    },
    tokenNotFoundText: {
      fontSize: 14,
      lineHeight: 17,
      color: colors['neutral-body'],
      marginTop: 40,
    },
    tokenNotFoundFooter: {
      width: '100%',
      maxWidth: Dimensions.get('window').width,
      display: 'flex',
      flexDirection: 'row',
      gap: 16,
      justifyContent: 'space-between',
      borderTopColor: colors['neutral-line'],
      borderTopWidth: StyleSheet.hairlineWidth,
      paddingTop: 20,
      paddingHorizontal: 20,
      paddingBottom: 35,
    },
    loadingContainer: {
      flexDirection: 'row',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
    },
  };
});
