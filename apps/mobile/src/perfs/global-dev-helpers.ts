const defaulKeyFn = (item: any) =>
  typeof item === 'string' ? item : JSON.stringify(item);

/**
 * @description diff two lists by comparing item values
 */
export function diffLists<T>(
  oldList: T[],
  newList: T[],
  keyFn?: (item: T) => string,
) {
  const oldMap = new Map<string, T>();
  keyFn = keyFn || defaulKeyFn;
  oldList.forEach(item => {
    oldMap.set(keyFn(item), item);
  });

  const newMap = new Map<string, T>();
  newList.forEach(item => {
    newMap.set(keyFn(item), item);
  });

  const added: T[] = [];
  const removed: T[] = [];
  // const bothHas = new Set<string>();
  const bothHasList: string[] = [];
  const updated: { oldItem: T; newItem: T }[] = [];

  newMap.forEach((newItem, key) => {
    if (!oldMap.has(key)) {
      added.push(newItem);
    } else {
      bothHasList.push(key);
      const oldItem = oldMap.get(key)!;
      if (JSON.stringify(oldItem) !== JSON.stringify(newItem)) {
        updated.push({ oldItem, newItem });
      }
    }
  });

  oldMap.forEach((oldItem, key) => {
    if (!newMap.has(key)) {
      removed.push(oldItem);
    } else {
      bothHasList.push(key);
    }
  });

  return {
    added,
    removed,
    updated,
    bothHasList,
    bothHas: [...new Set(bothHasList)],
  };
}

function setupGlobalDevHelpers() {
  if (!__DEV__) return;

  globalThis.__diffLists = diffLists;
}

setupGlobalDevHelpers();
