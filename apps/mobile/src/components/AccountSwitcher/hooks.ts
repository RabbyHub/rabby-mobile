import { atom, useAtom } from 'jotai';
import { useCallback, useEffect, useMemo } from 'react';

import { AccountSwitcherScene } from '@/hooks/accountsSwitcher';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { TokenItemEntity } from '@/databases/entities/tokenitem';
import { apisAccount } from '@/core/apis';
import { useAppOrmSyncEvents } from '@/databases/sync/_event';

type AccountSwitcherState = {
  /**
   * @default {true}
   */
  collapsed: boolean;
};

export type AccountSwitcherAopProps<T extends void | object = void> = {
  allowNullCurrentAccount?: boolean;
  forScene: AccountSwitcherScene;
} & (T extends void ? {} : T);

export type { AccountSwitcherScene };

function makeDefaultState(): AccountSwitcherState {
  return {
    collapsed: true,
  };
}
type CustomModalScene = Exclude<AccountSwitcherScene, 'Receive' | 'GasAccount'>;
const DefaultStates: {
  [key in CustomModalScene]?: AccountSwitcherState;
} = {
  MakeTransactionAbout: makeDefaultState(),
  // Send: makeDefaultState(),
  SendNFT: makeDefaultState(),
  // Swap: makeDefaultState(),
  // Bridge: makeDefaultState(),

  History: makeDefaultState(),
  MultiHistory: makeDefaultState(),
  // HistoryFilterScam: makeDefaultState(),

  // Receive: makeDefaultState(),
  // GasAccount: makeDefaultState(),

  '@ActiveDappWebViewModal': makeDefaultState(),
};

export const screenHeaderAccountSwitcherAtom = atom(DefaultStates);

export function useAccountSceneVisible(forScene?: AccountSwitcherScene) {
  const [scenes, setScenes] = useAtom(screenHeaderAccountSwitcherAtom);

  const toggleSceneVisible = useCallback(
    (scene: AccountSwitcherScene, nextVisible?: boolean) => {
      setScenes(prev => {
        nextVisible = nextVisible ?? !!prev[scene]?.collapsed;
        return {
          ...prev,
          [scene]: {
            ...prev[scene],
            collapsed: !nextVisible,
          },
        };
      });
    },
    [setScenes],
  );

  const getSceneVisible = useCallback(
    (scene: AccountSwitcherScene) => {
      if (__DEV__ && !scenes.hasOwnProperty(scene)) {
        console.error(
          `[useAccountSceneVisible] AccountSwitcher scene "${scene}" not found in state`,
        );
      }

      return !scenes[scene]?.collapsed;
    },
    [scenes],
  );

  return {
    toggleSceneVisible,
    getSceneVisible,
    isVisible:
      typeof forScene === 'undefined'
        ? undefined
        : !scenes[forScene]?.collapsed,
  };
}

const addressTop5TokensAtom = atom<{
  [addr: string]: TokenItem[];
}>({});
const addressTop5TokensRequestingRefs = {};
function useTopTokensByAccount() {
  const [addressTop5Tokens, setAddressTop5Tokens] = useAtom(
    addressTop5TokensAtom,
  );
  const setTokensByAddr = useCallback(
    (addr: string, tokens: TokenItem[]) => {
      setAddressTop5Tokens(prev => ({
        ...prev,
        [addr]: tokens,
      }));
    },
    [setAddressTop5Tokens],
  );

  function getTop5Tokens(tokens: TokenItem[]): TokenItem[] {
    const tokenMap: { [symbol: string]: TokenItem } = {};
    let sum = 0;
    tokens.forEach(token => {
      sum += token.price * token.amount;
      if (tokenMap[token.symbol]) {
        tokenMap[token.symbol].usd_value! += token.price * token.amount;
      } else {
        tokenMap[token.symbol] = {
          ...token,
          usd_value: token.price * token.amount,
        };
      }
    });

    const aggregatedTokens = Object.values(tokenMap);

    aggregatedTokens.sort((a, b) => (b.usd_value ?? 0) - (a.usd_value ?? 0));

    return aggregatedTokens
      .slice(0, 5)
      .filter(
        item => (item.usd_value || 0) > 10 && (item.usd_value || 0) > sum * 0.1,
      );
  }

  const fetchTokensByAddress = useCallback(
    (addr?: string, count = 5) => {
      if (!addr) return;
      if (addressTop5TokensRequestingRefs[addr]) return;
      addressTop5TokensRequestingRefs[addr] = true;

      TokenItemEntity.queryTokensByOwner(addr, {
        filter_tokenGte10Dollar: false,
        filter_tokenProportionGte10Percent: false,
      })
        .then(tokens => {
          setTokensByAddr(addr, getTop5Tokens(tokens));
        })
        .catch(error => {
          console.error('[useTopTokensByAccount] error', error);
          setTokensByAddr(addr, []);
        })
        .finally(() => {
          addressTop5TokensRequestingRefs[addr] = false;
        });
    },
    [setTokensByAddr],
  );

  return { addressTop5Tokens, fetchTokensByAddress };
}

const fetchedRef = { current: false };
export function useFetchTokensForAllAccounts() {
  const { fetchTokensByAddress } = useTopTokensByAccount();

  const fetchTop5TokensForAllAccountsOnce = useCallback(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    apisAccount
      .getAllAccountsToDisplay()
      .then(accounts => {
        accounts.forEach(account => {
          fetchTokensByAddress(account.address);
        });
      })
      .catch(error => {
        console.error('[useFetchTokensForAllAccounts] error', error);
        fetchedRef.current = false;
      });
  }, [fetchTokensByAddress]);

  return { fetchTop5TokensForAllAccountsOnce };
}

export function useTopTokensForAddress(options?: {
  accountAddress?: string;
  count?: number;
}) {
  const { count = 5, accountAddress } = options || {};
  const { addressTop5Tokens, fetchTokensByAddress } = useTopTokensByAccount();

  useEffect(() => {
    if (!accountAddress) return;

    fetchTokensByAddress(accountAddress, count);
  }, [accountAddress, fetchTokensByAddress, count]);

  // useAppOrmSyncEvents({
  //   taskFor: 'token',
  //   onRemoteDataUpserted: useCallback(({ success, owner_addr }) => {
  //     if (!success) return ;
  //     if (!owner_addr) return ;

  //     fetchTokensByAddress(owner_addr, count);
  //   }, [fetchTokensByAddress, count]),
  // });

  const tokenList = useMemo(() => {
    return accountAddress
      ? addressTop5Tokens[accountAddress]?.slice(0, count)
      : null;
  }, [addressTop5Tokens, accountAddress, count]);

  return {
    tokenList,
    fetchTokensByAddress,
  };
}
