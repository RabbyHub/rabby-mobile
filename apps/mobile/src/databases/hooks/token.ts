import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { useCallback, useMemo } from 'react';
import { Account } from '@/core/services/preference';
import {
  isSameAccount,
  useSwitchSceneCurrentAccount,
} from '@/hooks/accountsSwitcher';
import { type AccountSwitcherScene } from '@/hooks/sceneAccountInfoAtom';
import { zCreate } from '@/core/utils/reexports';
import {
  makeAvoidParallelAsyncFunc,
  resolveValFromUpdater,
  runIIFEFunc,
} from '@/core/utils/store';
import { TokenItemEntity } from '../entities/tokenitem';
import { getSortedAddressList } from '@/hooks/account';
import { OPSQLiteEvents } from '@/core/databases/op-sqlite/events';
import { keyringService, preferenceService } from '@/core/services';
import { getFullTableName } from '../constant';
import { debounce } from 'lodash';
import { TokenItemTagView } from '../views/tokenitem_tag';

export type TokenItemMaybeWithOwner = TokenItem & {
  // ownerAddress?: string;
  ownerAccount?: Account | null;
};

export function extractOwnerAccountFromTokenItem(
  token: TokenItem | TokenItemMaybeWithOwner,
) {
  if ('ownerAccount' in token) {
    return token.ownerAccount || null;
  }

  return null;
}

export function makeKeyForTokenItemMaybeWithOwner(
  token: TokenItemMaybeWithOwner,
  tokenKey?: string,
) {
  const ownerAccount = extractOwnerAccountFromTokenItem(token);
  const ownerKey = !ownerAccount
    ? ''
    : `${ownerAccount.type}-${ownerAccount.address}`;

  const token_key = [
    ownerKey,
    tokenKey || `${token.id}-${token.optimized_symbol}-${token.chain}`,
  ]
    .filter(Boolean)
    .join('-');

  return token_key;
}

export function useSwitchSceneAccountOnSelectedTokenWithOwner(
  forScene: AccountSwitcherScene,
) {
  const { switchSceneCurrentAccount } = useSwitchSceneCurrentAccount();

  const switchAccountOnSelectedToken = useCallback(
    (input: {
      token: TokenItemMaybeWithOwner;
      currentAccount: Account | null;
    }) => {
      const result = { accountSwitchTo: null as Account | null };
      const maybeOwnerAccount = extractOwnerAccountFromTokenItem(input.token);
      if (
        maybeOwnerAccount &&
        !isSameAccount(maybeOwnerAccount, input.currentAccount)
      ) {
        switchSceneCurrentAccount(forScene, maybeOwnerAccount);

        result.accountSwitchTo = maybeOwnerAccount;
      }

      return result;
    },
    [forScene, switchSceneCurrentAccount],
  );

  return { switchAccountOnSelectedToken };
}

type LocalTokenItem = TokenItem & { _db_id: string };
type LocalTokenSourceState = {
  myAllTokenCount: number;
  /**
   * @description include tokens from primary addresses
   */
  myAllTokens: Record<TokenItemEntity['_db_id'], LocalTokenItem>;
};

const localTokenSource = zCreate<LocalTokenSourceState>(() => ({
  relatedAddresses: [],
  myAllTokenCount: 0,
  myAllTokens: {},
}));

export function useMyAllTokens() {
  const myAllTokens = localTokenSource(state => state.myAllTokens);

  return {
    myAllTokens,
  };
}

// type GetAllFuncKeys<T extends object> = {
//   [K in keyof T]: T[K] extends (...args: any[]) => any ? K : never
// }[keyof T];
// type ExcludeFuncKey<T extends object> = Omit<T, GetAllFuncKeys<T>>

const fetchAllTokens = makeAvoidParallelAsyncFunc(async () => {
  const myAddresses = [
    ...new Set(
      (await getSortedAddressList()).allMyAccounts
        .slice(0, 10)
        .map(item => item.address.toLowerCase()),
    ),
  ];
  const myAllTokens = await TokenItemEntity.batchMultiAddressTokens(
    myAddresses,
  );

  const tokensDict: Record<TokenItemEntity['_db_id'], LocalTokenItem> = {};
  myAllTokens.forEach(token => {
    tokensDict[token._db_id] = token;
  });

  localTokenSource.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev.myAllTokens, tokensDict, {
      strict: false,
    });

    return {
      ...prev,
      relatedAddresses: myAddresses,
      myAllTokenCount: myAllTokens.length,
      myAllTokens: newVal,
    };
  });
});

export const startSubscribeTokenSource = async () => {
  // await fetchAllTokens();
};

type LocalTokensVaryInfo = Pick<
  Awaited<ReturnType<typeof TokenItemEntity.getTokenLightRows>>,
  | 'temp_table'
  | 'all_rows'
  | '$fold_token_rows'
  | 'unfold_token_rows'
  | 'fold_and_include_balance'
  | 'fold_and_exclude_balance'
  | 'scam'
>;
type LocalTokensMetaState = {
  statics: null | Awaited<ReturnType<typeof TokenItemEntity.getStaticsInfo>>;
} & LocalTokensVaryInfo;

export const localTokenMetaStore = zCreate<LocalTokensMetaState>(() => ({
  temp_table: [],
  all_rows: [],

  $fold_token_rows: [],
  unfold_token_rows: [],
  fold_and_include_balance: [],
  fold_and_exclude_balance: [],
  scam: [],

  statics: null,
}));

const fetchTokenStaticsInfo = makeAvoidParallelAsyncFunc(async () => {
  const userTokenSettings = preferenceService.getUserTokenSettingsSync();
  const addresses = [
    ...new Set(
      (await getSortedAddressList()).allMyAccounts
        .slice(0, 10)
        .map(item => item.address.toLowerCase()),
    ),
  ];
  const static_result = await TokenItemEntity.getStaticsInfo({
    addresses: addresses,
    purpose: 'multi_addresses_tokens',
    foldTokens: userTokenSettings.foldTokens,
    unfoldTokens: userTokenSettings.unfoldTokens,
    includeDefiAndTokens: userTokenSettings.includeDefiAndTokens,
    excludeDefiAndTokens: userTokenSettings.excludeDefiAndTokens,
  });

  const ret: LocalTokensVaryInfo & {
    all_rows: Awaited<
      ReturnType<typeof TokenItemEntity.getTokenLightRows>
    >['all_rows'];
  } = {
    temp_table: [],
    all_rows: [],
    $fold_token_rows: [],
    unfold_token_rows: [],
    fold_and_include_balance: [],
    fold_and_exclude_balance: [],
    scam: [],
  };

  await TokenItemTagView.__tempTableTag__({
    action: 'tagtemp',
    token_settings: userTokenSettings,
    statics: static_result,
  });

  localTokenMetaStore.setState(prev => {
    const { newVal, changed } = resolveValFromUpdater(
      prev.statics,
      static_result,
      { strict: true },
    );

    if (!changed) return prev;

    return { ...prev, statics: newVal };
  });

  await Promise.allSettled([
    TokenItemEntity.getTokenLightRows({
      type: 'multi_addresses_tokens',
      purpose: 'unfold_token_rows',
      static_info: static_result,
      addresses: addresses,
    }).then(res => {
      ret.unfold_token_rows = res.unfold_token_rows;
      localTokenMetaStore.setState(prev => {
        return { ...prev, unfold_token_rows: res.unfold_token_rows };
      });
    }),
    TokenItemEntity.getTokenLightRows({
      type: 'multi_addresses_tokens',
      purpose: '$fold_token_rows',
      static_info: static_result,
      addresses: addresses,
    }).then(res => {
      ret.$fold_token_rows = res.$fold_token_rows;
      localTokenMetaStore.setState(prev => {
        return { ...prev, $fold_token_rows: res.$fold_token_rows };
      });
    }),
  ]);
  await Promise.allSettled([
    // await TokenItemEntity.getTokenLightRows({
    //   type: 'all',
    //   addresses: addresses,
    // }).then(res => ret.all_rows = res.all_rows),
    // await TokenItemEntity.getTokenLightRows({
    //   type: 'multi_addresses_tokens',
    //   purpose: 'temp_table',
    //   static_info: static_result,
    //   addresses: addresses,
    // }).then(res => (ret.temp_table = res.temp_table)),
    await TokenItemEntity.getTokenLightRows({
      type: 'multi_addresses_tokens',
      purpose: 'fold_and_include_balance',
      static_info: static_result,
      addresses: addresses,
    }).then(
      res => (ret.fold_and_include_balance = res.fold_and_include_balance),
    ),
    await TokenItemEntity.getTokenLightRows({
      type: 'multi_addresses_tokens',
      purpose: 'fold_and_exclude_balance',
      static_info: static_result,
      addresses: addresses,
    }).then(
      res => (ret.fold_and_exclude_balance = res.fold_and_exclude_balance),
    ),
    await TokenItemEntity.getTokenLightRows({
      type: 'multi_addresses_tokens',
      purpose: 'scam',
      static_info: static_result,
      addresses: addresses,
    }).then(res => (ret.scam = res.scam)),
  ]);

  localTokenMetaStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev, ret, { strict: false });

    return {
      ...newVal,
      all_rows: ret.all_rows,

      unfold_token_rows: ret.unfold_token_rows,
      fold_and_include_balance: ret.fold_and_include_balance,
      fold_and_exclude_balance: ret.fold_and_exclude_balance,
      scam: ret.scam,
    };
  });
});

export const startSubscribeTokenStatics = async () => {
  TokenItemTagView.__tempTableTag__({ action: 'on_bootstrap' });

  keyringService.on('unlock', () => {
    fetchTokenStaticsInfo();
  });
  OPSQLiteEvents.subscribe(
    'UPDATE_HOOK',
    debounce(payload => {
      if (payload.table !== getFullTableName('tokenitem')) return;

      fetchTokenStaticsInfo();
    }, 800),
  );

  OPSQLiteEvents.subscribe('TRIGGER_TOKEN_STATICS_REFRESH', () => {
    fetchTokenStaticsInfo();
  });
};
