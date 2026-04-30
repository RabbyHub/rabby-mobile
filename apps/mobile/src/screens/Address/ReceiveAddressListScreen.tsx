import React from 'react';
import { useTheme2024 } from '@/hooks/theme';
import { RootNames } from '@/constant/layout';
import { useRoute } from '@react-navigation/core';
import { GetNestedScreenRouteProp } from '@/navigation-type';
import { createGetStyles2024 } from '@/utils/styles';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { AccountsPanelInSheetModal } from '@/components/AccountSelector/AccountsPanel';
import { CHAINS_ENUM } from '@/constant/chains';
import { preloadTransactionHotNavigator } from '@/perfs/preloads';
import type { Account } from '@/types/account';
import { naviPush } from '@/utils/navigation';

export function ReceiveAddressListScreen(): JSX.Element {
  const { styles } = useTheme2024({ getStyle });
  const isSelectingRef = React.useRef(false);
  const unlockSelectingTimerRef = React.useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const route =
    useRoute<
      GetNestedScreenRouteProp<
        'AddressNavigatorParamList',
        'ReceiveAddressList'
      >
    >();

  React.useEffect(() => {
    preloadTransactionHotNavigator().catch(error => {
      console.error(
        'preloadTransactionHotNavigator::receiveAddressList::error',
        error,
      );
    });

    return () => {
      if (unlockSelectingTimerRef.current) {
        clearTimeout(unlockSelectingTimerRef.current);
        unlockSelectingTimerRef.current = null;
      }
    };
  }, []);

  const handleSelect = React.useCallback(
    (account: Account | null) => {
      if (!account || isSelectingRef.current) {
        return;
      }

      isSelectingRef.current = true;

      if (unlockSelectingTimerRef.current) {
        clearTimeout(unlockSelectingTimerRef.current);
        unlockSelectingTimerRef.current = null;
      }

      preloadTransactionHotNavigator().catch(error => {
        console.error(
          'preloadTransactionHotNavigator::receiveAddressSelect::error',
          error,
        );
      });

      const params: {
        chainEnum?: CHAINS_ENUM;
        tokenSymbol?: string;
      } = {};
      if (route.params?.chainEnum) {
        params.chainEnum = route.params.chainEnum;
      }
      if (route.params?.tokenSymbol) {
        params.tokenSymbol = route.params.tokenSymbol;
      }
      try {
        naviPush(RootNames.StackTransaction, {
          screen: RootNames.Receive,
          params: {
            account: account,
            ...params,
          },
        });
      } finally {
        unlockSelectingTimerRef.current = setTimeout(() => {
          isSelectingRef.current = false;
          unlockSelectingTimerRef.current = null;
        }, 1000);
      }
    },
    [route.params?.chainEnum, route.params?.tokenSymbol],
  );

  return (
    <NormalScreenContainer2024
      type="linear"
      overwriteStyle={styles.overwriteStyle}>
      <AccountsPanelInSheetModal
        containerStyle={styles.accountRoot}
        onSelectAccount={handleSelect}
        scene="receive"
      />
    </NormalScreenContainer2024>
  );
}

const getStyle = createGetStyles2024(() => ({
  overwriteStyle: {
    paddingTop: 76,
  },
  accountRoot: {
    paddingTop: 0,
    backgroundColor: 'transparent',
    // paddingBottom: 24,
    height: '100%',
    maxHeight: '100%',
  },
}));
