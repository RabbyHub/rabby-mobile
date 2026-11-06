import KeystoneKeyring, {
  AcquireMemeStoreData,
  MemStoreDataReady,
} from './KeystoneKeyring';

const makeRequest = (requestId: string) => ({
  requestId,
  payload: { type: 'eth-sign-request', cbor: 'a1' },
});

describe('KeystoneKeyring MemStoreDataReady', () => {
  const keyring = new KeystoneKeyring();
  // constructing again returns the singleton and must not re-wire listeners
  new KeystoneKeyring();
  const interaction = keyring.getInteraction();
  const memStore = keyring.getMemStore();
  const onReady = jest.fn();

  beforeAll(() => {
    interaction.on(MemStoreDataReady, onReady);
  });

  beforeEach(() => {
    onReady.mockClear();
    keyring.resetStore();
  });

  it('pushes a request created after the page pulled, once', () => {
    interaction.emit(AcquireMemeStoreData);
    expect(onReady).not.toHaveBeenCalled();

    const request = makeRequest('req-1');
    memStore.updateState({ sign: { request } });
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(onReady).toHaveBeenLastCalledWith(request);

    // unrelated state updates do not push again
    memStore.updateState({ sync: { reading: true } });
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it('answers a pull when the request already exists', () => {
    const request = makeRequest('req-2');
    memStore.updateState({ sign: { request } });
    onReady.mockClear();

    interaction.emit(AcquireMemeStoreData);
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(onReady).toHaveBeenLastCalledWith(request);
  });

  it('pushes the next request again, even with a reused id after reset', () => {
    memStore.updateState({ sign: { request: makeRequest('req-3') } });
    memStore.updateState({ sign: { request: makeRequest('req-4') } });
    expect(onReady).toHaveBeenCalledTimes(2);

    keyring.resetStore();
    memStore.updateState({ sign: { request: makeRequest('req-4') } });
    expect(onReady).toHaveBeenCalledTimes(3);
  });
});
