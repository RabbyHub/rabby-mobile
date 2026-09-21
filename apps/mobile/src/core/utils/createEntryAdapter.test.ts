import { createEntityAdapter, createEntityTools } from './createEntryAdapter';

type Item = {
  id: string;
  name: string;
  score: number;
};

function createItem(id: string, score: number): Item {
  return {
    id,
    name: `item-${id}`,
    score,
  };
}

describe('core/utils/createEntryAdapter', () => {
  it('adds entities by selected id, skips duplicates, sorts ids, and exposes selectors', () => {
    const actions: string[] = [];
    const adapter = createEntityAdapter<Item>({
      onStateChange: (_state, action) => actions.push(action),
      selectId: item => item.id,
      sortComparer: (left, right) => right.score - left.score,
    });

    let state = adapter.getInitialState({
      loaded: true,
    });
    state = adapter.addMany(state, [
      createItem('low', 1),
      createItem('high', 3),
      createItem('mid', 2),
    ]);
    const duplicateState = adapter.addOne(state, createItem('mid', 99));

    expect(duplicateState).toBe(state);
    expect(adapter.getSelectors().selectIds(state)).toEqual([
      'high',
      'mid',
      'low',
    ]);
    expect(
      adapter
        .getSelectors()
        .selectAll(state)
        .map(item => item.score),
    ).toEqual([3, 2, 1]);
    expect(adapter.getSelectors().selectById(state, 'mid')).toEqual(
      createItem('mid', 2),
    );
    expect(adapter.getSelectors().selectTotal(state)).toBe(3);
    expect(state.loaded).toBe(true);
    expect(actions).toEqual(['init', 'addOne', 'addOne', 'addOne', 'addMany']);
  });

  it('updates, upserts, removes, and resets normalized entity state', () => {
    const adapter = createEntityAdapter<Item>({
      selectId: item => item.id,
      sortComparer: (left, right) => right.score - left.score,
    });
    let state = adapter.getInitialState();

    state = adapter.setAll(state, [
      createItem('a', 1),
      createItem('b', 2),
      createItem('c', 3),
    ]);
    state = adapter.updateOne(state, {
      changes: {
        score: 10,
      },
      id: 'a',
    });
    state = adapter.upsertMany(state, [
      {
        ...createItem('b', 2),
        name: 'updated-b',
        score: 20,
      },
      createItem('d', 4),
    ]);
    state = adapter.removeMany(state, ['c', 'missing']);

    expect(state.ids).toEqual(['b', 'a', 'd']);
    expect(state.entities.b).toEqual({
      id: 'b',
      name: 'updated-b',
      score: 20,
    });
    expect(state.entities.c).toBeUndefined();

    state = adapter.removeOne(state, 'a');

    expect(state.ids).toEqual(['b', 'd']);
    expect(state.entities.a).toBeUndefined();
  });

  it('createEntityTools keeps internal state and writes changes through adapter callbacks', () => {
    const snapshots: string[][] = [];
    const adapter = createEntityAdapter<Item>({
      onStateChange: state => snapshots.push([...state.ids]),
      selectId: item => item.id,
      sortComparer: (left, right) => right.score - left.score,
    });
    const tools = createEntityTools(adapter);

    tools.addMany([createItem('a', 1), createItem('b', 2)]);
    tools.upsertOne({
      ...createItem('a', 3),
      name: 'updated-a',
    });

    expect(tools.selectors.selectIds()).toEqual(['a', 'b']);
    expect(tools.selectors.selectById('a')).toEqual({
      id: 'a',
      name: 'updated-a',
      score: 3,
    });
    expect(tools.selectors.selectTotal()).toBe(2);

    tools.reset({
      entities: {
        c: createItem('c', 5),
      },
      ids: ['c'],
    });

    expect(tools.selectors.selectAll()).toEqual([createItem('c', 5)]);
    expect(snapshots).toContainEqual(['a', 'b']);
  });

  it('continues adapter operations when onStateChange throws', () => {
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const adapter = createEntityAdapter<Item>({
      onStateChange: () => {
        throw new Error('listener failed');
      },
      selectId: item => item.id,
    });

    const state = adapter.addOne(adapter.getInitialState(), createItem('a', 1));

    expect(state.entities.a).toEqual(createItem('a', 1));
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error in onStateChange callback:',
      expect.any(Error),
    );
  });
});
