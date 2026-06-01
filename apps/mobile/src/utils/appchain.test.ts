import type { AppChainItem } from '@rabby-wallet/rabby-api/dist/types';
import {
  APP_CHAIN_PREFIX,
  formatAppChain,
  isAppChain,
  makeAppChainFromId,
} from './appchain';

describe('appchain utils', () => {
  it('creates and recognizes Rabby app-chain ids', () => {
    expect(APP_CHAIN_PREFIX).toBe('RABBY_APP_CHAIN_');
    expect(makeAppChainFromId('aave')).toBe('RABBY_APP_CHAIN_aave');
    expect(isAppChain('RABBY_APP_CHAIN_aave')).toBe(true);
    expect(isAppChain('eth')).toBe(false);
  });

  it('formats app-chain items into complex protocol-like objects', () => {
    const app = {
      id: 'aave',
      name: 'Aave',
      logo_url: 'https://assets.example/aave.png',
    } as AppChainItem;

    expect(formatAppChain(app)).toEqual({
      ...app,
      chain: 'RABBY_APP_CHAIN_aave',
      has_supported_portfolio: true,
      tvl: 0,
    });
  });
});
