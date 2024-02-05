import createPersistStore, {
  StorageAdapaterOptions,
} from '@rabby-wallet/persist-store';

export type RabbyPointsStore = {
  signatures: Record<string, string>;
};

export class RabbyPointsService {
  store: RabbyPointsStore = {
    signatures: {},
  };

  constructor(options?: StorageAdapaterOptions) {
    const storage = createPersistStore<RabbyPointsStore>(
      {
        name: 'RabbyPoints',
        template: {
          signatures: {},
        },
      },
      {
        storage: options?.storageAdapter,
      },
    );

    this.store = storage || this.store;
  }

  setSignature = (addr: string, signature: string) => {
    this.store.signatures = {
      ...this.store.signatures,
      [addr.toLowerCase()]: signature,
    };
  };

  getSignature = (addr: string) => {
    return this.store.signatures[addr.toLowerCase()];
  };
  clearSignatureByAddr = (addr: string) => {
    delete this.store.signatures[addr];
    this.store.signatures = {
      ...this.store.signatures,
    };
  };
  clearSignature = () => {
    this.store.signatures = {};
  };
}
