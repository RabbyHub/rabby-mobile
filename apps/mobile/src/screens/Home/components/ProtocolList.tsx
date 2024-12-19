import React, { useMemo, useCallback, memo, useRef } from 'react';
import {
  StyleSheet,
  View,
  SectionListProps,
  SectionListData,
  TouchableOpacity,
  LayoutAnimation,
  RefreshControl,
} from 'react-native';
import { Tabs } from 'react-native-collapsible-tab-view';

import {
  AbstractPortfolioToken,
  AbstractProject,
  AbstractPortfolio,
} from '../types';
import PortfolioTemplate from '../portfolios';
import { useTheme2024 } from '@/hooks/theme';
import { PositionLoader } from './Skeleton';
import { AssetAvatar } from '@/components/AssetAvatar';
import { Text } from '@/components';
import { EmptyHolder } from '@/components/EmptyHolder';
import { createGetStyles2024 } from '@/utils/styles';
import { navigate } from '@/utils/navigation';
import { RootNames } from '@/constant/layout';

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
  hasPortfolios?: boolean;
  tokens?: AbstractPortfolioToken[];
  portfolios?: AbstractProject[];
  isPortfoliosLoading?: boolean;
  tokenNetWorth: number;
  refreshPositions(): void;
  onRefresh(): void;
};

export const MemoItem = memo(
  ({ item }: { item: AbstractPortfolio }) => {
    const { styles } = useTheme2024({ getStyle: getStyles });

    const types = item._originPortfolio.detail_types?.reverse();
    const type =
      types?.find(t => (t in TemplateDict ? t : '')) || 'unsupported';
    const PortfolioDetail = useMemo(
      () => TemplateDict[type as keyof typeof TemplateDict],
      [type],
    );

    return (
      <PortfolioDetail
        name={item._originPortfolio.name}
        data={item}
        style={StyleSheet.flatten([styles.portfolioCard])}
      />
    );
  },
  (prev, next) => prev.item.id === next.item.id,
);

const _ProtocolList = ({
  hasPortfolios,
  portfolios,
  isPortfoliosLoading,
  refreshPositions,
  onRefresh,
  ...rest
}: ProtocolListProps & Partial<SectionListProps<AbstractPortfolio>>) => {
  const { styles } = useTheme2024({ getStyle: getStyles });

  const ref = useRef(null);
  const refreshing = useMemo(() => {
    if ((portfolios?.length || 0) > 0) {
      return !!isPortfoliosLoading;
    } else {
      return false;
    }
  }, [isPortfoliosLoading, portfolios]);

  const sectionList = useMemo(
    () =>
      portfolios?.map(item => ({
        data: item._portfolios,
        portfolio: item,
        key: item.id,
      })) || [],
    [portfolios],
  );

  const handleToggle = useCallback(
    (data: AbstractProject, itemList: AbstractPortfolio[]) => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      navigate(RootNames.DeFiDetail, { data, portfolioList: itemList });
    },
    [],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: SectionListData<AbstractPortfolio> }) => {
      return (
        <ProjectTitle
          onPress={() => handleToggle(section.portfolio, [...section.data])}
          data={section.portfolio}
        />
      );
    },
    [handleToggle],
  );

  const ListEmptyComponent = useMemo(() => {
    return isPortfoliosLoading ? (
      <PositionLoader space={8} />
    ) : hasPortfolios ? null : (
      <EmptyHolder text="No assets" type="protocol" />
    );
  }, [isPortfoliosLoading, hasPortfolios]);

  const ListFooterComponent = useMemo(() => {
    return <View style={styles.listFooter} />;
  }, [styles.listFooter]);

  return (
    <Tabs.SectionList
      ref={ref}
      {...rest}
      sections={sectionList}
      renderItem={() => null}
      renderSectionHeader={renderSectionHeader}
      keyExtractor={item => item.id}
      ListEmptyComponent={ListEmptyComponent}
      contentContainerStyle={styles.bgContainer}
      showsVerticalScrollIndicator={false}
      ListFooterComponent={ListFooterComponent}
      stickySectionHeadersEnabled={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          style={styles.bgContainer}
          onRefresh={() => {
            refreshPositions();
            onRefresh();
          }}
        />
      }
    />
  );
};

export const ProtocolList = memo(_ProtocolList);

const ProjectTitle = ({
  data,
  onPress,
}: {
  data: AbstractProject;
  onPress?: () => void;
}) => {
  const { styles } = useTheme2024({ getStyle: getStyles });

  return (
    <View>
      <TouchableOpacity onPress={onPress} style={[styles.projectHeader]}>
        <View style={styles.projectHeaderName}>
          <AssetAvatar
            logo={data?.logo}
            size={40}
            chain={data?.chain}
            chainSize={16}
          />
          <Text style={styles.projectName} numberOfLines={1}>
            {data?.name}
          </Text>
        </View>
        <View style={styles.projectHeaderUsd}>
          <Text style={styles.projectHeaderNetWorth}>{data._netWorth}</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
};

const getStyles = createGetStyles2024(ctx => ({
  emptyList: {
    marginTop: 160,
    alignItems: 'center',
  },
  emptyListText: {
    fontSize: 15,
    color: ctx.colors2024['neutral-title-1'],
    fontWeight: '600',
  },

  listFooter: {
    height: 120,
  },

  //projectTitle
  projectHeader: {
    marginHorizontal: 20,
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
    marginLeft: 8,
    color: ctx.colors2024['neutral-title-1'],
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
  },
  projectHeaderUsd: {
    alignSelf: 'flex-end',
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 68,
  },
  projectHeaderNetWorth: {
    color: ctx.colors2024['neutral-title-1'],
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    textAlign: 'right',
  },
  portfolioCard: {
    marginBottom: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginHorizontal: 20,
    borderRadius: 12,
    backgroundColor: ctx.colors2024['neutral-bg-1'],
    borderWidth: 1,
    borderColor: ctx.colors2024['neutral-line'],
  },
  arrowButton: {
    width: 20,
    color: ctx.colors2024['neutral-foot'],
    marginLeft: 12,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: ctx.colors2024['neutral-line'],
    marginRight: 20,
    marginLeft: 68,
  },
  bgContainer: {
    backgroundColor: ctx.colors2024['neutral-bg-1'],
  },
}));
