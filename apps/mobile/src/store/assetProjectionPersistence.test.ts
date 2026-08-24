import { buildAssetProjectionStorageKey } from './assetProjectionIdentity';

describe('asset projection storage identity', () => {
  it('keeps kind, scene, and runtime key namespaces independent', () => {
    const tokenSingle = buildAssetProjectionStorageKey({
      kind: 'token',
      scene: 'single-address',
      runtimeKey: 'same-key',
    });
    const tokenMulti = buildAssetProjectionStorageKey({
      kind: 'token',
      scene: 'multi-address',
      runtimeKey: 'same-key',
    });
    const nftSingle = buildAssetProjectionStorageKey({
      kind: 'nft',
      scene: 'single-address',
      runtimeKey: 'same-key',
    });

    expect(new Set([tokenSingle, tokenMulti, nftSingle]).size).toBe(3);
  });

  it('does not collide when runtime keys contain separators', () => {
    expect(
      buildAssetProjectionStorageKey({
        kind: 'protocol',
        scene: 'multi-address',
        runtimeKey: 'a::b|c',
      }),
    ).not.toBe(
      buildAssetProjectionStorageKey({
        kind: 'protocol',
        scene: 'multi-address',
        runtimeKey: 'a|b::c',
      }),
    );
  });

  it('keeps high-cardinality runtime identities fixed-width and deterministic', () => {
    const identity = {
      kind: 'token' as const,
      scene: 'multi-address' as const,
      runtimeKey: Array.from(
        { length: 100 },
        (_, index) => `0x${index.toString(16).padStart(40, '0')}`,
      ).join('|'),
    };

    const first = buildAssetProjectionStorageKey(identity);
    const second = buildAssetProjectionStorageKey(identity);

    expect(first).toBe(second);
    expect(first).toMatch(/^ap:2:[0-9a-f]{64}$/);
    expect(first).toHaveLength(69);
  });
});
