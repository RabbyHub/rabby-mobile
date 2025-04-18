export interface EntityAdapterOptions<T, Id extends string | number> {
  selectId: (entity: T) => Id;
  sortComparer?: (a: T, b: T) => number;
  onStateChange?: (newState: EntityState<T, Id>, action: string) => void;
}

export interface EntityState<T, Id extends string | number> {
  ids: Id[];
  entities: Record<Id, T>;
}

export interface EntityAdapter<T, Id extends string | number> {
  getInitialState: <S extends Record<string, unknown>>(
    additionalState?: S,
  ) => EntityState<T, Id> & S;
  addOne: (state: EntityState<T, Id>, entity: T) => EntityState<T, Id>;
  addMany: (state: EntityState<T, Id>, entities: T[]) => EntityState<T, Id>;
  setAll: (state: EntityState<T, Id>, entities: T[]) => EntityState<T, Id>;
  removeOne: (state: EntityState<T, Id>, id: Id) => EntityState<T, Id>;
  removeMany: (state: EntityState<T, Id>, ids: Id[]) => EntityState<T, Id>;
  updateOne: (
    state: EntityState<T, Id>,
    update: { id: Id; changes: Partial<T> },
  ) => EntityState<T, Id>;
  updateMany: (
    state: EntityState<T, Id>,
    updates: Array<{ id: Id; changes: Partial<T> }>,
  ) => EntityState<T, Id>;
  upsertOne: (state: EntityState<T, Id>, entity: T) => EntityState<T, Id>;
  upsertMany: (state: EntityState<T, Id>, entities: T[]) => EntityState<T, Id>;
  getSelectors: <V>(selectState?: (state: V) => EntityState<T, Id>) => {
    selectIds: (state: V) => Id[];
    selectEntities: (state: V) => Record<Id, T>;
    selectAll: (state: V) => T[];
    selectTotal: (state: V) => number;
    selectById: (state: V, id: Id) => T | undefined;
  };
}

export function createEntityAdapter<T, Id extends string | number = string>(
  options: EntityAdapterOptions<T, Id>,
): EntityAdapter<T, Id> {
  const { selectId, sortComparer, onStateChange } = options;

  // 触发状态变化回调的辅助函数
  function notifyChange(state: EntityState<T, Id>, action: string) {
    if (onStateChange) {
      try {
        onStateChange(state, action);
      } catch (error) {
        console.error('Error in onStateChange callback:', error);
      }
    }
    return state;
  }

  function getInitialState<S extends Record<string, unknown>>(
    additionalState: S = {} as S,
  ): EntityState<T, Id> & S {
    const state = {
      ids: [],
      entities: {} as Record<Id, T>,
      ...additionalState,
    };
    notifyChange(state, 'init');
    return state;
  }

  function addOne(state: EntityState<T, Id>, entity: T): EntityState<T, Id> {
    const id = selectId(entity);
    if (state.ids.includes(id)) {
      return state;
    }

    const newEntities = {
      ...state.entities,
      [id]: entity,
    };

    const newIds = [...state.ids, id];
    if (sortComparer) {
      newIds.sort((a, b) => sortComparer(newEntities[a], newEntities[b]));
    }

    const newState = {
      ...state,
      ids: newIds,
      entities: newEntities,
    };

    return notifyChange(newState, 'addOne');
  }

  function addMany(
    state: EntityState<T, Id>,
    entities: T[],
  ): EntityState<T, Id> {
    let newState = { ...state };
    entities.forEach(entity => {
      newState = addOne(newState, entity);
    });
    return notifyChange(newState, 'addMany');
  }

  function setAll(
    state: EntityState<T, Id>,
    entities: T[],
  ): EntityState<T, Id> {
    const newEntities: Record<Id, T> = {} as Record<Id, T>;
    const newIds: Id[] = [];

    entities.forEach(entity => {
      const id = selectId(entity);
      newEntities[id] = entity;
      newIds.push(id);
    });

    if (sortComparer) {
      newIds.sort((a, b) => sortComparer(newEntities[a], newEntities[b]));
    }

    const newState = {
      ...state,
      ids: newIds,
      entities: newEntities,
    };

    return notifyChange(newState, 'setAll');
  }

  function removeOne(state: EntityState<T, Id>, id: Id): EntityState<T, Id> {
    if (!state.ids.includes(id)) {
      return state;
    }

    const newEntities = { ...state.entities };
    delete newEntities[id];

    const newState = {
      ...state,
      ids: state.ids.filter(existingId => existingId !== id),
      entities: newEntities,
    };

    return notifyChange(newState, 'removeOne');
  }

  function removeMany(
    state: EntityState<T, Id>,
    ids: Id[],
  ): EntityState<T, Id> {
    const idsToRemove = new Set(ids);
    const remainingIds = state.ids.filter(id => !idsToRemove.has(id));
    const remainingEntities = { ...state.entities };

    ids.forEach(id => {
      delete remainingEntities[id];
    });

    const newState = {
      ...state,
      ids: remainingIds,
      entities: remainingEntities,
    };

    return notifyChange(newState, 'removeMany');
  }

  function updateOne(
    state: EntityState<T, Id>,
    update: { id: Id; changes: Partial<T> },
  ): EntityState<T, Id> {
    const { id, changes } = update;
    const entity = state.entities[id];
    if (!entity) {
      return state;
    }

    const newState = {
      ...state,
      entities: {
        ...state.entities,
        [id]: {
          ...entity,
          ...changes,
        },
      },
    };
    const newIds = [...newState.ids];
    if (sortComparer) {
      newIds.sort((a, b) =>
        sortComparer(newState.entities[a], newState.entities[b]),
      );
      newState.ids = newIds;
    }

    return notifyChange(newState, 'updateOne');
  }

  function updateMany(
    state: EntityState<T, Id>,
    updates: Array<{ id: Id; changes: Partial<T> }>,
  ): EntityState<T, Id> {
    let newState = { ...state };
    updates.forEach(update => {
      newState = updateOne(newState, update);
    });

    return notifyChange(newState, 'updateMany');
  }

  function upsertOne(state: EntityState<T, Id>, entity: T): EntityState<T, Id> {
    const id = selectId(entity);
    const newState = state.entities[id]
      ? updateOne(state, { id, changes: entity })
      : addOne(state, entity);
    return notifyChange(newState, 'upsertOne');
  }

  function upsertMany(
    state: EntityState<T, Id>,
    entities: T[],
  ): EntityState<T, Id> {
    let newState = { ...state };
    entities.forEach(entity => {
      newState = upsertOne(newState, entity);
    });
    return notifyChange(newState, 'upsertMany');
  }

  function getSelectors<V>(selectState?: (state: V) => EntityState<T, Id>) {
    const selectStateFn =
      selectState ?? ((state: V) => state as unknown as EntityState<T, Id>);

    return {
      selectIds: (state: V) => selectStateFn(state).ids,
      selectEntities: (state: V) => selectStateFn(state).entities,
      selectAll: (state: V) => {
        const { ids, entities } = selectStateFn(state);
        return ids.map(id => entities[id]);
      },
      selectTotal: (state: V) => selectStateFn(state).ids.length,
      selectById: (state: V, id: Id) => {
        const { entities } = selectStateFn(state);
        return entities[id];
      },
    };
  }

  return {
    getInitialState,
    addOne,
    addMany,
    setAll,
    removeOne,
    removeMany,
    updateOne,
    updateMany,
    upsertOne,
    upsertMany,
    getSelectors,
  };
}

export function createEntityTools<T, K extends string | number = string>(
  adapter: EntityAdapter<T, K>,
  initialState?: EntityState<T, K>,
) {
  // 合并初始状态
  let state: EntityState<T, K> = initialState || adapter.getInitialState();

  return {
    // 获取当前状态
    getState: () => state,

    // 重置状态
    reset: (newState?: EntityState<T, K>) => {
      state = newState || adapter.getInitialState();
      return state;
    },

    // CRUD 操作
    addOne: (entity: T) => {
      state = adapter.addOne(state, entity);
      return state;
    },

    addMany: (entities: T[]) => {
      state = adapter.addMany(state, entities);
      return state;
    },

    setAll: (entities: T[]) => {
      state = adapter.setAll(state, entities);
      return state;
    },

    removeOne: (id: K) => {
      state = adapter.removeOne(state, id);
      return state;
    },

    removeMany: (ids: K[]) => {
      state = adapter.removeMany(state, ids);
      return state;
    },

    updateOne: (update: { id: K; changes: Partial<T> }) => {
      state = adapter.updateOne(state, update);
      return state;
    },

    updateMany: (updates: Array<{ id: K; changes: Partial<T> }>) => {
      state = adapter.updateMany(state, updates);
      return state;
    },

    upsertOne: (entity: T) => {
      state = adapter.upsertOne(state, entity);
      return state;
    },

    upsertMany: (entities: T[]) => {
      state = adapter.upsertMany(state, entities);
      return state;
    },

    // 选择器
    selectors: {
      selectAll: () => adapter.getSelectors().selectAll(state),
      selectById: (id: K) => adapter.getSelectors().selectById(state, id),
      selectIds: () => adapter.getSelectors().selectIds(state),
      selectTotal: () => adapter.getSelectors().selectTotal(state),
      selectEntities: () => adapter.getSelectors().selectEntities(state),
    },
  };
}

export type EntityTools<T, K extends string | number = string> = ReturnType<
  typeof createEntityTools<T, K>
>;
