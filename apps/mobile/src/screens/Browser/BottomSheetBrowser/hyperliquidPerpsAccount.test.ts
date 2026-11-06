import type { Account } from '@/core/startupServices/preference';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import {
  isHyperliquidAppUrl,
  resolveHyperliquidPerpsAccount,
} from './hyperliquidPerpsAccount';

const ADDRESS = '0x341a1fBD51825E5a107DB54cCb3166DeBA145479';

const account = (type: string): Account =>
  ({ address: ADDRESS, type, brandName: type } as Account);

const resolve = (
  connected: Account | null,
  accounts: Account[],
  enablePerpsWatchAddress = false,
) =>
  resolveHyperliquidPerpsAccount({
    dapp: {
      isConnected: !!connected,
      currentAccount: connected
        ? { ...connected, address: connected.address.toLowerCase() }
        : null,
    },
    accounts,
    enablePerpsWatchAddress,
  });

describe('hyperliquidPerpsAccount', () => {
  it('matches only the Hyperliquid app origin', () => {
    expect(isHyperliquidAppUrl('https://app.hyperliquid.xyz/trade/HYPE')).toBe(
      true,
    );
    expect(isHyperliquidAppUrl('https://hyperliquid.xyz')).toBe(false);
    expect(isHyperliquidAppUrl(undefined)).toBe(false);
  });

  it('uses the connected account when Perps can select it', () => {
    const mnemonic = account(KEYRING_CLASS.MNEMONIC);
    expect(resolve(mnemonic, [mnemonic])).toBe(mnemonic);
  });

  it('falls back to Perps own account when not connected or unsupported', () => {
    const safe = account(KEYRING_CLASS.GNOSIS);
    const watch = account(KEYRING_CLASS.WATCH);

    expect(resolve(null, [safe, watch])).toBeUndefined();
    expect(resolve(safe, [safe])).toBeUndefined();
    expect(resolve(watch, [watch])).toBeUndefined();
    expect(resolve(watch, [watch], true)).toBe(watch);
    expect(resolve(account(KEYRING_CLASS.MNEMONIC), [watch])).toBeUndefined();
  });
});
