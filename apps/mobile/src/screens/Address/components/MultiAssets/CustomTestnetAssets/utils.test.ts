import { makeMetadataTokenItem } from './utils';

describe('makeMetadataTokenItem', () => {
  it('does not mark unlabeled custom testnet tokens as scam', () => {
    const token = makeMetadataTokenItem(
      {
        id: '0xtoken',
        chainId: 9001,
        symbol: 'TEST',
        decimals: 6,
      },
      'custom_9001',
      '0xabc',
    );

    expect(token.is_verified).toBeNull();
    expect(token.is_suspicious).toBe(false);
    expect(token.is_scam).toBe(false);
    expect(token.is_core).toBe(false);
    expect(token.is_wallet).toBe(false);
  });
});
