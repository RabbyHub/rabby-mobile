import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { RootNames } from '@/constant/layout';
import { useMemo } from 'react';
import AAVE3_ICON from '@/assets/icons/protocols/aave-icon-bg.svg';
import HYPERLIQUID_ICON from '@/assets/icons/protocols/hyper-icon-bg.svg';
import { KeyringAccountWithAlias, useMyAccounts } from '@/hooks/account';
import {
  isSameAccount,
  useSwitchSceneCurrentAccount,
} from '@/hooks/accountsSwitcher';
import { usePerpsState } from '@/hooks/perps/usePerpsState';
import { AbstractPortfolio } from '../types';

export const useProtocolConfig = () => {
  const { navigation } = useSafeSetNavigationOptions();
  const { switchSceneCurrentAccount } = useSwitchSceneCurrentAccount();
  const { login } = usePerpsState();
  const { accounts } = useMyAccounts();
  const config = useMemo(() => {
    return {
      aave3: {
        icon: AAVE3_ICON,
        bgColor1: 'rgba(147, 145, 247, 0.2)',
        bgColor2: 'rgba(147, 145, 247, 0)',
        showManage: (
          item: AbstractPortfolio,
          account?: KeyringAccountWithAlias,
        ) => {
          return item.name?.toLowerCase() === 'lending';
        },
        onManage: async (account?: KeyringAccountWithAlias) => {
          if (account) {
            await switchSceneCurrentAccount('Lending', account);
          }
          return navigation.navigate(RootNames.StackTransaction, {
            screen: RootNames.Lending,
            params: {},
          });
        },
      },
      hyperliquid: {
        icon: HYPERLIQUID_ICON,
        bgColor1: 'rgba(187, 235, 221, 0.2)',
        bgColor2: 'rgba(187, 235, 221, 0)',
        showManage: (
          item: AbstractPortfolio,
          account?: KeyringAccountWithAlias,
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
          return types?.includes('perpetuals');
        },
        onManage: async (account?: KeyringAccountWithAlias) => {
          return navigation.push(RootNames.StackTransaction, {
            screen: RootNames.Perps,
            params: {
              account,
            },
          });
        },
      },
    };
  }, [accounts, navigation, switchSceneCurrentAccount]);
  return {
    config,
  };
};
