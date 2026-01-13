import { atom, useAtom } from 'jotai';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { type AccountSwitcherScene } from '@/hooks/sceneAccountInfoAtom';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { TokenItemEntity } from '@/databases/entities/tokenitem';
import { apisAccount } from '@/core/apis';
import { AbstractPortfolioToken } from '@/screens/Home/types';
import { useRequest } from 'ahooks';
import { isEqual } from 'lodash';
import { resolveValFromUpdater, UpdaterOrPartials } from '@/core/utils/store';
import { zCreate } from '@/core/utils/reexports';
import { keyringService } from '@/core/services';
import { ITokenItem } from '@/store/tokens';
import { perfEvents } from '@/core/utils/perf';

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
  Lending: makeDefaultState(),
  TokenDetail: makeDefaultState(),

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

function getTop5Tokens(tokens: TokenItem[]): TokenItem[] {
  const tokenMap: { [symbol: string]: TokenItem } = {};
  let sum = 0;
  tokens.forEach(token => {
    sum += token.price * token.amount;
    const item = (tokenMap[token.symbol] = tokenMap[token.symbol] || {
      ...token,
      usd_value: 0,
    });
    item.usd_value = item.usd_value || 0;
    item.usd_value += token.price * token.amount;
  });

  const aggregatedTokens = Object.values(tokenMap);

  aggregatedTokens.sort((a, b) => (b.usd_value ?? 0) - (a.usd_value ?? 0));

  return aggregatedTokens
    .slice(0, 5)
    .filter(
      item => (item.usd_value || 0) > 10 && (item.usd_value || 0) > sum * 0.1,
    );
}

// const addressTop5TokensAtom = atom<{
//   [addr: string]: TokenItem[];
// }>({});
type AccountSwitchState = {
  top5Tokens: { [addr: string]: TokenItem[] };
};
const accountSwitchStore = zCreate<AccountSwitchState>(() => {
  return {
    top5Tokens: {},
  };
});

const setAddressTop5Tokens = (
  valOrFunc: UpdaterOrPartials<AccountSwitchState['top5Tokens']>,
) => {
  accountSwitchStore.setState(prev => ({
    ...prev,
    top5Tokens: resolveValFromUpdater(prev.top5Tokens, valOrFunc).newVal,
  }));
};

const setTokensByAddr = (addr: string, tokens: TokenItem[]) => {
  setAddressTop5Tokens(prev => {
    if (isEqual(prev[addr], tokens)) {
      return prev;
    }
    return {
      ...prev,
      [addr]: tokens,
    };
  });
};

const fetchTokensByAddresses = (addrs: string[], count = 5) => {
  TokenItemEntity.queryTokensByOwner(addrs, {
    filter_tokenGte10Dollar: false,
    filter_tokenProportionGte10Percent: false,
  }).then(tokens => {
    const tokensByAddr: { [addr: string]: TokenItem[] } = {};
    addrs.forEach(addr => {
      tokensByAddr[addr] = [];
    });
    tokens.forEach(token => {
      const list = (tokensByAddr[token.owner_addr] =
        tokensByAddr[token.owner_addr] || []);
      list.push(token);
    });
    Object.entries(tokensByAddr).forEach(([addr, tokens]) => {
      setTokensByAddr(addr, getTop5Tokens(tokens));
    });
  });
};

function useTopTokensByAccount() {
  const addressTop5Tokens = accountSwitchStore(s => s.top5Tokens);

  return { addressTop5Tokens };
}

const fetchedRef = { current: false };
export const fetchTop5TokensForAllAccountsOnce = () => {
  if (fetchedRef.current) return;
  fetchedRef.current = true;

  apisAccount
    .getAllAccountsToDisplay()
    .then(accounts => {
      const addresses = new Set([...accounts.map(account => account.address)]);
      fetchTokensByAddresses([...addresses]);
    })
    .catch(error => {
      console.error('[useFetchTokensForAllAccounts] error', error);
      fetchedRef.current = false;
    });
};

export function startFetchOnceTop5TokensForAllAccounts() {
  const onUnlock = () => {
    fetchTop5TokensForAllAccountsOnce();
    sub.remove();
  };
  const sub = perfEvents.subscribe('USER_MANUALLY_UNLOCK', onUnlock);
}

export function useTopTokensForAddress(options?: {
  accountAddress?: string;
  count?: number;
}) {
  const { count = 5, accountAddress } = options || {};
  const { addressTop5Tokens } = useTopTokensByAccount();

  const lowerAddr = useMemo(
    () => accountAddress?.toLowerCase(),
    [accountAddress],
  );
  useEffect(() => {
    if (!lowerAddr) return;

    fetchTokensByAddresses([lowerAddr], count);
  }, [lowerAddr, count]);

  const tokenList = useMemo(() => {
    return lowerAddr ? addressTop5Tokens[lowerAddr]?.slice(0, count) : null;
  }, [addressTop5Tokens, lowerAddr, count]);

  return {
    addressTop5Tokens,
    tokenList,
  };
}

export function useTokenAmountForAddress(options?: {
  accountAddress?: string;
  token?: ITokenItem;
}) {
  const { accountAddress, token } = options || {};

  const { data, loading } = useRequest(
    () => {
      if (!accountAddress || !token) {
        return Promise.resolve({
          amount: 0,
          success: false,
        });
      }
      return TokenItemEntity.getAddressesAmount({
        address: accountAddress,
        chain: token.chain,
        tokenId: token.id,
      });
    },
    {
      refreshDeps: [accountAddress, token?.chain, token?.id],
    },
  );

  return { tokenAmount: data?.amount, loading, enableFetch: data?.success };
}
