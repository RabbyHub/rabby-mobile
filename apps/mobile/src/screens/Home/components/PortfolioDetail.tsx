import React, { useEffect, useMemo, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ViewStyle,
  TouchableWithoutFeedback,
  Animated,
  Easing,
} from 'react-native';
import { colord } from 'colord';
import LinearGradient from 'react-native-linear-gradient';
import groupBy from 'lodash/groupBy';
import { RcIconInfoCC, RcIconRightCC } from '@/assets/icons/common';
import { toast, toastWithIcon } from '@/components2024/Toast';
import { AssetAvatar, Tip } from '@/components';
import { useTheme2024 } from '@/hooks/theme';
import { formatNetworth } from '@/utils/math';
import { getTokenSymbol } from '@/utils/token';
import {
  PortfolioItemToken,
  PortfolioItemNft,
  NftCollection,
} from '@rabby-wallet/rabby-api/dist/types';
import { AbstractPortfolio, AbstractPortfolioToken } from '../types';
import { formatAmount } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import { navigate, naviPush } from '@/utils/navigation';
import { RootNames } from '@/constant/layout';
import { useAssets } from '@/screens/Search/useAssets';
import { useRoute } from '@react-navigation/native';
import { ensureAbstractPortfolioToken } from '../utils/token';
import { GetRootScreenNavigationProps } from '@/navigation-type';

export const PortfolioHeader = ({
  data,
  name,
  showDescription,
  showHistory,
}: {
  data: AbstractPortfolio;
  name: string;
  showDescription?: boolean;
  showHistory?: boolean;
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });

  const usdChangeStyle = useMemo(
    () =>
      StyleSheet.flatten([
        styles.tokenRowChange,
        {
          color: data.netWorthChange
            ? data.netWorthChange < 0
              ? colors2024['red-default']
              : colors2024['green-default']
            : colors2024['blue-default'],
        },
      ]),
    [styles.tokenRowChange, data.netWorthChange, colors2024],
  );

  return (
    <View style={styles.portfolioHeader}>
      <View style={styles.portfolioTypeDesc}>
        <View style={styles.portfolioType}>
          <Text style={styles.portfolioTypeText}>{name}</Text>
        </View>
        {showDescription ? (
          <Text style={styles.portfolioDesc} numberOfLines={1}>
            {data?._originPortfolio?.detail?.description || ''}
          </Text>
        ) : null}
      </View>
      <View>
        <Text style={styles.portfolioNetWorth}>{data._netWorth}</Text>
        {showHistory ? (
          <Text style={usdChangeStyle}>
            {data._netWorthChange !== '-'
              ? `${data._changePercentStr} (${data._netWorthChange})`
              : '-'}
          </Text>
        ) : null}
      </View>
    </View>
  );
};

type TokenItem = {
  id: string;
  chain: string;
  _logo: string;
  amount: number;
  _symbol: string;
  _amount: string;
  _netWorth: number;
  _netWorthStr: string;
  isToken?: boolean;
  tip?: string;
};

export const TokenList = ({
  name,
  tokens,
  style,
  nfts,
  fraction,
}: {
  name: string;
  tokens?: PortfolioItemToken[];
  style?: ViewStyle;
  nfts?: PortfolioItemNft[];
  fraction?: {
    collection: NftCollection;
    value: number;
    shareToken: PortfolioItemToken;
  };
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const route = useRoute<GetRootScreenNavigationProps<'DeFiDetail'>['route']>();
  const { relateTokenId, isSingleAddress } = route.params || {};

  const [highlightAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    Animated.sequence([
      Animated.timing(highlightAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: false,
      }),
      Animated.timing(highlightAnim, {
        toValue: 0.5,
        duration: 1000,
        useNativeDriver: false,
      }),
      Animated.timing(highlightAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: false,
      }),
      Animated.timing(highlightAnim, {
        toValue: 0.5,
        duration: 1000,
        useNativeDriver: false,
      }),
      Animated.timing(highlightAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: false,
      }),
    ]).start();
  }, [highlightAnim]);

  const backgroundColor = highlightAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [
      'transparent',
      colors2024['brand-light-1'],
      'rgba(112, 132, 255, 0.04)',
    ],
  });

  const headers = [name, 'amount', 'USD Value'];

  const _tokens: TokenItem[] = useMemo(() => {
    return (tokens ?? [])
      .map(x => {
        const _netWorth = x.amount * x.price || 0;

        return {
          id: x.id,
          chain: x.chain,
          amount: x.amount,
          _logo: x.logo_url,
          _symbol: getTokenSymbol(x),
          _amount: formatAmount(x.amount),
          _netWorth: _netWorth,
          _netWorthStr: formatNetworth(_netWorth),
          isToken: true,
        };
      })
      .sort((m, n) => n._netWorth - m._netWorth);
  }, [tokens]);

  const _nfts: TokenItem[] = useMemo(() => {
    return polyNfts(nfts ?? []).map(n => {
      const floorToken = n.collection.floor_price_token;
      const _netWorth = floorToken
        ? floorToken.amount * floorToken.price * n.amount
        : 0;
      const _symbol = getCollectionDisplayName(n.collection);

      return {
        id: n.id,
        chain: n.collection.chain_id,
        _logo: n.collection.logo_url,
        _symbol,
        amount: n.amount,
        _amount: `${_symbol} x${n.amount}`,
        _netWorth,
        _netWorthStr: _netWorth ? formatNetworth(_netWorth) : '-',
        tip: _netWorth
          ? 'Calculated based on the floor price recognized by this protocol.'
          : '',
      };
    });
  }, [nfts]);

  const _fraction: TokenItem | null = useMemo(() => {
    return fraction
      ? {
          id: `fraction${
            fraction.collection.id + fraction.collection.chain_id
          }`,
          chain: fraction.collection.chain_id,
          _logo: fraction.collection.logo_url,
          _symbol: getCollectionDisplayName(fraction.collection),
          amount: fraction.shareToken.amount,
          _amount: `${formatAmount(
            fraction.shareToken.amount,
          )} ${getTokenSymbol(fraction.shareToken)}`,
          _netWorth: fraction.value,
          _netWorthStr: fraction.value
            ? formatNetworth(fraction.value ?? 0)
            : '-',
          tip: fraction.value
            ? 'Calculate based on the price of the linked ERC20 token.'
            : '',
        }
      : null;
  }, [fraction]);

  const list = useMemo(() => {
    const result = [_fraction, ..._nfts]
      .filter((x): x is TokenItem => !!x)
      .sort((m, n) => {
        return !m._netWorth && !n._netWorth
          ? (n.amount || 0) - (m.amount || 0)
          : (n._netWorth || 0) - (m._netWorth || 0);
      });

    result.push(..._tokens);

    return result;
  }, [_fraction, _nfts, _tokens]);

  const handleOpenTokenDetail = React.useCallback(
    (token: TokenItem) => {
      naviPush(RootNames.TokenDetail, {
        token: {
          // just need id and chain to search cache
          id: token.id,
          chain: token.chain,
          logo_url: token._logo,
          symbol: token._symbol,
          _tokenId: token.id,
        } as any, // to do fix type
        isSingleAddress,
        fromPortfolio: true,
      });
    },
    [isSingleAddress],
  );

  return list.length ? (
    <View style={StyleSheet.flatten([styles.tokenList, style])}>
      <View style={[styles.tokenRow, styles.tokenRowHeader]}>
        {headers.map((h, i) => {
          const isLast = i === headers.length - 1;

          return (
            <Text
              key={h}
              style={StyleSheet.flatten([
                styles.tokenListHeader,
                isLast && styles.alignRight,
              ])}>
              {h}
            </Text>
          );
        })}
      </View>
      {list.map(l => {
        return (
          <Animated.View
            style={[
              styles.tokenRow,
              styles.tokenRowToken,
              relateTokenId === l.id && { backgroundColor },
            ]}
            key={l.id}>
            <TouchableWithoutFeedback
              onPress={() => l.isToken && handleOpenTokenDetail(l)}>
              <View style={[styles.tokenListCol, styles.tokenListSymbol]}>
                <AssetAvatar
                  logo={l._logo}
                  logoStyle={l.isToken ? undefined : styles.nftIcon}
                  size={24}
                />
                <Text
                  style={[
                    styles.tokenListSymbolText,
                    relateTokenId === l.id && styles.tokenTextHightlight,
                  ]}
                  numberOfLines={1}>
                  {l._symbol}
                </Text>
                {l.isToken && (
                  <RcIconRightCC
                    style={styles.arrowStyle}
                    width={14}
                    height={14}
                    color={
                      relateTokenId === l.id
                        ? colors2024['brand-default']
                        : colors2024['neutral-secondary']
                    }
                  />
                )}
              </View>
            </TouchableWithoutFeedback>
            <Text style={styles.tokenListCol}>{formatAmount(l.amount)}</Text>
            <View
              style={StyleSheet.flatten([
                styles.tokenListCol,
                styles.flexCenter,
                styles.flexRight,
                styles.alignRight,
              ])}>
              <Text style={styles.tokenListColText}>{l._netWorthStr}</Text>
              {l.tip ? (
                <Tip content={l.tip}>
                  <RcIconInfoCC
                    width={12}
                    height={12}
                    style={styles.nftIconInfo}
                  />
                </Tip>
              ) : null}
            </View>
          </Animated.View>
        );
      })}
    </View>
  ) : null;
};

type SupplementType = {
  label: string;
  content: React.ReactNode;
};

type SupplementsProps = {
  data?: Array<SupplementType | undefined | false>;
};

export const Supplements = ({ data }: SupplementsProps) => {
  const { styles, colors2024, colors } = useTheme2024({ getStyle: getStyles });

  const list = useMemo(
    () => data?.filter((x): x is SupplementType => !!x),
    [data],
  );

  const linearColors = useMemo(() => {
    return [
      colord(colors['blue-default']).alpha(0.1).toRgbString(),
      colord(colors2024['neutral-title-2']).alpha(0).toRgbString(),
    ];
  }, [colors, colors2024]);

  return list?.length ? (
    <LinearGradient
      colors={linearColors}
      useAngle
      angle={90}
      style={styles.supplements}>
      {list.map(s => (
        <View style={styles.supplementField} key={s.label}>
          <Text style={styles.fieldLabel}>{s.label}</Text>
          <Text style={styles.fieldContent}>{s.content}</Text>
        </View>
      ))}
    </LinearGradient>
  ) : null;
};

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  portfolioHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  portfolioTypeDesc: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  portfolioType: {
    borderRadius: 10,
    paddingHorizontal: 8,
    height: 20,
    backgroundColor: 'rgba(112, 132, 255, 0.12)',
  },
  portfolioTypeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors2024['brand-default'],
    fontFamily: 'SF Pro Rounded',
    lineHeight: 22,
  },
  portfolioDesc: {
    marginLeft: 8,
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
    flexShrink: 1,
  },
  portfolioNetWorth: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
    textAlign: 'right',
    lineHeight: 18,
  },
  tokenRowChange: {
    fontSize: 10,
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
    textAlign: 'right',
  },

  // tokenlist
  tokenList: {
    marginTop: 8,
    // marginHorizontal: 4,
  },
  tokenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  arrowStyle: {
    marginLeft: -4,
  },
  tokenRowToken: {
    height: 40,
  },
  hightlightRow: {
    backgroundColor: 'rgba(112, 132, 255, 0.04)',
  },
  tokenRowHeader: {
    marginBottom: 8,
    marginTop: 18,
  },
  tokenListHeader: {
    // paddingHorizontal: 2,
    paddingLeft: 4,
    flexBasis: '35%',
    flexGrow: 1,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '400',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
  },
  tokenListCol: {
    flexBasis: '35%',
    flexGrow: 1,
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-foot'],
  },
  tokenListColText: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-foot'],
  },
  tokenListSymbol: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  tokenTextHightlight: {
    color: colors2024['brand-default'],
  },
  tokenListSymbolText: {
    paddingLeft: 4,
    paddingRight: 4,
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-foot'],
    flexShrink: 1,
  },
  alignRight: {
    flexBasis: '30%',
    textAlign: 'right',
  },
  flexCenter: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'row',
  },
  flexRight: {
    justifyContent: 'flex-end',
  },

  // supplements
  supplements: {
    marginTop: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  supplementField: {
    width: '50%',
    height: 34,
    flexDirection: 'row',
    alignItems: 'center',
  },
  fieldLabel: {
    paddingLeft: 10,
    fontSize: 12,
    fontWeight: '400',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-foot'],
  },
  fieldContent: {
    marginLeft: 8,
    fontSize: 12,
    fontWeight: '400',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['blue-default'],
  },
  nftIcon: {
    borderRadius: 4,
  },
  nftIconInfo: {
    marginLeft: 4,
  },
}));

export const polyNfts = (nfts: PortfolioItemNft[]) => {
  const poly = groupBy(nfts, n => n.collection.id + n.collection.chain_id);
  return Object.values(poly).map(arr => {
    const amount = arr.reduce((sum, n) => {
      sum += n.amount;
      return sum;
    }, 0);
    return { ...arr[0], amount };
  });
};

export const getCollectionDisplayName = (c?: NftCollection) =>
  c ? c.symbol || c.name : '';
