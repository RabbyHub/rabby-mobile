const store = {
  provider: null,
  sendRequest: null,
};

export function setGlobalProvider(provider: any) {
  store.provider = provider;
}

export function getGlobalProvider(): any {
  return store.provider;
}

export function setGlobalTmpStore(nextStore: any) {
  Object.assign(store, nextStore);
}

export function getGlobalTmpStore(key: keyof typeof store): any {
  return store[key];
}
