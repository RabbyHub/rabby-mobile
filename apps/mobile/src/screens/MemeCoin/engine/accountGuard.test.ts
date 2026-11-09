// utils/account.ts re-exports from @/core/apis/account, which pulls in the ESM-only rabby-api client that jest cannot load
jest.mock('@/core/apis/account', () => ({}));

import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import {
  assertMemeTradeAccount,
  UnsupportedMemeTradeAccountError,
} from './accountGuard';

describe('assertMemeTradeAccount', () => {
  it.each([KEYRING_CLASS.MNEMONIC, KEYRING_CLASS.PRIVATE_KEY])(
    'allows %s accounts',
    type => {
      expect(() => assertMemeTradeAccount({ type })).not.toThrow();
    },
  );

  it.each([
    KEYRING_CLASS.HARDWARE.LEDGER,
    KEYRING_CLASS.WATCH,
    KEYRING_CLASS.GNOSIS,
    undefined,
  ])('rejects %s accounts', type => {
    expect(() => assertMemeTradeAccount({ type })).toThrow(
      UnsupportedMemeTradeAccountError,
    );
  });
});
