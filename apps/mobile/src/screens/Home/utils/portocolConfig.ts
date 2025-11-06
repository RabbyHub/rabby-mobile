import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { RootNames } from '@/constant/layout';
import { useMemo } from 'react';
import AAVE3_ICON from '@/assets/icons/protocols/aave-icon-bg.svg';
import HYPERLIQUID_ICON from '@/assets/icons/protocols/hyper-icon-bg.svg';

export const useProtocolConfig = () => {
  const { navigation } = useSafeSetNavigationOptions();
  const config = useMemo(() => {
    return {
      aave3: {
        icon: AAVE3_ICON,
        bgColor1: 'rgba(147, 145, 247, 0.2)',
        bgColor2: 'rgba(147, 145, 247, 0)',
        onManage: () => {
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
        onManage: () => {
          return navigation.push(RootNames.StackTransaction, {
            screen: RootNames.Perps,
            params: {},
          });
        },
      },
    };
  }, [navigation]);
  return {
    config,
  };
};
