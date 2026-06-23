import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  GestureResponderEvent,
  StyleProp,
  StyleSheet,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';

import { RcIconAddCircle } from '@/assets/icons/address';
import { RcArrowDownCC } from '@/assets/icons/common';
import { AssetAvatar } from '@/components/AssetAvatar';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import type { KeyringAccountWithAlias } from '@/hooks/account';
import { AccountOverview } from '@/screens/Home/components/AccountOverview';
import { createGetStyles2024 } from '@/utils/styles';
import { getTokenSymbol } from '@/utils/token';
import { formatAmount } from '@/utils/number';

import type {
  CustomTestnetAssetSectionData,
  LoadCustomTestnetAssetTokens,
} from './types';
import type { ITokenItem } from '@/types/assets';

type CustomTestnetAssetSectionProps = {
  data: CustomTestnetAssetSectionData;
  style?: StyleProp<ViewStyle>;
  tokenButtonLabel: string;
  loadTokens: LoadCustomTestnetAssetTokens;
  getAccountByAddress(address?: string): KeyringAccountWithAlias | undefined;
  onTokenPress(token: ITokenItem): void;
  onTokenButtonPress?(data: CustomTestnetAssetSectionData): void;
};

const TOKEN_PREVIEW_LIMIT = 3;

const formatTokenCount = (count: number) => {
  return count > 99 ? '99+' : String(count);
};

const ChainInitialBadge = memo(
  ({ name, size = 18 }: { name: string; size?: number }) => {
    const { styles } = useTheme2024({ getStyle });
    const label = name.substring(0, 3).replace(/\s/g, '').toUpperCase();

    return (
      <View
        style={[
          styles.chainInitialBadge,
          { width: size, height: size, borderRadius: size / 3 },
        ]}>
        <Text style={styles.chainInitialText}>{label}</Text>
      </View>
    );
  },
);

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

const CustomTestnetTokenRow = memo(
  ({
    token,
    account,
    onPress,
  }: {
    token: ITokenItem;
    account?: KeyringAccountWithAlias;
    onPress(token: ITokenItem): void;
  }) => {
    const { styles } = useTheme2024({ getStyle });
    const handlePress = useCallback(() => onPress(token), [onPress, token]);

    return (
      <TouchableOpacity style={styles.tokenRow} onPress={handlePress}>
        <AssetAvatar
          logo={token.logo_url}
          chain={token.chain}
          size={46}
          chainSize={18}
          style={styles.tokenAvatar}
        />
        <View style={styles.tokenContent}>
          <View style={styles.tokenInfo}>
            <Text numberOfLines={1} style={styles.tokenSymbol}>
              {getTokenSymbol(token)}
            </Text>
            {account ? (
              <AccountOverview
                account={account}
                logoSize={14}
                textStyle={styles.accountText}
              />
            ) : null}
          </View>
          <Text numberOfLines={1} style={styles.tokenBalance}>
            {formatAmount(token.amount, 4, true)}
          </Text>
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
    getAccountByAddress,
    onTokenPress,
    onTokenButtonPress,
  }: CustomTestnetAssetSectionProps) => {
    const { styles, colors2024 } = useTheme2024({ getStyle });
    const [expanded, setExpanded] = useState(false);
    const [tokens, setTokens] = useState<ITokenItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasLoaded, setHasLoaded] = useState(false);
    const requestSeqRef = useRef(0);

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
          setLoading(false);
        });

      return () => {
        cancelled = true;
      };
    }, [data.chain.id, expanded, hasLoaded, loadTokens]);

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
            <RcArrowDownCC
              width={16}
              height={16}
              color={colors2024['neutral-foot']}
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
              <RcIconAddCircle
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
            {loading && !tokens.length ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator
                  color={colors2024['neutral-secondary']}
                  size="small"
                />
              </View>
            ) : (
              tokens.map(token => (
                <CustomTestnetTokenRow
                  key={`${token.owner_addr}-${token.chain}-${token.id}`}
                  token={token}
                  account={getAccountByAddress(token.owner_addr)}
                  onPress={onTokenPress}
                />
              ))
            )}
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
    chainInitialBadge: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors2024['neutral-foot'],
      borderWidth: 1.7,
      borderColor: colors2024['neutral-bg-1'],
      overflow: 'hidden',
    },
    chainInitialText: {
      color: colors2024['neutral-InvertHighlight'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 6.8,
      lineHeight: 9,
      fontWeight: '700',
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
    loadingRow: {
      height: 74,
      alignItems: 'center',
      justifyContent: 'center',
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
  }),
);
