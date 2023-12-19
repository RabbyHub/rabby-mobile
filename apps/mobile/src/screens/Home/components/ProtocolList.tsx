import React, { useMemo, useCallback, memo, useRef } from 'react';
import {
  StyleSheet,
  View,
  ViewStyle,
  Image,
  SectionList,
  SectionListProps,
  SectionListData,
  useColorScheme,
} from 'react-native';
import { useScrollToTop } from '@react-navigation/native';
import { Tabs } from 'react-native-collapsible-tab-view';

import {
  AbstractPortfolioToken,
  AbstractProject,
  AbstractPortfolio,
} from '../types';
import { PortfolioHeader } from './PortfolioDetail';
import PortfolioTemplate from '../portfolios';
import { useThemeColors } from '@/hooks/theme';
import { PositionLoader } from './Skeleton';
import { AppColorsVariants } from '@/constant/theme';
import { AssetAvatar } from '@/components/AssetAvatar';
import { Text, Card } from '@/components';

// 已支持的模板
const TemplateDict = {
  common: PortfolioTemplate.Common,
  lending: PortfolioTemplate.Lending,
  locked: PortfolioTemplate.Locked,
  leveraged_farming: PortfolioTemplate.LeveragedFarming,
  vesting: PortfolioTemplate.Vesting,
  reward: PortfolioTemplate.Reward,
  options_seller: PortfolioTemplate.OptionsSeller,
  /* 期权 买卖方暂时用同一个 */
  options_buyer: PortfolioTemplate.OptionsSeller,
  insurance_seller: PortfolioTemplate.Unsupported,
  insurance_buyer: PortfolioTemplate.Unsupported,
  perpetuals: PortfolioTemplate.Perpetuals,
  unsupported: PortfolioTemplate.Unsupported,
  nft_common: PortfolioTemplate.NftCommon,
  nft_lending: PortfolioTemplate.NftLending,
  nft_fraction: PortfolioTemplate.NftFraction,
  nft_p2p_lender: PortfolioTemplate.NftP2PLender,
  nft_p2p_borrower: PortfolioTemplate.NftP2PBorrower,
};

type ProtocolListProps = {
  hasTokens?: boolean;
  hasPortfolios?: boolean;
  tokens?: AbstractPortfolioToken[];
  portfolios?: AbstractProject[];
  isTokensLoading?: boolean;
  isPortfoliosLoading?: boolean;
  tokenNetWorth: number;
  showHistory?: boolean;
};

const _ProtocolList = ({
  hasTokens,
  hasPortfolios,
  portfolios,
  isTokensLoading,
  isPortfoliosLoading,
  showHistory,
  ...rest
}: ProtocolListProps & Partial<SectionListProps<AbstractPortfolio>>) => {
  const theme = useColorScheme();
  const colors = useThemeColors();
  const styles = useMemo(() => getStyle(colors), [colors]);
  const ref = useRef(null);

  const sectionList = useMemo(
    () =>
      portfolios?.map(item => ({
        data: item._portfolios,
        portfolio: item,
        key: item.id,
      })) || [],
    [portfolios],
  );

  const renderItem = useCallback(
    ({ item }: { item: AbstractPortfolio }) => {
      const types = item._originPortfolio.detail_types?.reverse();
      const type =
        types?.find(t => (t in TemplateDict ? t : '')) || 'unsupported';
      const PortfolioDetail = TemplateDict[type as keyof typeof TemplateDict];
      return (
        <PortfolioDetail
          name={item._originPortfolio.name}
          data={item}
          style={styles.portfolioCard}
        />
      );
    },
    [styles.portfolioCard],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: SectionListData<AbstractPortfolio> }) => {
      if (
        showHistory &&
        !section.portfolio._portfolios?.filter(
          (x: AbstractPortfolio) => !!x._tokenList?.length,
        )?.length
      ) {
        // 这个 project 的所有 pool 都没有 asset_token_list，直接不展示
        return null;
      }
      return (
        <ProjectTitle data={section.portfolio} showHistory={showHistory} />
      );
    },
    [showHistory],
  );

  const ListEmptyComponent = useMemo(() => {
    const emptySource =
      theme === 'light'
        ? require('@/assets/icons/assets/empty-protocol.png')
        : require('@/assets/icons/assets/empty-protocol-dark.png');

    return isTokensLoading && isPortfoliosLoading ? (
      <PositionLoader space={8} />
    ) : hasTokens || hasPortfolios ? null : (
      <View style={styles.emptyList}>
        <Image source={emptySource} />
        <Text style={styles.emptyListText}>No assets</Text>
      </View>
    );
  }, [isTokensLoading, isPortfoliosLoading, hasTokens, hasPortfolios]);

  const ListFooterComponent = useMemo(() => {
    return <View style={styles.listFooter} />;
  }, []);

  return (
    <View style={[styles.container]}>
      <Tabs.SectionList
        ref={ref}
        showsVerticalScrollIndicator={false}
        {...rest}
        sections={sectionList}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        // getItemType={item => item.type}
        ListEmptyComponent={ListEmptyComponent}
        contentContainerStyle={styles.list}
        // estimatedItemSize={48}
        ListFooterComponent={ListFooterComponent}
      />
      {/* {isPortfoliosLoading && !hasPortfolios ? <PositionLoader space={8} /> : null} */}
    </View>
  );
};

export const ProtocolList = memo(_ProtocolList);

const TokenRow = memo(
  ({
    data,
    style,
    logoSize = 22,
    logoStyle,
  }: {
    data: AbstractPortfolioToken;
    style?: ViewStyle;
    logoStyle?: ViewStyle;
    logoSize?: number;
  }) => {
    const colors = useThemeColors();
    const styles = useMemo(() => getStyle(colors), [colors]);

    const mediaStyle = useMemo(
      () => StyleSheet.flatten([styles.tokenRowLogo, logoStyle]),
      [logoStyle],
    );

    const amountChangeStyle = useMemo(
      () =>
        StyleSheet.flatten([
          styles.tokenRowChange,
          {
            fontWeight: '400' as const,
            flexShrink: 1,
            color:
              data.amount <= 0
                ? // debt
                  colors['blue-light-1']
                : data._amountChange
                ? data._amountChange < 0
                  ? colors['red-default']
                  : colors['green-default']
                : colors['blue-light-1'],
          },
        ]),
      [data, colors],
    );

    const usdChangeStyle = useMemo(
      () =>
        StyleSheet.flatten([
          styles.tokenRowChange,
          {
            fontWeight: '400' as const,
            color:
              data.amount < 0
                ? colors['blue-light-1']
                : data._usdValueChange
                ? data._usdValueChange < 0
                  ? colors['red-default']
                  : colors['green-default']
                : colors['blue-light-1'],
          },
        ]),
      [data, colors],
    );

    return (
      <View style={StyleSheet.flatten([styles.tokenRowWrap, style])}>
        <View style={styles.tokenRowId}>
          <AssetAvatar
            logo={data?.logo_url}
            style={mediaStyle}
            size={logoSize}
          />
          <View style={styles.tokenSymbolWrap}>
            <View style={styles.tokenRowAmountWrap}>
              <Text style={styles.tokenRowAmount}>{data._amountStr}</Text>
              {data.amount < 0 ? (
                <View style={styles.tokenRowDebtWrap}>
                  <Text style={styles.tokenRowDebt}> Debt</Text>
                </View>
              ) : null}
            </View>
            {data._amountChangeStr ? (
              <Text style={amountChangeStyle} numberOfLines={1}>
                {data._amountChangeStr}
              </Text>
            ) : (
              <Text style={styles.tokenSymbol} numberOfLines={1}>
                {data.symbol}
              </Text>
            )}
          </View>
        </View>
        <View style={styles.tokenRowPriceWrap}>
          <Text style={styles.tokenRowPrice}>{data._priceStr}</Text>
        </View>
        <View style={styles.tokenRowUsdValueWrap}>
          <Text style={styles.tokenRowUsdValue}>{data._usdValueStr}</Text>
          <Text style={usdChangeStyle}>
            {data._usdValueChangeStr !== '-'
              ? `${data._usdValueChangePercent} (${data._usdValueChangeStr})`
              : '-'}
          </Text>
        </View>
      </View>
    );
  },
);

const ProjectTitle = ({
  data,
  showHistory,
}: {
  data: AbstractProject;
  showHistory?: boolean;
}) => {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyle(colors), [colors]);

  const usdChangeStyle = useMemo(
    () =>
      StyleSheet.flatten([
        styles.tokenRowChange,
        {
          textAlign: 'right' as any,
          color: data.netWorthChange
            ? data.netWorthChange < 0
              ? colors['red-default']
              : colors['green-default']
            : colors['blue-light-1'],
        },
      ]),
    [data, colors],
  );

  return (
    <View style={styles.projectHeader}>
      <View style={styles.projectHeaderName}>
        <AssetAvatar
          logo={data?.logo}
          size={18}
          chain={data?.chain}
          chainSize={10}
        />
        <Text style={styles.projectName} numberOfLines={1}>
          {data?.name}
        </Text>
      </View>
      <View style={styles.projectHeaderUsd}>
        <Text style={styles.projectHeaderNetWorth}>{data._netWorth}</Text>
        {showHistory ? (
          <Text style={usdChangeStyle}>
            {data._netWorthChange === '-'
              ? '-'
              : `${data._netWorthChangePercent} (${data._netWorthChange})`}
          </Text>
        ) : null}
      </View>
    </View>
  );
};

const getStyle = (colors: AppColorsVariants) =>
  StyleSheet.create({
    container: {
      backgroundColor: colors['neutral-bg-1'],
    },
    list: {},
    emptyList: {
      marginTop: 160,
      alignItems: 'center',
    },
    emptyListText: {
      fontSize: 15,
      color: colors['blue-default'],
      fontWeight: '600',
    },
    // [TokenRow
    tokenRowLogo: {
      marginRight: 8,
    },
    tokenRowWrap: {
      marginTop: 24,
      paddingHorizontal: 12,
      flexDirection: 'row',
      alignItems: 'center',
    },
    tokenRowId: {
      flexDirection: 'row',
      alignItems: 'center',
      flexGrow: 1,
      flexBasis: '43%',
    },
    tokenRowAmountWrap: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    tokenRowAmount: {
      color: colors['blue-default'],
      fontSize: 12,
      fontWeight: '400',
    },
    tokenRowPriceWrap: {
      flexGrow: 1,
      flexBasis: '24%',
    },
    tokenRowPrice: {
      fontSize: 12,
      color: colors['blue-default'],
      fontWeight: '400',
    },
    tokenRowChange: {
      fontSize: 10,
      fontWeight: '500',
    },
    tokenRowUsdValueWrap: {
      flexGrow: 1,
      flexBasis: '33%',
      alignItems: 'flex-end',
    },
    tokenRowUsdValue: {
      textAlign: 'right',
      color: colors['blue-default'],
      fontSize: 12,
      fontWeight: '400',
    },
    // TokenRow]

    tokenRowDebtWrap: {
      borderWidth: 1,
      borderColor: colors['red-default'],
      paddingLeft: 2,
      paddingRight: 3,
      height: 14,
      marginLeft: 4,
      borderRadius: 3,
      alignItems: 'center',
    },
    tokenRowDebt: {
      lineHeight: 12,
      color: colors['red-default'],
      fontSize: 8,
      fontWeight: '500',
    },
    listFooter: {
      height: 120,
    },

    //projectTitle
    projectHeader: {
      marginHorizontal: 20,
      paddingTop: 40,
      marginBottom: 8,
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    projectHeaderName: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    projectName: {
      marginLeft: 11,
      color: colors['blue-light-1'],
      fontSize: 13,
      fontWeight: '600',
    },
    projectHeaderUsd: {
      alignSelf: 'flex-end',
    },
    projectHeaderNetWorth: {
      color: colors['blue-light-1'],
      fontSize: 12,
      fontWeight: '600',
      textAlign: 'right',
    },
    portfolioCard: {
      marginBottom: 12,
      paddingBottom: 20,
      marginHorizontal: 20,
    },
    tokenSymbol: {
      fontSize: 10,
      fontWeight: '400',
      color: colors['blue-light-1'],
      flexShrink: 1,
    },
    tokenSymbolWrap: {
      flexShrink: 1,
    },
  });
