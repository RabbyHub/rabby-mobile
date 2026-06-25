import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { RootNames } from '@/constant/layout';
import { FC, useCallback, useMemo } from 'react';
import AAVE3_ICON from '@/assets/icons/protocols/aave-icon-bg.svg';
import HYPERLIQUID_ICON from '@/assets/icons/protocols/hyper-icon-bg.svg';
import { KeyringAccountWithAlias, useMyAccounts } from '@/hooks/account';
import {
  isSameAccount,
  useSwitchSceneCurrentAccount,
} from '@/hooks/accountsSwitcher';
import {
  isAave3Portfolio,
  keyToMarketKey,
  marketKeyToProtocolId,
} from '@/screens/Lending/config/protocol';
import { SvgProps } from 'react-native-svg';
import { switchPerpsAccountBeforeNavigate } from '@/hooks/perps/usePerpsStore';
import { useSelectedMarket } from '@/screens/Lending/hooks';
import { clearLendingActionPopupState } from '@/screens/Lending/utils/actionPopup';
import { IProtocolPortfolio } from '@/store/protocols';
import { matomoRequestEvent } from '@/utils/analytics';

export { isAave3Portfolio, keyToMarketKey, marketKeyToProtocolId };

export type TonTokenManageAction = (
  account?: KeyringAccountWithAlias,
  tokenAddress?: string,
  direction?: 'supply' | 'borrow',
) => void;

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
  onTokenManage?: TonTokenManageAction;
}

export const useProtocolConfig = () => {
  const { navigation } = useSafeSetNavigationOptions();
  const { switchSceneCurrentAccount } = useSwitchSceneCurrentAccount();
  const { accounts } = useMyAccounts();
  const { setMarketKey } = useSelectedMarket();

  const generateAAVEConfig = useCallback(
    (key: string): ProtocolConfigItemType => {
      const openLending = async (
        account?: KeyringAccountWithAlias,
        tokenAddress?: string,
        direction?: 'supply' | 'borrow',
        source?: string,
      ) => {
        const marketKey = keyToMarketKey[key];
        if (account && marketKey) {
          await switchSceneCurrentAccount('Lending', account);
          setMarketKey(marketKey);
        }
        clearLendingActionPopupState();

        navigation.navigate(RootNames.StackTransaction, {
          screen: RootNames.Lending,
          params: {
            dappId: 'aave',
            account,
            tokenAddress,
            direction,
            source,
          },
        });
      };

      return {
        icon: AAVE3_ICON,
        bgColor1: 'rgba(147, 145, 247, 0.2)',
        bgColor2: 'rgba(147, 145, 247, 0)',
        showManage: (item, _account) => {
          return item.name?.toLowerCase() === 'lending';
        },
        onManage: account => openLending(account),
        onTokenManage: (account, tokenAddress, direction) =>
          openLending(account, tokenAddress, direction, 'Portfolio Defi'),
      };
    },
    [navigation, setMarketKey, switchSceneCurrentAccount],
  );

  const aave3Config = useMemo(() => {
    return Object.entries(keyToMarketKey).reduce((acc, [key]) => {
      acc[key] = generateAAVEConfig(key);
      return acc;
    }, {});
  }, [generateAAVEConfig]);

  const config = useMemo((): Record<string, ProtocolConfigItemType> => {
    return {
      ...aave3Config,
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

          switchPerpsAccountBeforeNavigate(account);
          if (isNavigateDetail) {
            matomoRequestEvent({
              category: 'Rabby Perps',
              action: 'Perps_ManageToPosition',
            });
            return navigation.push(RootNames.StackTransaction, {
              screen: RootNames.PerpsMarketDetail,
              params: {
                market:
                  item?._originPortfolio?.detail?.position_token?.symbol || '',
              },
            });
          } else {
            matomoRequestEvent({
              category: 'Rabby Perps',
              action: 'Perps_ManageToPerps',
            });
            return navigation.push(RootNames.StackTransaction, {
              screen: RootNames.Perps,
              params: {
                dappId: 'hyperliquid',
                account,
              },
            });
          }
        },
      },
    };
  }, [aave3Config, accounts, navigation]);
  return {
    config,
  };
};
