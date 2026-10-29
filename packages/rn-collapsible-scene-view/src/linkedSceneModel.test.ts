import {
  buildLinkedSceneModel,
  linkedScenePhysicalKey,
  pathForPhysicalKey,
  physicalKeyForPath,
  projectLinkedSceneChildProgress,
  projectLinkedSceneProgress,
  resolveLinkedScenePath,
  type LinkedScenePage,
} from './linkedSceneModel';

const pages: readonly LinkedScenePage[] = [
  { key: 'positions' },
  {
    key: 'orders',
    children: [{ key: 'basic' }, { key: 'conditional' }],
  },
  { key: 'account' },
];
const model = buildLinkedSceneModel(pages);

describe('buildLinkedSceneModel', () => {
  it('flattens only leaf pages while retaining logical root and child indices', () => {
    expect(model.leaves).toStrictEqual([
      {
        path: { key: 'positions' },
        physicalKey: '["positions"]',
        index: 0,
        rootIndex: 0,
      },
      {
        path: { key: 'orders', childKey: 'basic' },
        physicalKey: '["orders","basic"]',
        index: 1,
        rootIndex: 1,
        childIndex: 0,
      },
      {
        path: { key: 'orders', childKey: 'conditional' },
        physicalKey: '["orders","conditional"]',
        index: 2,
        rootIndex: 1,
        childIndex: 1,
      },
      {
        path: { key: 'account' },
        physicalKey: '["account"]',
        index: 3,
        rootIndex: 2,
      },
    ]);
    expect(
      model.roots.map(({ key, rootIndex, firstLeafIndex, lastLeafIndex }) => ({
        key,
        rootIndex,
        firstLeafIndex,
        lastLeafIndex,
      })),
    ).toStrictEqual([
      { key: 'positions', rootIndex: 0, firstLeafIndex: 0, lastLeafIndex: 0 },
      { key: 'orders', rootIndex: 1, firstLeafIndex: 1, lastLeafIndex: 2 },
      { key: 'account', rootIndex: 2, firstLeafIndex: 3, lastLeafIndex: 3 },
    ]);
    expect(model.roots[1].leaves[1]).toBe(model.leaves[2]);
  });

  it('retains an explicitly empty group as one root leaf', () => {
    const emptyOrders = buildLinkedSceneModel([
      pages[0],
      { key: 'orders', children: [] },
      pages[2],
    ]);
    expect(emptyOrders.leaves.map(leaf => leaf.path)).toStrictEqual([
      { key: 'positions' },
      { key: 'orders' },
      { key: 'account' },
    ]);
    expect(emptyOrders.roots[1].leaves[0].childIndex).toBeUndefined();
  });

  it('keeps a single declared child rather than collapsing its logical identity', () => {
    const single = buildLinkedSceneModel([
      { key: 'orders', children: [{ key: 'basic' }] },
    ]);
    expect(single.leaves[0].path).toStrictEqual({
      key: 'orders',
      childKey: 'basic',
    });
    expect(single.leaves[0].childIndex).toBe(0);
    expect(projectLinkedSceneChildProgress(single, 'orders', 100)).toBe(0);
  });

  it('does not require child keys to be globally unique across different roots', () => {
    const repeated = buildLinkedSceneModel([
      { key: 'first', children: [{ key: 'same' }] },
      { key: 'second', children: [{ key: 'same' }] },
    ]);
    expect(new Set(repeated.leaves.map(leaf => leaf.physicalKey)).size).toBe(2);
  });

  it('does not use slash-concatenation or object-property names as physical identities', () => {
    const ambiguousNames = buildLinkedSceneModel([
      { key: 'orders/basic' },
      { key: 'orders', children: [{ key: 'basic' }] },
      { key: 'a/b', children: [{ key: 'c' }] },
      { key: 'a', children: [{ key: 'b/c' }] },
      { key: '__proto__', children: [{ key: 'constructor' }] },
      { key: 'quoted"\\[]', children: [{ key: '\n' }] },
    ]);
    expect(
      new Set(ambiguousNames.leaves.map(leaf => leaf.physicalKey)).size,
    ).toBe(6);
    for (const leaf of ambiguousNames.leaves) {
      expect(
        pathForPhysicalKey(ambiguousNames, leaf.physicalKey),
      ).toStrictEqual(leaf.path);
    }
  });

  it('has stable keys after root reordering and changes its topology identity', () => {
    const reordered = buildLinkedSceneModel([pages[2], pages[1], pages[0]]);
    expect(reordered.leaves[1].physicalKey).toBe(model.leaves[1].physicalKey);
    expect(reordered.topologyKey).not.toBe(model.topologyKey);
    expect(buildLinkedSceneModel(pages).topologyKey).toBe(model.topologyKey);
  });

  it('treats omitted children and explicitly empty children as the same topology', () => {
    expect(buildLinkedSceneModel([{ key: 'orders' }]).topologyKey).toBe(
      buildLinkedSceneModel([{ key: 'orders', children: [] }]).topologyKey,
    );
  });

  it('does not mutate inputs or retain mutable input path objects', () => {
    const mutable = [{ key: 'orders', children: [{ key: 'basic' }] }];
    const result = buildLinkedSceneModel(mutable);
    mutable[0].key = 'changed';
    mutable[0].children[0].key = 'changed';
    expect(result.leaves[0].path).toStrictEqual({
      key: 'orders',
      childKey: 'basic',
    });
    const frozen = Object.freeze([
      Object.freeze({
        key: 'orders',
        children: Object.freeze([Object.freeze({ key: 'basic' })]),
      }),
    ]);
    expect(() => buildLinkedSceneModel(frozen)).not.toThrow();
  });

  it.each<[readonly LinkedScenePage[], string]>([
    [[], 'at least one page'],
    [[{ key: '' }], 'non-empty page keys'],
    [[{ key: 'same' }, { key: 'same' }], 'unique root page keys'],
    [[{ key: 'orders', children: [{ key: '' }] }], 'non-empty child keys'],
    [
      [{ key: 'orders', children: [{ key: 'same' }, { key: 'same' }] }],
      'unique sibling keys',
    ],
  ])('rejects an invalid logical topology %#', (input, message) => {
    expect(() => buildLinkedSceneModel(input)).toThrow(message);
  });

  it('rejects deeper runtime input rather than silently ignoring grandchildren', () => {
    const deeper = [
      {
        key: 'orders',
        children: [{ key: 'basic', children: [{ key: 'unexpected' }] }],
      },
    ];
    expect(() => buildLinkedSceneModel(deeper)).toThrow('at most two levels');
  });
});

describe('logical path resolution', () => {
  it('uses remembered child for a parent-tab click', () => {
    expect(
      resolveLinkedScenePath(
        model,
        { key: 'orders' },
        { orders: 'conditional' },
      ),
    ).toStrictEqual({ key: 'orders', childKey: 'conditional' });
  });

  it('exact native leaf settlement wins over remembered parent selection', () => {
    expect(
      resolveLinkedScenePath(
        model,
        { key: 'orders', childKey: 'basic' },
        { orders: 'conditional' },
      ),
    ).toStrictEqual({ key: 'orders', childKey: 'basic' });
  });

  it('uses first child when parent has no valid memory', () => {
    expect(resolveLinkedScenePath(model, { key: 'orders' })).toStrictEqual({
      key: 'orders',
      childKey: 'basic',
    });
    expect(
      resolveLinkedScenePath(model, { key: 'orders' }, { orders: 'removed' }),
    ).toStrictEqual({ key: 'orders', childKey: 'basic' });
  });

  it('repairs a removed child using valid memory, then first child', () => {
    const removed = { key: 'orders', childKey: 'removed' };
    expect(
      resolveLinkedScenePath(model, removed, { orders: 'conditional' }),
    ).toStrictEqual({ key: 'orders', childKey: 'conditional' });
    expect(resolveLinkedScenePath(model, removed)).toStrictEqual({
      key: 'orders',
      childKey: 'basic',
    });
  });

  it('falls back to first leaf for a removed root, without leaking child memory', () => {
    const ordersFirst = buildLinkedSceneModel([pages[1], pages[0], pages[2]]);
    expect(
      resolveLinkedScenePath(
        ordersFirst,
        { key: 'removed', childKey: 'conditional' },
        { orders: 'conditional' },
      ),
    ).toStrictEqual({ key: 'orders', childKey: 'basic' });
  });

  it('removes stale child selection when topology changes to a single empty root', () => {
    const empty = buildLinkedSceneModel([{ key: 'orders', children: [] }]);
    expect(
      resolveLinkedScenePath(empty, { key: 'orders', childKey: 'conditional' }),
    ).toStrictEqual({ key: 'orders' });
  });

  it('ignores inherited memory properties', () => {
    const inherited = Object.create({ orders: 'conditional' }) as Record<
      string,
      string
    >;
    expect(
      resolveLinkedScenePath(model, { key: 'orders' }, inherited),
    ).toStrictEqual({
      key: 'orders',
      childKey: 'basic',
    });
  });

  it('resolves physical keys canonically and rejects stale native keys', () => {
    expect(
      physicalKeyForPath(model, { key: 'orders' }, { orders: 'conditional' }),
    ).toBe('["orders","conditional"]');
    expect(pathForPhysicalKey(model, '["orders","removed"]')).toBeUndefined();
    expect(pathForPhysicalKey(model, '["orders"]')).toBeUndefined();
    expect(pathForPhysicalKey(model, 'orders/basic')).toBeUndefined();
    expect(linkedScenePhysicalKey({ key: 'orders', childKey: 'basic' })).toBe(
      '["orders","basic"]',
    );
  });
});

describe('flat-track indicator projection', () => {
  it.each([
    [-1, 0],
    [0, 0],
    [0.25, 0.25],
    [0.75, 0.75],
    [1, 1],
    [1.25, 1],
    [1.5, 1],
    [1.75, 1],
    [2, 1],
    [2.25, 1.25],
    [2.75, 1.75],
    [3, 2],
    [4, 2],
  ])('projects physical %s to parent %s', (progress, expected) => {
    expect(projectLinkedSceneProgress(model, progress)).toBe(expected);
  });

  it.each([
    [-1, 0],
    [0.75, 0],
    [1, 0],
    [1.25, 0.25],
    [1.5, 0.5],
    [1.75, 0.75],
    [2, 1],
    [2.75, 1],
    [4, 1],
  ])('projects physical %s to group child %s', (progress, expected) => {
    expect(projectLinkedSceneChildProgress(model, 'orders', progress)).toBe(
      expected,
    );
  });

  it('does not invent child progress for plain or missing roots', () => {
    expect(
      projectLinkedSceneChildProgress(model, 'positions', 1.5),
    ).toBeUndefined();
    expect(
      projectLinkedSceneChildProgress(model, 'missing', 1.5),
    ).toBeUndefined();
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'uses a deterministic first-leaf origin for non-finite progress %s',
    progress => {
      expect(projectLinkedSceneProgress(model, progress)).toBe(0);
      expect(projectLinkedSceneChildProgress(model, 'orders', progress)).toBe(
        0,
      );
    },
  );

  it('supports independent adjacent groups and more than two children', () => {
    const groups = buildLinkedSceneModel([
      { key: 'first', children: [{ key: 'a' }, { key: 'b' }, { key: 'c' }] },
      { key: 'second', children: [{ key: 'a' }, { key: 'b' }] },
    ]);
    expect(projectLinkedSceneProgress(groups, 1.5)).toBe(0);
    expect(projectLinkedSceneChildProgress(groups, 'first', 1.5)).toBe(1.5);
    expect(projectLinkedSceneProgress(groups, 2.5)).toBe(0.5);
    expect(projectLinkedSceneChildProgress(groups, 'first', 2.5)).toBe(2);
    expect(projectLinkedSceneChildProgress(groups, 'second', 2.5)).toBe(0);
    expect(projectLinkedSceneProgress(groups, 3.5)).toBe(1);
    expect(projectLinkedSceneChildProgress(groups, 'second', 3.5)).toBe(0.5);
  });
});
