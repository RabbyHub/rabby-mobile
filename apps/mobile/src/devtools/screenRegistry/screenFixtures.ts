/**
 * Default route params for screens that dereference optional params.
 *
 * `node scripts/gen-screen-registry.mjs --report` lists the screens whose route
 * type marks a param optional while the screen reads it as if it were present.
 * Opening those with no params throws inside render, so the harness fills in a
 * plausible default here. Explicit params passed through the deeplink always
 * win over these.
 *
 * Values are intentionally derived from the current wallet state (fallback
 * account) instead of hard-coded addresses, so the fixture keeps working on any
 * device. Screens that need domain-specific data (tokens, markets, quotes) are
 * not guessed here - pass those through the deeplink.
 */
import { getFallbackAccountSnapshot } from '@/core/serviceApi/preference';
import { KEYRING_CLASS, KEYRING_TYPE } from '@rabby-wallet/keyring-utils';

export type ScreenFixture = (context: {
  account: ReturnType<typeof getFallbackAccountSnapshot>;
}) => Record<string, unknown>;

const accountShape = (account: any) => ({
  address: account?.address,
  type: account?.type || KEYRING_TYPE.SimpleKeyring,
  brandName: account?.brandName || KEYRING_CLASS.PRIVATE_KEY,
});

export const SCREEN_PARAM_FIXTURES: Record<string, ScreenFixture> = {
  // Address-scoped screens: address + keyring type/brand.
  AddressDetail: ({ account }) => accountShape(account),
  Backup: ({ account }) => accountShape(account),
  Receive: ({ account }) => ({ type: 'eth', account: account ?? undefined }),

  // Approvals / revoke flows read `account`.
  Approvals: ({ account }) => ({ account: account ?? undefined }),
  GnosisTransactionQueue: ({ account }) => ({ account: account ?? undefined }),

  // Revoke list defaults to an empty state instead of `undefined.length`.
  BatchRevoke: ({ account }) => ({
    account: account ?? undefined,
    revokeList: [],
    // `useBatchRevokeTask.init` calls `setList(dataSource)` and the list is
    // rendered with `.filter`, so the source must be an array.
    dataSource: [],
  }),

  // The import-success page keeps the freshly imported keyring in params.
  ImportSuccess2024: ({ account }) => accountShape(account),

  // History detail dereferences `data.tx` and `data.chain`; give it the
  // smallest shape that renders without a real transaction.
  HistoryDetail: ({ account }) => ({
    account: account ?? undefined,
    title: 'History',
    isForMultipleAddress: false,
    data: {
      tx: {
        status: 1,
        from_addr: account?.address,
        to_addr: account?.address,
      },
      chain: 'eth',
      is_scam: false,
      time_at: Math.floor(Date.now() / 1000),
      // The screen reads `data.historyType` to pick which token list to use;
      // without it the send branch indexes `data.receives[0]`.
      historyType: 'send',
      sends: [{ amount: 0 }],
      receives: [],
      status: 1,
    },
  }),

  // History screens read the current address and optional token context.
  History: ({ account }) => ({
    currentAddress: account?.address,
    isInTokenDetail: false,
  }),
  MultiAddressHistory: ({ account }) => ({
    currentAddress: account?.address,
    isInTokenDetail: false,
  }),

  // Import flows read their initial tab.
  ImportSecret: () => ({ initialTab: 'seedPhrase' }),
  ImportRabbyWallet: () => ({ flow: 'create' }),
  PerpsProHistory: () => ({ initialTab: 'history' }),
  PerpsSearch: () => ({ initialTab: 'market', autoFocus: false }),
};

export function resolveScreenFixture(screenId: string) {
  const fixture = SCREEN_PARAM_FIXTURES[screenId];
  if (!fixture) {
    return {};
  }
  try {
    return fixture({ account: getFallbackAccountSnapshot() });
  } catch (error) {
    console.warn(
      `[screenRegistry] fixture for "${screenId}" failed:`,
      (error as Error)?.message,
    );
    return {};
  }
}
