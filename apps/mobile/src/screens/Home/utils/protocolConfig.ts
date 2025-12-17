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
import { AbstractPortfolio } from '../types';
import { CustomMarket } from '@/screens/Lending/config/market';
import { SvgProps } from 'react-native-svg';
import { switchPerpsAccountBeforeNavigate } from '@/hooks/perps/usePerpsStore';
import { useSelectedMarket } from '@/screens/Lending/hooks';

const keyToMarketKey: Record<string, CustomMarket> = {
  aave3: CustomMarket.proto_mainnet_v3,
  op_aave3: CustomMarket.proto_optimism_v3,
  avax_aave3: CustomMarket.proto_avalanche_v3,
  matic_aave3: CustomMarket.proto_polygon_v3,
  arb_aave3: CustomMarket.proto_arbitrum_v3,
  base_aave3: CustomMarket.proto_base_v3,
  bsc_aave3: CustomMarket.proto_bnb_v3,
  scrl_aave3: CustomMarket.proto_scroll_v3,
  plasma_aave3: CustomMarket.proto_plasma_v3,
  ink_aave3: CustomMarket.proto_ink_v3,
  era_aave3: CustomMarket.proto_zksync_v3,
  linea_aave3: CustomMarket.proto_linea_v3,
  sonic_aave3: CustomMarket.proto_sonic_v3,
  celo_aave3: CustomMarket.proto_celo_v3,
  xdai_aave3: CustomMarket.proto_gnosis_v3,
};

export type TonTokenManageAction = (
  account?: KeyringAccountWithAlias,
  tokenAddress?: string,
  direction?: 'supply' | 'borrow',
) => void;

export type TonManageAction = (
  account?: KeyringAccountWithAlias,
  item?: AbstractPortfolio,
) => Promise<void>;

interface ProtocolConfigItemType {
  icon: FC<SvgProps>;
  bgColor1: string;
  bgColor2: string;
  showManage?: (
    item: AbstractPortfolio,
    account?: KeyringAccountWithAlias | null,
  ) => boolean;
  onManage?: TonManageAction;
}

export const useProtocolConfig = () => {
  const { navigation } = useSafeSetNavigationOptions();
  const { switchSceneCurrentAccount } = useSwitchSceneCurrentAccount();
  const { accounts } = useMyAccounts();
  const { setMarketKey } = useSelectedMarket();

  const generateAAVEConfig = useCallback(
    (key: string): ProtocolConfigItemType => {
      return {
        icon: AAVE3_ICON,
        bgColor1: 'rgba(147, 145, 247, 0.2)',
        bgColor2: 'rgba(147, 145, 247, 0)',
        showManage: (item, _account) => {
          return item.name?.toLowerCase() === 'lending';
        },
        onManage: async account => {
          const marketKey = keyToMarketKey[key];
          if (account && marketKey) {
            await switchSceneCurrentAccount('Lending', account);
            setMarketKey(marketKey);
          }
          navigation.navigate(RootNames.StackTransaction, {
            screen: RootNames.Lending,
            params: {},
          });
        },
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
          item: AbstractPortfolio,
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
          item?: AbstractPortfolio,
        ) => {
          if (!account) {
            return;
          }

          const isNavigateDetail =
            !!item?._originPortfolio?.detail?.position_token?.name;

          switchPerpsAccountBeforeNavigate(account);
          if (isNavigateDetail) {
            return navigation.push(RootNames.StackTransaction, {
              screen: RootNames.PerpsMarketDetail,
              params: {
                market:
                  item?._originPortfolio?.detail?.position_token?.name || '',
              },
            });
          } else {
            return navigation.push(RootNames.StackTransaction, {
              screen: RootNames.Perps,
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
