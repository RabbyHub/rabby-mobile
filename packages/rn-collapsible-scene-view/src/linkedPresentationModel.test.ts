import {
  createLinkedPresentationCommandEdge,
  getLinkedPresentationChildPosition,
  getLinkedPresentationDragFraction,
  getLinkedPresentationRootPosition,
  resolveLinkedPresentationEndpoint,
  resolveLinkedPresentationGestureEdge,
  type LinkedPresentationEdge,
} from './linkedPresentationModel';
import {
  buildLinkedSceneModel,
  type LinkedScenePath,
} from './linkedSceneModel';

const positions = { key: 'positions' };
const basic = { key: 'orders', childKey: 'basic' };
const conditional = { key: 'orders', childKey: 'conditional' };
const account = { key: 'account' };
const model = buildLinkedSceneModel([
  { key: 'positions' },
  { key: 'orders', children: [{ key: 'basic' }, { key: 'conditional' }] },
  { key: 'account' },
]);

const gesture = (
  fromPath: LinkedScenePath,
  direction: -1 | 1,
  options: {
    pagingMode?: 'flat' | 'nested';
    childEligible?: boolean;
    remembered?: Readonly<Record<string, string>>;
  } = {},
) =>
  resolveLinkedPresentationGestureEdge({
    model,
    fromPath,
    direction,
    pagingMode: options.pagingMode ?? 'flat',
    childEligible: options.childEligible ?? false,
    remembered: options.remembered,
  });

const command = (
  fromPath: LinkedScenePath,
  toPath: LinkedScenePath,
  remembered?: Readonly<Record<string, string>>,
) =>
  createLinkedPresentationCommandEdge({
    model,
    fromPath,
    toPath,
    remembered,
  });

describe('linked presentation gesture routing', () => {
  it.each([
    [basic, account, -1],
    [conditional, positions, 1],
  ] as const)(
    'flat root return restores %j after clicking %j',
    (selectedChild, outsideRoot, direction) => {
      const remembered = { orders: selectedChild.childKey };
      const departure = command(selectedChild, outsideRoot, remembered)!;
      expect(departure.toPath).toStrictEqual(outsideRoot);
      const returned = gesture(departure.toPath, direction, { remembered });
      expect(returned?.scope).toBe('root');
      expect(returned?.toPath).toStrictEqual(selectedChild);
      expect(remembered).toStrictEqual({ orders: selectedChild.childKey });
    },
  );

  it.each([positions, account])(
    'flat root entry from %j restores either remembered child, independent of direction',
    fromPath => {
      for (const selectedChild of [basic, conditional]) {
        for (const childEligible of [false, true]) {
          const edge = gesture(fromPath, fromPath === positions ? 1 : -1, {
            childEligible,
            remembered: { orders: selectedChild.childKey },
          });
          expect(edge?.toPath).toStrictEqual(selectedChild);
          expect(edge?.frozenChildPositions[1]).toBe(
            selectedChild === basic ? 0 : 1,
          );
          for (const fraction of [0, 0.5, 1]) {
            expect(getLinkedPresentationChildPosition(edge!, 1, fraction)).toBe(
              selectedChild === basic ? 0 : 1,
            );
          }
        }
      }
    },
  );

  it.each([positions, account])(
    'flat root entry from %j defaults to the first child when memory is absent or stale',
    fromPath => {
      for (const remembered of [undefined, { orders: 'removed' }]) {
        expect(
          gesture(fromPath, fromPath === positions ? 1 : -1, { remembered })
            ?.toPath,
        ).toStrictEqual(basic);
      }
    },
  );

  it.each([false, true])(
    'flat gestures prioritize adjacent children before crossing roots, child hit=%s',
    childEligible => {
      const options = {
        childEligible,
        remembered: { orders: 'conditional' },
      };
      expect(gesture(positions, -1, options)).toBeNull();
      expect(gesture(account, 1, options)).toBeNull();
      for (const [fromPath, direction, toPath, scope] of [
        [basic, 1, conditional, 'child'],
        [conditional, -1, basic, 'child'],
        [basic, -1, positions, 'root'],
        [conditional, 1, account, 'root'],
      ] as const) {
        const edge = gesture(fromPath, direction, options)!;
        expect(edge.fromPath).toStrictEqual(fromPath);
        expect(edge.toPath).toStrictEqual(toPath);
        expect(edge.direction).toBe(direction);
        expect(edge.scope).toBe(scope);
      }
    },
  );

  it('flat boundary crossings between groups restore the destination child in either direction', () => {
    const grouped = buildLinkedSceneModel([
      { key: 'first', children: [{ key: 'a' }, { key: 'b' }] },
      { key: 'second', children: [{ key: 'a' }, { key: 'b' }] },
    ]);
    for (const [fromPath, direction, toPath] of [
      [{ key: 'first', childKey: 'b' }, 1, { key: 'second', childKey: 'b' }],
      [{ key: 'second', childKey: 'a' }, -1, { key: 'first', childKey: 'a' }],
    ] as const) {
      const edge = resolveLinkedPresentationGestureEdge({
        model: grouped,
        fromPath,
        direction,
        pagingMode: 'flat',
        childEligible: true,
        remembered: { first: 'a', second: 'b' },
      });
      expect(edge?.toPath).toStrictEqual(toPath);
      expect(edge?.scope).toBe('root');
    }
  });

  it('a committed child swipe or explicit child click determines subsequent root restoration', () => {
    const remembered = { orders: basic.childKey };
    const childSwipe = gesture(basic, 1, { remembered })!;
    expect(childSwipe.scope).toBe('child');
    expect(childSwipe.toPath).toStrictEqual(conditional);
    // The renderer records only the settled target in child memory.
    remembered.orders = childSwipe.toPath.childKey!;
    expect(
      command(account, { key: 'orders' }, remembered)?.toPath,
    ).toStrictEqual(conditional);
    expect(gesture(positions, 1, { remembered })?.toPath).toStrictEqual(
      conditional,
    );

    const explicitClick = command(conditional, basic, remembered)!;
    expect(explicitClick.toPath).toStrictEqual(basic);
    remembered.orders = explicitClick.toPath.childKey!;
    expect(
      command(positions, { key: 'orders' }, remembered)?.toPath,
    ).toStrictEqual(basic);
    expect(gesture(account, -1, { remembered })?.toPath).toStrictEqual(basic);
  });

  it('precise child content changes only its own child track', () => {
    const options = { pagingMode: 'nested', childEligible: true } as const;
    expect(gesture(basic, 1, options)?.toPath).toStrictEqual(conditional);
    expect(gesture(conditional, -1, options)?.toPath).toStrictEqual(basic);
    expect(gesture(basic, -1, options)).toBeNull();
    expect(gesture(conditional, 1, options)).toBeNull();
  });

  it('precise header/outside content changes roots without traversing children', () => {
    const options = { pagingMode: 'nested', childEligible: false } as const;
    expect(gesture(basic, 1, options)?.toPath).toStrictEqual(account);
    expect(gesture(conditional, -1, options)?.toPath).toStrictEqual(positions);
    expect(gesture(basic, -1, options)?.scope).toBe('root');
    expect(gesture(conditional, 1, options)?.scope).toBe('root');
  });

  it.each([positions, account])(
    'precise root entry restores child memory from %j',
    fromPath => {
      const edge = gesture(fromPath, fromPath === positions ? 1 : -1, {
        pagingMode: 'nested',
        remembered: { orders: 'conditional' },
      });
      expect(edge?.toPath).toStrictEqual(conditional);
      expect(edge?.frozenChildPositions[1]).toBe(1);
    },
  );

  it.each(['flat', 'nested'] as const)(
    'keeps an empty declared Orders page reachable in %s mode',
    pagingMode => {
      const empty = buildLinkedSceneModel([
        positions,
        { key: 'orders', children: [] },
        account,
      ]);
      const first = resolveLinkedPresentationGestureEdge({
        model: empty,
        fromPath: positions,
        direction: 1,
        pagingMode,
        childEligible: true,
      });
      expect(first?.toPath).toStrictEqual({ key: 'orders' });
      expect(first?.scope).toBe('root');
      const second = resolveLinkedPresentationGestureEdge({
        model: empty,
        fromPath: first!.toPath,
        direction: 1,
        pagingMode,
        childEligible: true,
      });
      expect(second?.toPath).toStrictEqual(account);
    },
  );

  it('precise single-child content clamps without parent handoff', () => {
    const single = buildLinkedSceneModel([
      positions,
      { key: 'orders', children: [{ key: 'basic' }] },
      account,
    ]);
    for (const direction of [-1, 1] as const) {
      expect(
        resolveLinkedPresentationGestureEdge({
          model: single,
          fromPath: basic,
          direction,
          pagingMode: 'nested',
          childEligible: true,
        }),
      ).toBeNull();
    }
  });

  it('never creates an edge for a one-page topology', () => {
    const one = buildLinkedSceneModel([positions]);
    for (const pagingMode of ['flat', 'nested'] as const) {
      for (const direction of [-1, 1] as const) {
        expect(
          resolveLinkedPresentationGestureEdge({
            model: one,
            fromPath: positions,
            direction,
            pagingMode,
            childEligible: true,
          }),
        ).toBeNull();
      }
    }
  });
});

describe('linked presentation commands and frozen topology', () => {
  it('parent-tab requests restore memory, exact-child requests override it', () => {
    const memory = { orders: 'conditional' };
    expect(command(positions, { key: 'orders' }, memory)?.toPath).toStrictEqual(
      conditional,
    );
    expect(command(positions, basic, memory)?.toPath).toStrictEqual(basic);
    expect(command(conditional, { key: 'orders' }, memory)).toBeNull();
  });

  it('direct root commands do not turn into flattened child-track traversal', () => {
    const edge = command(positions, account, { orders: 'conditional' })!;
    expect(edge.scope).toBe('root');
    expect(edge.fromRootIndex).toBe(0);
    expect(edge.toRootIndex).toBe(2);
    for (const fraction of [0, 0.25, 0.5, 0.75, 1]) {
      expect(getLinkedPresentationRootPosition(edge, fraction)).toBe(
        fraction * 2,
      );
      expect(getLinkedPresentationChildPosition(edge, 1, fraction)).toBe(1);
    }
  });

  it('direct same-root commands move only its child track', () => {
    const edge = command(conditional, basic)!;
    expect(edge.scope).toBe('child');
    expect(edge.direction).toBe(-1);
    expect(getLinkedPresentationRootPosition(edge, 0.4)).toBe(1);
    expect(getLinkedPresentationChildPosition(edge, 1, 0.4)).toBeCloseTo(0.6);
  });

  it('freezes source and destination child indices against later memory writes', () => {
    const grouped = buildLinkedSceneModel([
      { key: 'first', children: [{ key: 'a' }, { key: 'b' }] },
      { key: 'middle', children: [{ key: 'a' }, { key: 'b' }] },
      { key: 'last', children: [{ key: 'a' }, { key: 'b' }] },
    ]);
    const memory = { first: 'b', middle: 'b', last: 'a' };
    const edge = createLinkedPresentationCommandEdge({
      model: grouped,
      fromPath: { key: 'first', childKey: 'a' },
      toPath: { key: 'last', childKey: 'b' },
      remembered: memory,
    })!;
    memory.first = 'a';
    memory.middle = 'a';
    memory.last = 'b';
    expect(edge.frozenChildPositions).toStrictEqual([0, 1, 1]);
    for (const fraction of [0, 0.5, 1]) {
      expect(
        [0, 1, 2].map(index =>
          getLinkedPresentationChildPosition(edge, index, fraction),
        ),
      ).toStrictEqual([0, 1, 1]);
    }
  });

  it('handles key delimiters and repairs stale paths through the existing resolver', () => {
    expect(command(positions, { key: 'removed' })).toBeNull();
    expect(
      command(
        positions,
        { key: 'orders', childKey: 'removed' },
        {
          orders: 'conditional',
        },
      )?.toPath,
    ).toStrictEqual(conditional);
    const unusual = buildLinkedSceneModel([
      { key: 'a/b' },
      { key: 'a', children: [{ key: 'b' }] },
    ]);
    expect(
      createLinkedPresentationCommandEdge({
        model: unusual,
        fromPath: { key: 'a/b' },
        toPath: { key: 'a', childKey: 'b' },
      })?.scope,
    ).toBe('root');
  });
});

describe('linked presentation preview and fractional interruption', () => {
  const forward = command(positions, basic)!;
  const backward = command(basic, positions)!;
  const child = command(basic, conditional)!;

  const drag = (
    edge: LinkedPresentationEdge,
    startFraction: number,
    translationX: number,
    width = 400,
  ) =>
    getLinkedPresentationDragFraction({
      edge,
      startFraction,
      translationX,
      width,
    });

  it.each([forward, backward, child])(
    'captures an in-flight fraction without snapping or changing its edge %#',
    edge => {
      expect(drag(edge, 0.37, 0)).toBe(0.37);
      expect(drag(edge, 0.37, -40 * edge.direction)).toBeCloseTo(0.47);
      expect(drag(edge, 0.37, 40 * edge.direction)).toBeCloseTo(0.27);
      expect(drag(edge, 0.37, 1000 * edge.direction)).toBe(0);
      expect(drag(edge, 0.37, -1000 * edge.direction)).toBe(1);
    },
  );

  it('tracks reversal continuously instead of rounding to a settled page', () => {
    const translations = [-40, -80, -20, 0, 60];
    const expected = [0.5, 0.6, 0.45, 0.4, 0.25];
    translations.forEach((translation, index) => {
      expect(drag(forward, 0.4, translation)).toBeCloseTo(expected[index]);
    });
  });

  it('keeps a grabbed direct root jump one-to-one with the finger', () => {
    const edge = command(positions, account)!;
    const before = getLinkedPresentationRootPosition(edge, 0.4);
    const fraction = drag(edge, 0.4, -100);
    const after = getLinkedPresentationRootPosition(edge, fraction);
    expect(fraction).toBeCloseTo(0.525);
    expect((after - before) * 400).toBeCloseTo(100);
  });

  it('scales a multi-child direct command by its actual visual span', () => {
    const many = buildLinkedSceneModel([
      { key: 'orders', children: [{ key: 'a' }, { key: 'b' }, { key: 'c' }] },
    ]);
    const edge = createLinkedPresentationCommandEdge({
      model: many,
      fromPath: { key: 'orders', childKey: 'c' },
      toPath: { key: 'orders', childKey: 'a' },
    })!;
    const fraction = drag(edge, 0.5, 100);
    expect(fraction).toBe(0.625);
    expect(getLinkedPresentationChildPosition(edge, 0, fraction)).toBe(0.75);
  });

  it.each([0, -1, NaN, Infinity])(
    'invalid width %s preserves the captured fractional position',
    width => expect(drag(forward, 0.4, -100, width)).toBe(0.4),
  );

  it.each([NaN, Infinity, -Infinity])(
    'invalid drag %s cannot move the captured position',
    translation => expect(drag(forward, 0.4, translation)).toBe(0.4),
  );

  it.each([
    [-10, 0],
    [0.4, 0.4],
    [10, 1],
    [NaN, 0],
  ])('clamps projected fraction %s to %s', (fraction, expected) => {
    expect(getLinkedPresentationRootPosition(forward, fraction)).toBe(expected);
    expect(getLinkedPresentationChildPosition(child, 1, fraction)).toBe(
      expected,
    );
  });
});

describe('linked presentation release', () => {
  const forward = command(positions, basic)!;
  const backward = command(basic, positions)!;
  const release = (
    startFraction: number,
    fraction: number,
    translationX: number,
    velocityX = 0,
    edge = forward,
    width = 400,
  ) =>
    resolveLinkedPresentationEndpoint({
      edge,
      startFraction,
      fraction,
      translationX,
      velocityX,
      width,
    });

  it('preserves the quarter-page distance threshold from a settled endpoint', () => {
    expect(release(0, 0.249, -99.6)).toBe(0);
    expect(release(0, 0.25, -100)).toBe(1);
    expect(release(1, 0.751, 99.6)).toBe(1);
    expect(release(1, 0.75, 100)).toBe(0);
  });

  it('uses the nearest endpoint when grabbing a fractional animation', () => {
    expect(release(0.37, 0.37, 0)).toBe(0);
    expect(release(0.8, 0.8, 0)).toBe(1);
    expect(release(0.8, 0.49, 124)).toBe(0);
    expect(release(0.37, 0.5, -52)).toBe(1);
  });

  it('requires both meaningful distance and velocity for a fling', () => {
    expect(release(0, 0.03, -12, -600)).toBe(1);
    expect(release(0, 0.03, -12, -599)).toBe(0);
    expect(release(0, 0.029, -11.6, -3000)).toBe(0);
    expect(release(0, 0, 0, -3000)).toBe(0);
  });

  it('honors final fling reversal, not the sign of old net translation', () => {
    expect(release(0, 0.6, -240, 800)).toBe(0);
    expect(release(0.8, 0.2, 240, -800)).toBe(1);
    expect(release(0, 0.6, 240, -800, backward)).toBe(0);
    expect(release(0.8, 0.2, -240, 800, backward)).toBe(1);
  });

  it.each([NaN, Infinity, -Infinity])(
    'invalid velocity %s falls back to distance/nearest endpoint',
    velocity => {
      expect(release(0, 0.1, -40, velocity)).toBe(0);
      expect(release(0.8, 0.8, -40, velocity)).toBe(1);
    },
  );

  it('invalid geometry cannot turn a short drag into a fling', () => {
    expect(release(0, 0.1, -40, -900, forward, 0)).toBe(0);
  });
});
