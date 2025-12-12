import React, { useMemo, memo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { colord } from 'colord';

import { AbstractPortfolio } from '../types';
import PortfolioTemplate from '../portfolios';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { DappActions } from './DappActions';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { KeyringAccountWithAlias, useAccounts } from '@/hooks/account';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { useTranslation } from 'react-i18next';
import { TonManageAction } from '../utils/protocolConfig';

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
  prediction: PortfolioTemplate.Prediction,
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
        style={styles.detail}
      />
    );
  },
  (prev, next) => prev.item.id === next.item.id,
);

export const WrapperDappActionsMemoItem = ({
  item,
  chain,
  protocolLogo,
  address,
  addressType,
  onRefresh,
  session,
  manageAction,
  disableAction,
  isLast,
}: {
  item: AbstractPortfolio;
  chain?: string;
  protocolLogo?: string;
  address?: string;
  addressType?: KEYRING_TYPE;
  onRefresh?: () => Promise<void>;
  session?: React.ComponentProps<typeof DappActions>['session'];
  manageAction?: TonManageAction;
  disableAction?: boolean;
  isLast?: boolean;
}) => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const { colors2024 } = useTheme2024();
  const { t } = useTranslation();
  const { accounts } = useAccounts({
    disableAutoFetch: true,
  });

  const currentAccount = useMemo(
    () =>
      accounts.find(
        _item =>
          address &&
          isSameAddress(_item.address, address) &&
          _item.type === addressType,
      ),
    [accounts, address, addressType],
  );
  if (!currentAccount) {
    return null;
  }
  return (
    <View style={[styles.portfolioCard, isLast && styles.portfolioCardLast]}>
      <View style={styles.portfolioContent}>
        <MemoItem item={item} />
      </View>
      {!!manageAction && (
        <TouchableOpacity
          style={[styles.button]}
          onPress={() => manageAction?.(currentAccount, item)}>
          <Text style={styles.buttonText}>
            {t('component.portfolios.manage')}
          </Text>
        </TouchableOpacity>
      )}
      {!!item._originPortfolio.withdraw_actions?.length &&
        !item?._originPortfolio?.proxy_detail?.proxy_contract_id && (
          <DappActions
            data={item._originPortfolio.withdraw_actions}
            chain={chain}
            protocolLogo={protocolLogo}
            currentAccount={currentAccount}
            onRefresh={onRefresh}
            session={session}
            style={!!manageAction && styles.longMarginTop}
            disableAction={disableAction}
          />
        )}
    </View>
  );
};

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  portfolioCard: {
    width: '100%',
    // paddingTop: 12,
    // paddingHorizontal: 4,
    position: 'relative',
    overflow: 'hidden',
    marginBottom: 24,
  },
  portfolioCardLast: {
    marginBottom: 0,
  },
  portfolioContent: {
    // paddingHorizontal: 8,
  },
  detail: {
    backgroundColor: 'transparent',
  },
  gradientBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  button: {
    marginTop: 0,
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors2024['brand-light-1'],
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: colors2024['brand-default'],
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
  },
  longMarginTop: {
    marginTop: 12,
  },
}));
