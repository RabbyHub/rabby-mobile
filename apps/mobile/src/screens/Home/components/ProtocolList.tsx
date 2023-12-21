import React, { useMemo, useCallback, memo, useRef } from 'react';
import {
  StyleSheet,
  View,
  Image,
  SectionListProps,
  SectionListData,
  useColorScheme,
  TouchableOpacity,
} from 'react-native';
import { Tabs } from 'react-native-collapsible-tab-view';

import {
  AbstractPortfolioToken,
  AbstractProject,
  AbstractPortfolio,
} from '../types';
import PortfolioTemplate from '../portfolios';
import { useThemeColors } from '@/hooks/theme';
import { PositionLoader } from './Skeleton';
import { AppColorsVariants } from '@/constant/theme';
import { AssetAvatar } from '@/components/AssetAvatar';
import { Text } from '@/components';
import ArrowDownCC from '@/assets/icons/common/arrow-down-cc.svg';

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
};

const _ProtocolList = ({
  hasTokens,
  hasPortfolios,
  portfolios,
  isTokensLoading,
  isPortfoliosLoading,
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

  const [expandedSections, setExpandedSections] = React.useState(
    new Set<string>(),
  );

  const handleToggle = (title: string) => {
    setExpandedSections(prev => {
      // Using Set here but you can use an array too
      const next = new Set(prev);
      if (next.has(title)) {
        next.delete(title);
      } else {
        next.add(title);
      }
      return next;
    });
  };

  const renderItem = useCallback(
    ({
      item,
      section: { key },
    }: {
      item: AbstractPortfolio;
      section: SectionListData<AbstractPortfolio>;
    }) => {
      const isExpanded = expandedSections.has(key!);

      const types = item._originPortfolio.detail_types?.reverse();
      const type =
        types?.find(t => (t in TemplateDict ? t : '')) || 'unsupported';
      const PortfolioDetail = TemplateDict[type as keyof typeof TemplateDict];
      return (
        <PortfolioDetail
          name={item._originPortfolio.name}
          data={item}
          style={StyleSheet.flatten([styles.portfolioCard])}
        />
      );
    },
    [expandedSections, styles.portfolioCard],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: SectionListData<AbstractPortfolio> }) => {
      return (
        <ProjectTitle
          onPress={() => handleToggle(section.key!)}
          data={section.portfolio}
          isExpanded={expandedSections.has(section.key!)}
        />
      );
    },
    [expandedSections],
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
  }, [
    theme,
    isTokensLoading,
    isPortfoliosLoading,
    hasTokens,
    hasPortfolios,
    styles,
  ]);

  const ListFooterComponent = useMemo(() => {
    return <View style={styles.listFooter} />;
  }, [styles.listFooter]);

  return (
    <Tabs.SectionList
      ref={ref}
      showsVerticalScrollIndicator={false}
      {...rest}
      extraData={expandedSections}
      sections={sectionList}
      renderItem={renderItem}
      renderSectionHeader={renderSectionHeader}
      // getItemType={item => item.type}
      ListEmptyComponent={ListEmptyComponent}
      contentContainerStyle={styles.list}
      // estimatedItemSize={48}
      ListFooterComponent={ListFooterComponent}
    />
  );
};

export const ProtocolList = memo(_ProtocolList);

const ProjectTitle = ({
  data,
  onPress,
  isExpanded,
}: {
  data: AbstractProject;
  onPress?: () => void;
  isExpanded?: boolean;
}) => {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyle(colors), [colors]);

  return (
    <TouchableOpacity
      // onPress={onPress}
      style={styles.projectHeader}>
      <View style={styles.projectHeaderName}>
        <AssetAvatar
          logo={data?.logo}
          size={36}
          chain={data?.chain}
          chainSize={16}
        />
        <Text style={styles.projectName} numberOfLines={1}>
          {data?.name}
        </Text>
      </View>
      <View style={styles.projectHeaderUsd}>
        <Text style={styles.projectHeaderNetWorth}>{data._netWorth}</Text>
        {/* <ArrowDownCC
          style={[
            styles.arrowButton,
            {
              transform: isExpanded
                ? [{ rotate: '180deg' }]
                : [{ rotate: '0deg' }],
            },
          ]}
        /> */}
      </View>
    </TouchableOpacity>
  );
};

const getStyle = (colors: AppColorsVariants) =>
  StyleSheet.create({
    list: {},
    emptyList: {
      marginTop: 160,
      alignItems: 'center',
    },
    emptyListText: {
      fontSize: 15,
      color: colors['neutral-title-1'],
      fontWeight: '600',
    },

    listFooter: {
      height: 120,
    },

    //projectTitle
    projectHeader: {
      marginHorizontal: 20,
      marginBottom: 12,
      flexDirection: 'row',
      justifyContent: 'space-between',
      height: 68,
      alignItems: 'center',
    },
    projectHeaderName: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    projectName: {
      marginLeft: 12,
      color: colors['neutral-title-1'],
      fontSize: 15,
      fontWeight: '600',
    },
    projectHeaderUsd: {
      alignSelf: 'flex-end',
      flexShrink: 1,
      flexDirection: 'row',
      alignItems: 'center',
      height: 68,
    },
    projectHeaderNetWorth: {
      color: colors['neutral-title-1'],
      fontSize: 16,
      fontWeight: '600',
      textAlign: 'right',
    },
    portfolioCard: {
      marginBottom: 8,
      padding: 12,
      marginHorizontal: 20,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors['neutral-line'],
      borderRadius: 6,
    },
    arrowButton: {
      width: 20,
      color: colors['neutral-foot'],
      marginLeft: 12,
    },
  });
