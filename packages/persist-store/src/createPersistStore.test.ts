import * as sinon from 'sinon';
import type { SinonStubbedInstance } from 'sinon';

import createPersistStore from './createPersistStore';
import { type StorageAdapater, makeMemoryStorage } from './storageAdapter';

interface StorageItemTpl {
  [key: string]: any;
}

describe('createPersistStore', () => {
  let storageMock: SinonStubbedInstance<StorageAdapater<Record<string, StorageItemTpl>>>;
  let getItemStub: sinon.SinonStub<[string], StorageItemTpl | null>;
  let setItemStub: sinon.SinonStub<[keyof StorageItemTpl, any]>;
  let removeItemStub: sinon.SinonStub<[keyof StorageItemTpl]>;
  let clearAllStub: sinon.SinonStub<[]>;

  let memStorage: ReturnType<typeof makeMemoryStorage>;
  let branchClock: sinon.SinonFakeTimers;

  beforeEach(() => {
    getItemStub = sinon.stub();
    setItemStub = sinon.stub();
    removeItemStub = sinon.stub();
    clearAllStub = sinon.stub();

    storageMock = {
      getItem: getItemStub,
      getAll: () => ({}),
      setItem: setItemStub,
      removeItem: removeItemStub,
      clearAll: clearAllStub,
    } as unknown as SinonStubbedInstance<StorageAdapater<Record<string, StorageItemTpl>>>;

    memStorage?.clearAll();
    memStorage = makeMemoryStorage();
    branchClock = sinon.useFakeTimers();
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('shallow', () => {
    it('should create a persistent store with default template', async () => {
      const store = createPersistStore({ name: 'testStore' });
      expect(store).toBeDefined();
      expect(store).toEqual({});
    });

    it('should create a persistent store with a given template', async () => {
      const template = { key: 'value' };
      const store = createPersistStore({ name: 'testStore', template });
      expect(store).toBeDefined();
      expect(store).toEqual(template);
    });

    it('should initialize the store from the storage if fromStorage flag is true', async () => {
      const template: StorageItemTpl = { key: 'value' };
      getItemStub.withArgs('testStore').returns(template);
      const store = createPersistStore({ name: 'testStore', fromStorage: true }, { storage: storageMock });
      expect(store).toBeDefined();
      expect(store).toEqual(template);
    });

    it('should set and persist data to storage on property set', async () => {
      const store = createPersistStore<{ key: string }>({ name: 'testStore', template: { key: null } });
      expect(store.key).toEqual(null);

      store.key = 'value';
      expect(store.key).toEqual('value');
    });

    it('should delete property and persist data to storage on property delete', async () => {
      const store = createPersistStore<Partial<{ key: string }>>({ name: 'testStore', template: { key: 'value' } });

      expect(store.key).toEqual('value');

      delete store.key;
      expect(store.key).toEqual(undefined);
    });
  });

  describe('nested', () => {
    it('should set and persist data to storage on property nested-set', async () => {
      const store = createPersistStore<{ key: { a: string } }>({ name: 'testStore', template: { key: null } }, { storage: memStorage, persistDebounce: 500 });
      expect(store.key).toEqual(null);

      store.key = { a: 'value' };
      expect(store.key.a).toEqual('value');
      branchClock.tick(500);
      expect(memStorage.getItem('testStore')).toEqual({ key: { a: 'value' } });

      store.key.a = 'value2';
      expect(store.key.a).toEqual('value2');

      branchClock.tick(500);
      expect(memStorage.getItem('testStore')).toEqual({ key: { a: 'value2' } });
    });

    describe('should set and persist data to storage on property nested-add-property', () => {
      it('add new key', async () => {
        const store = createPersistStore<{ key: Record<string, any>, opt?: string }>({ name: 'testStore', template: { key: null } }, { storage: memStorage, persistDebounce: 500 });
        expect(store.key).toEqual(null);

        store.opt = 'optvalue';
        expect(store.opt).toEqual('optvalue');
        expect(memStorage.getItem('testStore')).toEqual({ key: null });
        branchClock.tick(500);
        expect(memStorage.getItem('testStore')).toEqual({ key: null, opt: 'optvalue' });

        delete store.opt;
        expect(store.opt).toEqual(undefined);
        branchClock.tick(500);
        expect(memStorage.getItem('testStore')).toEqual({ key: null });
      });

      it('add nested new key', async () => {
        const store = createPersistStore<{ key: Record<string, any> }>({ name: 'testStore', template: { key: null } }, { storage: memStorage, persistDebounce: 500 });
        expect(store.key).toEqual(null);

        store.key = {};
        expect(store.key).toEqual({});
        branchClock.tick(500);
        expect(memStorage.getItem('testStore')).toEqual({ key: {} });

        store.key.a = 'value2';
        expect(store.key.a).toEqual('value2');

        branchClock.tick(500);
        expect(memStorage.getItem('testStore')).toEqual({ key: { a: 'value2' } });
      });
    });

    it('should delete property and persist data to storage on property nested-delete', async () => {
      const store = createPersistStore<{ key?: { a?: string } | null }>({ name: 'testStore', template: { key: { a: 'value' } } }, { storage: memStorage, persistDebounce: 500 });

      expect(store.key!.a).toEqual('value');

      delete store.key!.a;
      expect(store.key!.a).toEqual(undefined);
      branchClock.tick(500);
      expect(memStorage.getItem('testStore')).toEqual({ key: { a: undefined } });

      store.key = null;
      expect(store.key).toEqual(null);
      branchClock.tick(500);
      expect(memStorage.getItem('testStore')).toEqual({ key: null });

      delete store.key;
      expect(store.key).toEqual(undefined);
      branchClock.tick(500);
      expect(memStorage.getItem('testStore')).toEqual({ key: undefined });
    });
  });

  ;[
    undefined/* 1000 */,
    2000,
    3000,
  ].forEach((debounceValue = 1000) => {
    it(`[sinon | debounce: ${debounceValue}] should debounce ms the storage.setItem method when setting properties`, async () => {
      const clock = sinon.useFakeTimers();
      const store = createPersistStore({ name: 'testStore' }, { storage: storageMock, persistDebounce: debounceValue });
      store.key = 'value';
      clock.tick(debounceValue / 2);
      store.key = 'value2';
      sinon.assert.calledOnce(setItemStub);
      clock.tick(debounceValue + 100);
      store.key = 'value3';
      sinon.assert.calledTwice(setItemStub);
    });

    it(`[memStore | debounce: ${debounceValue}] should debounce ms the storage.setItem method when setting properties`, async () => {
      const clock = sinon.useFakeTimers();
      const sinonMem = sinon.stub(memStorage);
      const store = createPersistStore({ name: 'testStore' }, { storage: sinonMem, persistDebounce: debounceValue });
      store.key = 'value';
      clock.tick(debounceValue / 2);
      store.key = 'value2';
      sinon.assert.calledOnce(sinonMem.setItem);
      clock.tick(debounceValue + 100);
      store.key = 'value3';
      sinon.assert.calledTwice(sinonMem.setItem);
    });
  });

  it('should return all items from storage adapter when getAll is called', async () => {
    const storedData = { key1: 'value1', key2: 'value2' };
    memStorage.setItem('testStore', storedData);

    const store = createPersistStore<typeof storedData>({ name: 'testStore' }, { storage: memStorage });
    expect(store).toEqual(storedData);
  });

  it('should call removeItem method on persistent store item removal', async () => {
    const storedData = { key1: 'value1', key2: 'value2' };
    memStorage.setItem('testStore', storedData);

    const store = createPersistStore<Partial<typeof storedData>>({ name: 'testStore' }, { storage: memStorage });
    delete store.key1;
    expect(store).toEqual({ key2: 'value2' });
  });

  describe('branches', () => {
    it('no store cache', async () => {
      memStorage.clearAll();
      memStorage.setItem('testStore2', { key: 'value2' });

      const store = createPersistStore({ name: 'testStore', template: { key: 'value' }, fromStorage: true }, { storage: memStorage });

      expect(store).toEqual({ key: 'value' });
    });

    it('with store cache but not use', async () => {
      memStorage.clearAll();
      memStorage.setItem('testStore2', { key: 'value2' });

      const store = createPersistStore({ name: 'testStore', template: { key: 'value' }, fromStorage: false }, { storage: memStorage });

      expect(store).toEqual({ key: 'value' });
    });
  });
});
