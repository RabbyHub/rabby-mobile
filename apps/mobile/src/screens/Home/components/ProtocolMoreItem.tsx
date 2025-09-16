import React, { useMemo, memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { AbstractPortfolio } from '../types';
import PortfolioTemplate from '../portfolios';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { DappActions } from './DappActions';
import { Account } from '@/core/services/preference';

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
        // style={StyleSheet.flatten([styles.portfolioCard])}
      />
    );
  },
  (prev, next) => prev.item.id === next.item.id,
);

export const WrapperDappActionsMemoItem = ({
  item,
  chain,
  protocolLogo,
  currentAccount,
}: {
  item: AbstractPortfolio;
  chain?: string;
  protocolLogo?: string;
  currentAccount?: Account;
}) => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  return (
    <View style={styles.portfolioCard}>
      <MemoItem item={item} />
      {!!item._originPortfolio.withdraw_actions?.length &&
        !item?._originPortfolio?.proxy_detail?.proxy_contract_id && (
          <DappActions
            data={item._originPortfolio.withdraw_actions}
            chain={chain}
            protocolLogo={protocolLogo}
            currentAccount={currentAccount}
          />
        )}
    </View>
  );
};

const getStyles = createGetStyles2024(ctx => ({
  portfolioCard: {
    marginBottom: 12,
    paddingVertical: 12,
    // paddingHorizontal: 8,
    marginHorizontal: 20,
    borderRadius: 12,
    backgroundColor: ctx.isLight
      ? ctx.colors2024['neutral-bg-1']
      : ctx.colors2024['neutral-bg-2'],
  },
}));
