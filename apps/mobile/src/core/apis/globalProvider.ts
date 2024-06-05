const store = {
  provider: null,
};

export function setGlobalProvider(provider: any) {
  store.provider = provider;
}

export function getGlobalProvider(): any {
  return store.provider;
}
