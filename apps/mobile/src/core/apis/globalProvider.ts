import { EthereumProvider } from './buildinProvider';

type ProviderRef = { currentProvider: EthereumProvider };
const store = {
  provider: null as ProviderRef | null,
  sendRequest: null,
};

export function setGlobalProvider(provider: any) {
  store.provider = provider;
}

export function getGlobalProvider(): ProviderRef | null {
  return store.provider;
}

export function setGlobalTmpStore(nextStore: any) {
  Object.assign(store, nextStore);
}

export function getGlobalTmpStore(key: keyof typeof store): any {
  return store[key];
}
