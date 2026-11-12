import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { FC, useMemo } from 'react';
import HYPERLIQUID_ICON from '@/assets/icons/protocols/hyper-icon-bg.svg';
import { KeyringAccountWithAlias, useMyAccounts } from '@/hooks/account';
import { isSameAccount } from '@/hooks/accountsSwitcher';
import { SvgProps } from 'react-native-svg';
import { navigateToPreferredPerps } from '@/hooks/perps/navigation/navigateToPreferredPerps';
import { IProtocolPortfolio } from '@/store/protocols';

export type TonManageAction = (
  account?: KeyringAccountWithAlias,
  item?: IProtocolPortfolio,
) => Promise<void>;

interface ProtocolConfigItemType {
  icon: FC<SvgProps>;
  bgColor1: string;
  bgColor2: string;
  showManage?: (
    item: IProtocolPortfolio,
    account?: KeyringAccountWithAlias | null,
  ) => boolean;
  onManage?: TonManageAction;
}

export const useProtocolConfig = () => {
  const { navigation } = useSafeSetNavigationOptions();
  const { accounts } = useMyAccounts({ disableAutoFetch: true });

  const config = useMemo((): Record<string, ProtocolConfigItemType> => {
    return {
      hyperliquid: {
        icon: HYPERLIQUID_ICON,
        bgColor1: 'rgba(187, 235, 221, 0.2)',
        bgColor2: 'rgba(187, 235, 221, 0)',
        showManage: (
          item: IProtocolPortfolio,
          account?: KeyringAccountWithAlias | null,
        ) => {
          if (!account?.address) {
            return false;
          }
          const noMyAccount = accounts.find(a => isSameAccount(a, account));
          if (!noMyAccount) {
            return false;
          }
          const types = item._originPortfolio.detail_types.map(t =>
            t.toLowerCase(),
          );
          // 判断是不是存储池子
          const isWithdrawPosition =
            `perp_withdrawable_usdc_hyperliquid_${account?.address?.toLowerCase()}` ===
            item?._originPortfolio?.position_index?.toLowerCase();
          if (isWithdrawPosition) {
            return true;
          }
          return types?.includes('perpetuals');
        },
        onManage: async (
          account?: KeyringAccountWithAlias,
          item?: IProtocolPortfolio,
        ) => {
          if (!account) {
            return;
          }

          const isNavigateDetail =
            !!item?._originPortfolio?.detail?.position_token?.name;

          if (isNavigateDetail) {
            const positionToken =
              item?._originPortfolio?.detail?.position_token;
            const market = positionToken?.symbol || '';
            await navigateToPreferredPerps({
              account,
              marketCandidates: [market, positionToken?.name || ''],
              navigation,
              simpleDetail: { market },
              source: 'defi-manage-position',
            });
            return;
          }
          await navigateToPreferredPerps({
            account,
            navigation,
            source: 'defi-manage-root',
          });
        },
      },
    };
  }, [accounts, navigation]);
  return {
    config,
  };
};
