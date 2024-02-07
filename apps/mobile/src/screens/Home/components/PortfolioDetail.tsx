import React, { useMemo } from 'react';
import { StyleSheet, View, Text, ViewStyle } from 'react-native';
import { colord } from 'colord';
import LinearGradient from 'react-native-linear-gradient';
import groupBy from 'lodash/groupBy';
import { RcIconInfoCC } from '@/assets/icons/common';

import { AssetAvatar, Tip } from '@/components';
import { useThemeColors } from '@/hooks/theme';
import { formatNetworth } from '@/utils/math';
import { getTokenSymbol } from '@/utils/token';
import {
  PortfolioItemToken,
  PortfolioItemNft,
  NftCollection,
} from '@rabby-wallet/rabby-api/dist/types';
import { AbstractPortfolio } from '../types';
import { AppColorsVariants } from '@/constant/theme';
import { formatAmount } from '@/utils/number';

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
  const colors = useThemeColors();
  const styles = getStyle(colors);

  const usdChangeStyle = useMemo(
    () =>
      StyleSheet.flatten([
        styles.tokenRowChange,
        {
          color: data.netWorthChange
            ? data.netWorthChange < 0
              ? colors['red-default']
              : colors['green-default']
            : colors['blue-default'],
        },
      ]),
    [data, colors, styles.tokenRowChange],
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
  const colors = useThemeColors();
  const styles = getStyle(colors);

  const headers = [name, 'AMOUNT', 'USD VALUE'];

  const _tokens: TokenItem[] = useMemo(() => {
    return (tokens ?? [])
      .map(x => {
        const _netWorth = x.amount * x.price || 0;

        return {
          id: x.id,
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
          <View style={[styles.tokenRow, styles.tokenRowToken]} key={l.id}>
            <View style={[styles.tokenListCol, styles.tokenListSymbol]}>
              <AssetAvatar
                logo={l._logo}
                logoStyle={l.isToken ? undefined : styles.nftIcon}
                size={22}
              />
              <Text style={styles.tokenListSymbolText} numberOfLines={1}>
                {l._symbol}
              </Text>
            </View>
            <Text style={styles.tokenListCol}>{formatAmount(l.amount)}</Text>
            <View
              style={StyleSheet.flatten([
                styles.tokenListCol,
                styles.flexCenter,
                styles.flexRight,
                styles.alignRight,
              ])}>
              <Text>{l._netWorthStr}</Text>
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
          </View>
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
  const colors = useThemeColors();
  const styles = getStyle(colors);

  const list = useMemo(
    () => data?.filter((x): x is SupplementType => !!x),
    [data],
  );

  const linearColors = useMemo(() => {
    return [
      colord(colors['blue-default']).alpha(0.1).toRgbString(),
      colord(colors['neutral-title-2']).alpha(0).toRgbString(),
    ];
  }, [colors]);

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

const getStyle = (colors: AppColorsVariants) =>
  StyleSheet.create({
    portfolioHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
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
      backgroundColor: colors['blue-light-1'],
    },
    portfolioTypeText: {
      fontSize: 13,
      fontWeight: '500',
      color: colors['blue-default'],
      lineHeight: 20,
    },
    portfolioDesc: {
      marginLeft: 8,
      fontSize: 13,
      fontWeight: '700',
      color: colors['neutral-title-1'],
      flexShrink: 1,
    },
    portfolioNetWorth: {
      fontSize: 13,
      fontWeight: '500',
      color: colors['neutral-title-1'],
      textAlign: 'right',
    },
    tokenRowChange: {
      fontSize: 10,
      fontWeight: '500',
      textAlign: 'right',
    },

    // tokenlist
    tokenList: {
      marginTop: 8,
    },
    tokenRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    tokenRowToken: {
      height: 40,
    },
    tokenRowHeader: {
      marginBottom: 8,
      marginTop: 18,
    },
    tokenListHeader: {
      flexBasis: '35%',
      flexGrow: 1,
      fontSize: 12,
      fontWeight: '400',
      color: colors['neutral-foot'],
    },
    tokenListCol: {
      flexBasis: '35%',
      flexGrow: 1,
      fontSize: 13,
      fontWeight: '500',
      color: colors['neutral-title-1'],
    },
    tokenListSymbol: {
      flexDirection: 'row',
      alignItems: 'center',
      flexShrink: 1,
    },
    tokenListSymbolText: {
      paddingLeft: 8,
      paddingRight: 4,
      fontSize: 13,
      fontWeight: '500',
      color: colors['neutral-title-1'],
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
      color: colors['neutral-foot'],
    },
    fieldContent: {
      marginLeft: 8,
      fontSize: 12,
      fontWeight: '400',
      color: colors['blue-default'],
    },
    nftIcon: {
      borderRadius: 4,
    },
    nftIconInfo: {
      marginLeft: 4,
    },
  });

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
