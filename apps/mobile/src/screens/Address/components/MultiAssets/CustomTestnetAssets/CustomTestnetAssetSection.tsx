import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  GestureResponderEvent,
  StyleProp,
  StyleSheet,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import { RcIconAddCircleBold } from '@/assets/icons/address';
import RcArrowDown from '@/assets/icons/custom-testnet/IconArrowDown.svg';
import { AssetAvatar } from '@/components/AssetAvatar';
import { CustomSkeleton } from '@/components2024/CustomSkeleton';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import type { KeyringAccountWithAlias } from '@/hooks/account';
import { createGetStyles2024 } from '@/utils/styles';
import { getTokenSymbol } from '@/utils/token';
import { formatAmount } from '@/utils/number';

import type {
  CustomTestnetAssetSectionData,
  CustomTestnetAssetSectionToken,
  LoadCustomTestnetAssetToken,
  LoadCustomTestnetAssetTokens,
} from './types';
import { ChainInitialBadge } from './ChainInitialBadge';
import {
  getCustomTestnetAssetGroupKey,
  getCustomTestnetTokenDisplayRows,
  getCustomTestnetTokenRowKey,
  makeMetadataTokenItem,
  type CustomTestnetTokenDisplayRow,
} from './utils';
import type { ITokenItem, TokenDisplayMode } from '@/types/assets';

type CustomTestnetAssetSectionProps = {
  data: CustomTestnetAssetSectionData;
  style?: StyleProp<ViewStyle>;
  tokenButtonLabel: string;
  loadTokens: LoadCustomTestnetAssetTokens;
  loadToken: LoadCustomTestnetAssetToken;
  getAccountByAddress(address?: string): KeyringAccountWithAlias | undefined;
  tokenDisplayMode: TokenDisplayMode;
  hideAccount?: boolean;
  renderAccount?(
    account: KeyringAccountWithAlias,
    textStyle: TextStyle,
  ): React.ReactNode;
  onTokenPress(token: ITokenItem): void;
  onTokenGroupPress?(tokens: ITokenItem[]): void;
  onTokenButtonPress?(data: CustomTestnetAssetSectionData): void;
};

const TOKEN_PREVIEW_LIMIT = 3;

const formatTokenCount = (count: number) => {
  return count > 99 ? '99+' : String(count);
};

const getSectionTokenKey = (token: CustomTestnetAssetSectionToken) =>
  `${token.chainId}:${token.id.toLowerCase()}`;

const getTokenItemKey = (token: ITokenItem) =>
  `${token.chain}:${token.id.toLowerCase()}:${token.owner_addr?.toLowerCase()}`;

const TokenPreviewStack = memo(
  ({ tokens }: { tokens: CustomTestnetAssetSectionData['tokens'] }) => {
    const { styles } = useTheme2024({ getStyle });
    const previewTokens = tokens.slice(0, TOKEN_PREVIEW_LIMIT);

    return (
      <View style={styles.tokenPreviewStack}>
        {previewTokens.map((token, index) => (
          <AssetAvatar
            key={`${token.chainId}-${token.id}-${index}`}
            size={17}
            chain={false}
            style={[styles.tokenPreview, index > 0 && styles.tokenPreviewPile]}
          />
        ))}
      </View>
    );
  },
);

const TokenBalanceSkeleton = memo(() => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const Linear = useCallback(() => {
    return (
      <LinearGradient
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.balanceSkeletonLinear}
        colors={[colors2024['neutral-bg-1'], colors2024['neutral-line']]}
      />
    );
  }, [colors2024, styles.balanceSkeletonLinear]);

  return (
    <CustomSkeleton
      animation="wave"
      LinearGradientComponent={Linear}
      style={styles.balanceSkeleton}
    />
  );
});

const CustomTestnetTokenRow = memo(
  ({
    row,
    account,
    renderAccount,
    onPress,
    onGroupPress,
  }: {
    row: CustomTestnetTokenDisplayRow & {
      balanceLoading?: boolean;
    };
    account?: KeyringAccountWithAlias;
    renderAccount?(
      account: KeyringAccountWithAlias,
      textStyle: TextStyle,
    ): React.ReactNode;
    onPress(token: ITokenItem): void;
    onGroupPress?(tokens: ITokenItem[]): void;
  }) => {
    const { styles } = useTheme2024({ getStyle });
    const handlePress = useCallback(() => {
      if (row.mode === 'group' && onGroupPress) {
        onGroupPress(row.tokens);
        return;
      }
      onPress(row.token);
    }, [onGroupPress, onPress, row]);

    return (
      <TouchableOpacity style={styles.tokenRow} onPress={handlePress}>
        <AssetAvatar
          logo={row.token.logo_url}
          chain={row.token.chain}
          size={46}
          chainSize={18}
          style={styles.tokenAvatar}
        />
        <View style={styles.tokenContent}>
          <View style={styles.tokenInfo}>
            <Text numberOfLines={1} style={styles.tokenSymbol}>
              {getTokenSymbol(row.token)}
            </Text>
            {account && renderAccount
              ? renderAccount(account, styles.accountText)
              : null}
          </View>
          {row.balanceLoading ? (
            <TokenBalanceSkeleton />
          ) : (
            <Text numberOfLines={1} style={styles.tokenBalance}>
              {formatAmount(row.token.amount, 4, true)}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  },
);

export const CustomTestnetAssetSection = memo(
  ({
    data,
    style,
    tokenButtonLabel,
    loadTokens,
    loadToken,
    getAccountByAddress,
    tokenDisplayMode,
    hideAccount,
    renderAccount,
    onTokenPress,
    onTokenGroupPress,
    onTokenButtonPress,
  }: CustomTestnetAssetSectionProps) => {
    const { styles, colors2024 } = useTheme2024({ getStyle });
    const [expanded, setExpanded] = useState(false);
    const [tokens, setTokens] = useState<ITokenItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasLoaded, setHasLoaded] = useState(false);
    const requestSeqRef = useRef(0);
    const displayRows = useMemo(
      () => getCustomTestnetTokenDisplayRows(tokens, tokenDisplayMode),
      [tokenDisplayMode, tokens],
    );
    const missingLoadedTokens = useMemo(() => {
      if (!expanded || !hasLoaded) {
        return [];
      }

      const loadedTokenKeys = new Set(
        tokens.map(token => `${data.chain.id}:${token.id.toLowerCase()}`),
      );
      return data.tokens.filter(
        token => !loadedTokenKeys.has(getSectionTokenKey(token)),
      );
    }, [data.chain.id, data.tokens, expanded, hasLoaded, tokens]);
    const rowsToRender = useMemo(() => {
      const loadedRows = displayRows;

      if (!expanded || (hasLoaded && !loading && !missingLoadedTokens.length)) {
        return loadedRows;
      }

      const loadedTokenKeys = new Set(
        tokens.map(token => `${data.chain.id}:${token.id.toLowerCase()}`),
      );
      const loadingRows = data.tokens
        .filter(token => !loadedTokenKeys.has(getSectionTokenKey(token)))
        .flatMap(token => {
          if (
            tokenDisplayMode === 'byAddress' &&
            data.ownerAddresses.length > 0
          ) {
            return data.ownerAddresses.map(ownerAddress => {
              const metadataToken = makeMetadataTokenItem(
                token,
                data.chain.serverId,
                ownerAddress,
              );

              return {
                key: getCustomTestnetTokenRowKey(metadataToken),
                token: metadataToken,
                tokens: [metadataToken],
                mode: 'token' as const,
                balanceLoading: true,
              };
            });
          }

          const metadataToken = makeMetadataTokenItem(
            token,
            data.chain.serverId,
          );

          return [
            {
              key: getCustomTestnetAssetGroupKey(metadataToken),
              token: metadataToken,
              tokens: [metadataToken],
              mode: 'token' as const,
              balanceLoading: true,
            },
          ];
        });

      return [...loadedRows, ...loadingRows];
    }, [
      data.chain.id,
      data.chain.serverId,
      data.ownerAddresses,
      data.tokens,
      displayRows,
      expanded,
      hasLoaded,
      loading,
      missingLoadedTokens.length,
      tokenDisplayMode,
      tokens,
    ]);

    const handleToggle = useCallback(() => {
      setExpanded(value => !value);
    }, []);

    const handleTokenButtonPress = useCallback(
      (event: GestureResponderEvent) => {
        event.stopPropagation();
        onTokenButtonPress?.(data);
      },
      [data, onTokenButtonPress],
    );

    useEffect(() => {
      requestSeqRef.current += 1;
      setTokens([]);
      setLoading(false);
      setHasLoaded(false);
    }, [data.chain.id]);

    useEffect(() => {
      if (!expanded || hasLoaded) {
        return;
      }

      let cancelled = false;
      const requestSeq = requestSeqRef.current + 1;
      requestSeqRef.current = requestSeq;
      setLoading(true);

      loadTokens({ chainId: data.chain.id })
        .then(nextTokens => {
          if (cancelled || requestSeqRef.current !== requestSeq) {
            return;
          }
          setTokens(nextTokens);
          setHasLoaded(true);
        })
        .catch(error => {
          console.error('Load custom testnet asset tokens failed:', error);
        })
        .finally(() => {
          if (cancelled || requestSeqRef.current !== requestSeq) {
            return;
          }
          setLoading(false);
        });

      return () => {
        cancelled = true;
      };
    }, [data.chain.id, expanded, hasLoaded, loadTokens]);

    useEffect(() => {
      if (!missingLoadedTokens.length) {
        return;
      }

      let cancelled = false;
      const requestSeq = requestSeqRef.current;

      Promise.all(
        missingLoadedTokens.map(token =>
          loadToken({
            token,
          }),
        ),
      )
        .then(tokenGroups => {
          if (cancelled || requestSeqRef.current !== requestSeq) {
            return;
          }

          const nextTokens = tokenGroups.flat();
          if (!nextTokens.length) {
            return;
          }

          setTokens(prevTokens => {
            const tokenMap = new Map<string, ITokenItem>();
            prevTokens.forEach(token => {
              tokenMap.set(getTokenItemKey(token), token);
            });
            nextTokens.forEach(token => {
              tokenMap.set(getTokenItemKey(token), token);
            });
            return Array.from(tokenMap.values());
          });
        })
        .catch(error => {
          console.error('Load custom testnet asset token failed:', error);
        });

      return () => {
        cancelled = true;
      };
    }, [loadToken, missingLoadedTokens]);

    return (
      <View style={[styles.container, style]}>
        <TouchableOpacity style={styles.header} onPress={handleToggle}>
          <View style={styles.chainInfo}>
            <ChainInitialBadge name={data.chain.name} />
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              style={styles.chainName}>
              {data.chain.name}
            </Text>
            <RcArrowDown
              color={colors2024['neutral-secondary']}
              style={expanded ? styles.caretExpanded : null}
            />
          </View>
          <View style={styles.headerRight}>
            <View style={styles.tokenCountWrap}>
              <TokenPreviewStack tokens={data.tokens} />
              <Text style={styles.tokenCount}>
                {formatTokenCount(data.tokens.length)}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.tokenButton}
              onPress={handleTokenButtonPress}
              disabled={!onTokenButtonPress}>
              <RcIconAddCircleBold
                width={13}
                height={13}
                color={colors2024['neutral-title-1']}
              />
              <Text style={styles.tokenButtonText}>{tokenButtonLabel}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
        {expanded ? (
          <View style={styles.expandedContent}>
            <View style={styles.divider} />
            {rowsToRender.map(row => (
              <CustomTestnetTokenRow
                key={row.key}
                row={row}
                account={
                  !hideAccount && row.mode === 'token'
                    ? getAccountByAddress(row.token.owner_addr)
                    : undefined
                }
                renderAccount={renderAccount}
                onPress={onTokenPress}
                onGroupPress={onTokenGroupPress}
              />
            ))}
          </View>
        ) : null}
      </View>
    );
  },
);

const getStyle = createGetStyles2024(({ colors2024 }) =>
  StyleSheet.create({
    container: {
      overflow: 'hidden',
      borderRadius: 16,
      backgroundColor: colors2024['neutral-bg-1'],
    },
    header: {
      minHeight: 56,
      paddingHorizontal: 12,
      paddingTop: 12,
      paddingBottom: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    chainInfo: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    chainName: {
      flexShrink: 1,
      color: colors2024['neutral-foot'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '500',
    },
    caretExpanded: {
      transform: [{ rotate: '180deg' }],
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    tokenCountWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    tokenPreviewStack: {
      height: 18,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 0,
    },
    tokenPreview: {
      borderWidth: 1.3,
      borderColor: colors2024['neutral-bg-1'],
      borderRadius: 18,
      backgroundColor: colors2024['neutral-line'],
      paddingHorizontal: 0,
      paddingVertical: 0,
    },
    tokenPreviewPile: {
      marginLeft: -8,
    },
    tokenCount: {
      color: colors2024['neutral-secondary'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '500',
    },
    tokenButton: {
      width: 76,
      height: 32,
      borderRadius: 8,
      paddingHorizontal: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      backgroundColor: colors2024['neutral-bg-5'],
    },
    tokenButtonText: {
      color: colors2024['neutral-title-1'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 12,
      lineHeight: 18,
      fontWeight: '700',
    },
    expandedContent: {
      width: '100%',
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors2024['neutral-line'],
    },
    tokenRow: {
      height: 74,
      paddingLeft: 12,
      paddingRight: 16,
      paddingVertical: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors2024['neutral-bg-1'],
    },
    tokenAvatar: {
      flexShrink: 0,
    },
    tokenContent: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    tokenInfo: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    tokenSymbol: {
      color: colors2024['neutral-title-1'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '700',
    },
    accountText: {
      flex: 0,
      minWidth: 0,
      maxWidth: 150,
    },
    tokenBalance: {
      flexShrink: 0,
      color: colors2024['neutral-title-1'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '700',
      textAlign: 'right',
    },
    balanceSkeleton: {
      width: 76,
      height: 20,
      borderRadius: 100,
      backgroundColor: colors2024['neutral-line'],
    },
    balanceSkeletonLinear: {
      height: '100%',
    },
  }),
);
