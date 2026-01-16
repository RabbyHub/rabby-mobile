/* eslint-disable jsdoc/check-tag-names */
/* eslint-disable jsdoc/check-types */
/* eslint-disable jsdoc/no-types */
/* eslint-disable jsdoc/check-param-names */
/* eslint-disable jsdoc/require-param-description */
/* eslint-disable jsdoc/require-returns */
/* eslint-disable jsdoc/require-description */
import { ObservableStore } from '@metamask/obs-store';
import { addressUtils } from '@rabby-wallet/base-utils';
import { DisplayKeyring, KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import type {
  AccountItemWithBrandQueryResult,
  DisplayedKeyring,
  KeyringAccount,
  KeyringIntf,
  KeyringSerializedData,
  KeyringTypeName,
} from '@rabby-wallet/keyring-utils';
import type { ContactBookService } from '@rabby-wallet/service-address';
import * as ethUtil from 'ethereumjs-util';
import log from 'loglevel';
import * as bip39 from '@scure/bip39';
import * as import_english from '@scure/bip39/wordlists/english';

import type { KeyringClassType, KeyringInstance } from './types';
import { keyringSdks } from './types';
import { normalizeAddress } from './utils/address';
import type { EncryptorAdapter } from './utils/encryptor';
import { nodeEncryptor } from './utils/encryptor';
import { mergeVault } from './utils/mergeVault';
import { passwordDecrypt, passwordEncrypt } from './utils/password';
import { RNEventEmitter } from './utils/react-native-event';

const UNENCRYPTED_IGNORE_KEYRING = [
  KEYRING_TYPE.SimpleKeyring,
  KEYRING_TYPE.HdKeyring,
];

type KeyringState = {
  booted?: string;
  vault?: string;
  unencryptedKeyringData?: KeyringSerializedData[];
  hasEncryptedKeyringData: boolean;
};

type MemStoreState = {
  isUnlocked: boolean;
  keyringTypes: any[];
  keyrings: any[];
  preMnemonics: string;
};

type OnSetAddressAlias = (
  keyring: KeyringInstance | KeyringIntf | undefined,
  account: AccountItemWithBrandQueryResult,
  contactService?: ContactBookService,
) => Promise<void>;

type OnCreateKeyring = (
  Keyring: typeof KeyringIntf,
) => KeyringInstance | KeyringIntf;

export type KeyringServiceOptions = {
  encryptor?: EncryptorAdapter;
  keyringClasses?: (typeof KeyringIntf)[];
  onSetAddressAlias?: OnSetAddressAlias;
  onCreateKeyring?: OnCreateKeyring;
};

export type PersistType = 'perps' | 'keyring';

export type KeyringEventAccount = {
  address: string;
  type: KeyringTypeName;
  brandName: string;
}

export class KeyringService extends RNEventEmitter {
  //
  // PUBLIC METHODS
  //
  keyrings: KeyringInstance[];

  keyringClasses: (typeof KeyringIntf)[] = [];

  get keyringTypes() {
    return this.keyringClasses;
  }

  set keyringTypes(value) {
    this.keyringClasses = value;
  }

  store!: ObservableStore<KeyringState>;

  memStore: ObservableStore<MemStoreState>;

  #password: string | null = null;

  private readonly encryptor: EncryptorAdapter;

  private readonly contactService?: ContactBookService;

  private readonly onSetAddressAlias?: OnSetAddressAlias;

  private readonly onCreateKeyring?: OnCreateKeyring;

  constructor(
    options?: KeyringServiceOptions & {
      contactService?: ContactBookService;
    },
  ) {
    super();

    const {
      encryptor: inputEncryptor = nodeEncryptor,
      keyringClasses = keyringSdks,
      onSetAddressAlias,
      onCreateKeyring,
      contactService,
    } = options || {};

    this.contactService = contactService;

    this.encryptor = inputEncryptor;
    this.keyringClasses = Object.values(keyringClasses);
    this.memStore = new ObservableStore({
      isUnlocked: false,
      keyringTypes: this.keyringClasses.map(krt => krt.type),
      keyrings: [],
      preMnemonics: '',
    });
    this.onSetAddressAlias = onSetAddressAlias;
    this.onCreateKeyring = onCreateKeyring;

    this.keyrings = [];
  }

  loadStore(initState: Partial<KeyringState>) {
    this.store = new ObservableStore({
      booted: initState.booted || undefined,
      vault: initState.vault || undefined,
      unencryptedKeyringData: initState.unencryptedKeyringData || undefined,
      hasEncryptedKeyringData: initState.hasEncryptedKeyringData || false,
    });
  }

  private async _setupBoot(password: string) {
    this.#password = password;
    const encryptBooted = await this.encryptor.encrypt(password, 'true');
    this.store.updateState({ booted: encryptBooted });
  }

  async boot(password: string) {
    await this._setupBoot(password);
    this.memStore.updateState({ isUnlocked: true });
  }

  // TODO: add strict check for newPassword in logic layer too.
  async updatePassword(oldPassword: string, newPassword: string) {
    await this.verifyPassword(oldPassword);

    this.emit('beforeUpdatePassword', {
      keyringState: this.store.getState(),
    });

    // reboot it
    await this._setupBoot(newPassword);
    await this.persistAllKeyrings();
  }

  // #filterAllKeyringsNeedPassword() {
  //   return this.keyrings.filter(
  //     keyring =>
  //       ![
  //         KEYRING_TYPE.WatchAddressKeyring,
  //         KEYRING_TYPE.WalletConnectKeyring,
  //         // some hardware keyrings which will create keyrings right away on bootstrap
  //         KEYRING_TYPE.OneKeyKeyring,
  //         KEYRING_TYPE.LedgerKeyring,
  //       ].includes(keyring.type as any),
  //   );
  // }

  async getCountOfAccountsInKeyring() {
    const accounts = await this.getAllTypedVisibleAccounts();
    return accounts.length;
  }

  /**
   * @description on no keyrings stored, force reset password
   * @param newPassword
   */
  async resetPassword(newPassword: string) {
    if (await this.getCountOfAccountsInKeyring()) {
      throw new Error(
        "You're trying to overwrite password on existing keyrings.",
      );
    }

    await this._setupBoot(newPassword);

    this.keyrings = [];
    try {
      await this.persistAllKeyrings();
    } catch (error) {
      console.error(error);
    }
    this.memStore.updateState({ keyrings: [] });

    // TODO: forgot password
    // update vault and boted with new password
    // const { unencryptedKeyringData } = this.store.getState();
    // const booted = await this.encryptor.encrypt(newPassword, 'true');
    // const vault = await this.encryptor.encrypt(
    //   newPassword,
    //   unencryptedKeyringData || [],
    // );

    // this.store.updateState({ vault, booted, hasEncryptedKeyringData: false });

    // this.emit('resetPassword');
    // // lock wallet
    // await this.setLocked();
  }

  async dangerouslyResetPasswordAndKeyrings(
    oldPassword: string,
    newPassword?: string,
  ) {
    if (newPassword) {
      this.keyrings = [];
      await this.updatePassword(oldPassword, newPassword);
      await this.persistAllKeyrings();
    } else {
      await this.verifyPassword(oldPassword);

      this.keyrings = [];
      await this.persistAllKeyrings();
      this.memStore.updateState({ keyrings: [] });
      this.store.updateState({ vault: undefined, booted: undefined });
    }
  }

  isBooted() {
    return Boolean(this.store.getState().booted);
  }

  isUnlocked() {
    return this.memStore.getState().isUnlocked;
  }

  hasVault() {
    return Boolean(this.store.getState().vault);
  }

  fullUpdate(): MemStoreState {
    this.emit('update', this.memStore.getState());
    return this.memStore.getState();
  }

  /**
   * Import Keychain using Private key
   *
   * @fires KeyringController#unlock
   * @param privateKey - The privateKey to generate address
   * @returns A Promise that resolves to the state.
   */
  importPrivateKey(privateKey: string): Promise<any> {
    let keyring: any;

    return this.persistAllKeyrings()
      .then(
        this.addNewKeyring.bind(this, KEYRING_TYPE.SimpleKeyring, [privateKey]),
      )
      .then(async _keyring => {
        keyring = _keyring;
        const [address] = await keyring.getAccounts();
        const curAccount = {
          address,
          type: keyring.type as KeyringTypeName,
          brandName: keyring.type,
        };
        return this.onSetAddressAlias?.(
          keyring,
          curAccount,
          this.contactService,
        );
      })
      .then(this.persistAllKeyrings.bind(this))
      .then(() => this._setUnlocked({ scene: 'finish:importPrivateKey' }))
      .then(this.fullUpdate.bind(this))
      .then(() => keyring);
  }

  /**
   * @param keyringInst
   * @param type
   * @description create keyring instance is type of KeyringTypes
   */
  isKeyringTypeOf(keyringInst: KeyringClassType, type: KeyringTypeName) {
    return type === keyringInst.type;
  }

  /**
   * @param type
   * @description get initialized keyrings in service
   */
  getKeyringByType<T extends KeyringClassType>(type: KeyringTypeName) {
    // eslint-disable-next-line @typescript-eslint/no-shadow
    const keyring = this.keyrings.find(keyring => keyring.type === type);

    return keyring as T | undefined;
  }

  /**
   * Add New Keyring
   *
   * Adds a new Keyring of the given `type` to the vault
   * and the current decrypted Keyrings array.
   *
   * All Keyring classes implement a unique `type` string,
   * and this is used to retrieve them from the keyringTypes array.
   *
   * @param type
   * @param opts
   * @deprecated use addKeyring as possible, it's only meanful for `Private Key & HD Keyring`
   */
  addNewKeyring(type: KeyringTypeName, opts?: any): Promise<any> {
    const Keyring = this.getKeyringClassForType(type);
    const keyring = new Keyring(opts);
    // this._updateIndexIfHdKeyring(keyring);
    return this.addKeyring(keyring);
  }

  // private _updateIndexIfHdKeyring(keyring: KeyringInstance) {
  //   if (keyring.type !== KEYRING_TYPE.HdKeyring) {
  //     return;
  //   }
  //   if (this.keyrings.find((item) => item === keyring)) {
  //     return;
  //   }
  //   const keryings = this.keyrings.filter(
  //     (item) => item.type === KEYRING_TYPE.HdKeyring
  //   );
  //   keyring.index =
  //     Math.max(...keryings.map((item) => item.index), keryings.length - 1) + 1;
  // }

  /**
   * Set Locked
   * This method deallocates all secrets, and effectively locks MetaMask.
   *
   * @fires KeyringController#lock
   * @returns A Promise that resolves to the state.
   */
  async setLocked(): Promise<MemStoreState> {
    // set locked
    this.#password = null;
    this.memStore.updateState({ isUnlocked: false });
    // remove keyrings
    this.keyrings = [];
    await this._updateMemStoreKeyrings();
    this.emit('lock');
    return this.fullUpdate();
  }

  /**
   * Unlock Keyrings
   *
   * Unlocks the keyrings.
   *
   * @fires KeyringController#unlock
   */
  private _setUnlocked(options: { scene: 'unlock' | 'finish:importPrivateKey' | 'finish:createKeyringWithMnemonics' }): void {
    this.memStore.updateState({ isUnlocked: true });
    this.emit('unlock', { scene: options.scene });
  }

  _isSubmittingPassword = false;

  /**
   * Submit Password
   *
   * Attempts to decrypt the current vault and load its keyrings
   * into memory.
   *
   * Temporarily also migrates any old-style vaults first, as well.
   * (Pre MetaMask 3.0.0)
   *
   * @fires KeyringController#unlock
   * @param password - The keyring controller password.
   * @returns A Promise that resolves to the state.
   */
  async submitPassword(password: string): Promise<MemStoreState> {
    if (this._isSubmittingPassword) {
      return this.memStore.getState();
    }

    this._isSubmittingPassword = true;
    await this.verifyPassword(password);
    this.#password = password;
    try {
      this.keyrings = await this.unlockKeyrings(password);
    } catch {
      //
    } finally {
      this._setUnlocked({ scene: 'unlock' });
      this._isSubmittingPassword = false;
    }

    // force store unencrypted keyring data if not exist
    if (!this.store.getState().unencryptedKeyringData) {
      await this.persistAllKeyrings();
    }

    return this.fullUpdate();
  }

  /**
   * Verify Password
   *
   * Attempts to decrypt the current vault with a given password
   * to verify its validity.
   *
   * @param password
   */
  async verifyPassword(password: string): Promise<void> {
    const encryptedBooted = this.store.getState().booted;
    if (!encryptedBooted) {
      // throw new Error(i18n.t('background.error.canNotUnlock'));
      throw new Error('Cannot unlock without a previous vault');
    }
    await this.encryptor.decrypt(password, encryptedBooted);
  }

  /**
   * Remove Empty Keyrings
   *
   * Loops through the keyrings and removes the ones with empty accounts
   * (usually after removing the last / only account) from a keyring
   */
  async removeEmptyKeyrings() {
    const validKeyrings: KeyringInstance[] = [];

    // Since getAccounts returns a Promise
    // We need to wait to hear back form each keyring
    // in order to decide which ones are now valid (accounts.length > 0)

    await Promise.all(
      this.keyrings.map(async keyring => {
        const accounts = await keyring.getAccounts();
        if (accounts.length > 0) {
          validKeyrings.push(keyring);
        }
      }),
    );
    this.keyrings = validKeyrings;
  }

  /**
   * Checks for duplicate keypairs, using the the first account in the given
   * array. Rejects if a duplicate is found.
   *
   * Only supports 'Simple Key Pair'.
   * @param type
   * @param newAccountArray
   */
  async checkForDuplicate(
    type: string,
    newAccountArray: string[],
  ): Promise<string[]> {
    const keyrings = this.getKeyringsByType(type);
    const _accounts = await Promise.all(
      keyrings.map(keyring => keyring.getAccounts()),
    );

    const accounts: string[] = _accounts
      .reduce((m, n) => m.concat(n), [] as string[])
      .map(address => normalizeAddress(address).toLowerCase());

    const isIncluded = newAccountArray.find(account => {
      return accounts.find(
        key =>
          key === account.toLowerCase() ||
          key === ethUtil.stripHexPrefix(account),
      );
    });

    const error = new Error(isIncluded);
    error.name = 'DuplicateAccountError';
    return isIncluded
      ? // ? Promise.reject(new Error(i18n.t('background.error.duplicateAccount')))
        Promise.reject(error)
      : Promise.resolve(newAccountArray);
  }

  // eslint-disable-next-line jsdoc/require-returns
  /**
   * Add New Account
   *
   * Calls the `addAccounts` method on the given keyring,
   * and then saves those changes.
   * @param selectedKeyring
   * @param options.onAddedAddress
   */
  addNewAccount(
    selectedKeyring: KeyringInstance | KeyringIntf,
  ): Promise<string[] | AccountItemWithBrandQueryResult[]> {
    let _accounts: string[] | AccountItemWithBrandQueryResult[] = [];

    return selectedKeyring
      .addAccounts(1)
      .then((): Promise<AccountItemWithBrandQueryResult[] | string[]> => {
        const func = (selectedKeyring as KeyringIntf).getAccountsWithBrand;
        if (func) return func.call(selectedKeyring);
        return selectedKeyring.getAccounts();
      })
      .then(accounts => {
        const allAccounts = accounts.map(account => ({
          address: normalizeAddress(
            typeof account === 'string' ? account : account.address,
          ),
          brandName:
            typeof account === 'string'
              ? selectedKeyring.type
              : account?.realBrandName || account.brandName,
          type: (typeof account === 'string'
            ? selectedKeyring.type
            : account?.type || account.type) as KeyringTypeName,
        }));
        _accounts = accounts;

        return Promise.all(
          allAccounts.map(async account => {
            this.emit('newAccount', account as KeyringEventAccount);
            return this.onSetAddressAlias?.(
              selectedKeyring,
              account,
              this.contactService,
            );
          }),
        );
      })
      .then(this.persistAllKeyrings.bind(this))
      .then(this._updateMemStoreKeyrings.bind(this))
      .then(this.fullUpdate.bind(this))
      .then(() => _accounts);
  }

  /**
   * Export Account
   *
   * Requests the private key from the keyring controlling
   * the specified address.
   *
   * Returns a Promise that may resolve with the private key string.
   * @param address
   */
  async exportAccount(address: string): Promise<string> {
    try {
      return this.getKeyringForAccount(address).then(keyring => {
        return keyring.exportAccount(normalizeAddress(address));
      });
    } catch (e) {
      return Promise.reject(e);
    }
  }

  //
  // SIGNING METHODS
  //

  /**
   * Sign Ethereum Transaction
   *
   * Signs an Ethereum transaction object.
   *
   * @param keyring
   * @param ethTx - The transaction to sign.
   * @param _fromAddress - The transaction 'from' address.
   * @param opts - Signing options.
   * @returns The signed transaction object.
   */
  signTransaction(keyring: any, ethTx: any, _fromAddress: string, opts = {}) {
    const fromAddress = normalizeAddress(_fromAddress);
    return keyring.signTransaction(fromAddress, ethTx, opts);
  }

  signEip7702Authorization(
    keyring: any,
    authParams: {
      from: string;
      authorization: [chainId: number, contractAddress: string, nonce: number];
    },
    opts = {},
  ) {
    const address = normalizeAddress(authParams.from);
    if (!keyring.signEip7702Authorization) {
      return Promise.reject(
        new Error(
          `Keyring ${keyring.type} doesn't support signEip7702Authorization operation`,
        ),
      );
    }
    return keyring.signEip7702Authorization(
      address,
      authParams.authorization,
      opts,
    );
  }

  /**
   * Sign Message
   *
   * Attempts to sign the provided message parameters.
   *
   * @param msgParams - The message parameters to sign.
   * @param msgParams.from
   * @param opts
   * @param msgParams.data
   * @returns The raw signature.
   */
  signMessage(msgParams: { from: string; data: any }, opts = {}) {
    const address = normalizeAddress(msgParams.from);
    return this.getKeyringForAccount(address).then(keyring => {
      return keyring.signMessage(address, msgParams.data, opts);
    });
  }

  /**
   * Sign Personal Message
   *
   * Attempts to sign the provided message paramaters.
   * Prefixes the hash before signing per the personal sign expectation.
   *
   * @param keyring
   * @param msgParams - The message parameters to sign.
   * @param opts
   * @param msgParams.from
   * @param msgParams.data
   * @returns The raw signature.
   */
  signPersonalMessage(
    keyring: any,
    msgParams: { from: string; data: any },
    opts = {},
  ) {
    const address = normalizeAddress(msgParams.from);
    return keyring.signPersonalMessage(address, msgParams.data, opts);
  }

  /**
   * Sign Typed Data
   * (EIP712 https://github.com/ethereum/EIPs/pull/712#issuecomment-329988454)
   *
   * @param keyring
   * @param msgParams - The message parameters to sign.
   * @param opts
   * @param msgParams.from
   * @param msgParams.data
   * @returns The raw signature.
   */
  signTypedMessage(
    keyring: any,
    msgParams: { from: string | number; data: any },
    opts = { version: 'V1' },
  ) {
    const address = normalizeAddress(msgParams.from);
    return keyring.signTypedData(address, msgParams.data, opts);
  }

  /**
   *
   * Remove Account
   *
   * Removes a specific account from a keyring
   * If the account is the last/only one then it also removes the keyring.
   *
   * @param address - The address of the account to remove.
   * @param type
   * @param brand
   * @param removeEmptyKeyrings
   * @returns A Promise that resolves if the operation was successful.
   */
  removeAccount(
    address: string,
    type: KeyringTypeName,
    brand?: string,
    removeEmptyKeyrings = true,
  ): Promise<any> {
    return this.getKeyringForAccount(address, type)
      .then(async keyring => {
        // Not all the keyrings support this, so we have to check
        if (typeof keyring.removeAccount === 'function') {
          keyring.removeAccount(address, brand);
          const accountLike: KeyringEventAccount = { address, type, brandName: brand || '' };
          this.emit('removedAccount', accountLike);
          const currentKeyring = keyring;
          return [await keyring.getAccounts(), currentKeyring];
        }
        return Promise.reject(
          new Error(
            `Keyring ${keyring.type} doesn't support account removal operations`,
          ),
        );
      })
      .then(([accounts, currentKeyring]) => {
        // Check if this was the last/only account
        if (accounts.length === 0 && removeEmptyKeyrings) {
          currentKeyring.forgetDevice?.();
          this.keyrings = this.keyrings.filter(item => item !== currentKeyring);

          // return this.removeEmptyKeyrings();
        }
        return undefined;
      })
      .then(this.persistAllKeyrings.bind(this))
      .then(this._updateMemStoreKeyrings.bind(this))
      .then(this.fullUpdate.bind(this))
      .catch(e => {
        return Promise.reject(e);
      });
  }

  removeKeyringByPublicKey(publicKey: string) {
    this.keyrings = (this.keyrings as KeyringIntf[]).filter(item => {
      if (item.publicKey) {
        return item.publicKey !== publicKey;
      }
      return true;
    });
    return this.persistAllKeyrings()
      .then(this._updateMemStoreKeyrings.bind(this))
      .then(this.fullUpdate.bind(this))
      .catch(e => {
        return Promise.reject(e);
      });
  }

  async addKeyring<T extends KeyringInstance>(
    keyring: KeyringInstance,
  ): Promise<string[] | T | boolean> {
    return keyring
      .getAccounts()
      .then(accounts => {
        return this.checkForDuplicate(keyring.type, accounts);
      })
      .then(() => {
        this.keyrings.push(keyring);
        return this.persistAllKeyrings();
      })
      .then(() => this._updateMemStoreKeyrings())
      .then(() => this.fullUpdate())
      .then(() => {
        return keyring as T;
      });
  }

  /**
   * Persist All Keyrings
   *
   * Iterates the current `keyrings` array,
   * serializes each one into a serialized array,
   * encrypts that array with the provided `password`,
   * and persists that encrypted string to storage.
   */
  async persistAllKeyrings(): Promise<boolean> {
    if (!this.#password || typeof this.#password !== 'string') {
      return Promise.reject(
        new Error('KeyringService - password is not a string'),
      );
    }

    const serializedKeyrings = await Promise.all(
      this.keyrings.map(async keyring => {
        return Promise.all([keyring.type, keyring.serialize()]).then(
          serializedKeyringArray => {
            // Label the output values on each serialized Keyring:
            return {
              type: serializedKeyringArray[0],
              data: serializedKeyringArray[1],
            } as KeyringSerializedData;
          },
        );
      }),
    );

    let hasEncryptedKeyringData = false;
    const unencryptedKeyringData = serializedKeyrings
      .map(({ type, data }) => {
        if (!UNENCRYPTED_IGNORE_KEYRING.includes(type as any)) {
          return { type, data };
        }

        // maybe empty keyring
        // TODO: maybe need remove simple keyring if empty
        if (type === KEYRING_TYPE.SimpleKeyring && !data.length) {
          return undefined;
        }

        hasEncryptedKeyringData = true;
        return undefined;
      })
      .filter(Boolean) as KeyringSerializedData[];

    const encryptedString = await this.encryptor.encrypt(
      this.#password as string,
      serializedKeyrings as unknown as Buffer,
    );

    this.store.updateState({
      vault: encryptedString,
      unencryptedKeyringData,
      hasEncryptedKeyringData,
    });

    return true;
  }

  /**
   * Unlock Keyrings
   *
   * Attempts to unlock the persisted encrypted storage,
   * initializing the persisted keyrings to RAM.
   * @param password
   */
  async unlockKeyrings(password: string): Promise<any[]> {
    const encryptedVault = this.store.getState().vault;
    if (!encryptedVault) {
      // throw new Error(i18n.t('background.error.canNotUnlock'));
      throw new Error('Cannot unlock without a previous vault');
    }

    await this.clearKeyrings();
    const vault = await this.encryptor.decrypt(password, encryptedVault);
    // TODO: FIXME
    await Promise.all(
      Array.from(vault as any).map(this._restoreKeyring.bind(this) as any),
    );
    await this._updateMemStoreKeyrings();
    return this.keyrings;
  }

  /**
   * Restore Keyring
   *
   * Attempts to initialize a new keyring from the provided serialized payload.
   * On success, updates the memStore keyrings and returns the resulting
   * keyring instance.
   *
   * @param serialized
   */
  async restoreKeyring(serialized: KeyringSerializedData) {
    const keyring = await this._restoreKeyring(serialized);
    await this._updateMemStoreKeyrings();
    return keyring;
  }

  /**
   * Restore Keyring Helper
   *
   * Attempts to initialize a new keyring from the provided serialized payload.
   * On success, returns the resulting keyring instance.
   *
   * @param serialized
   */
  private async _restoreKeyring(
    serialized: KeyringSerializedData,
  ): Promise<any> {
    const { type, data } = serialized;
    const Keyring = this.getKeyringClassForType(type);
    const keyring =
      typeof this.onCreateKeyring === 'function'
        ? this.onCreateKeyring(Keyring)
        : new Keyring({});
    await keyring.deserialize(data);

    // getAccounts also validates the accounts for some keyrings
    await keyring.getAccounts();
    this.keyrings.push(keyring);
    return keyring;
  }

  /**
   * Get Keyring Class For Type
   *
   * Searches the current `keyringTypes` array
   * for a Keyring class whose unique `type` property
   * matches the provided `type`,
   * returning it if it exists.
   * @param type
   */
  getKeyringClassForType(type: KeyringTypeName): typeof KeyringIntf {
    return this.keyringTypes.find(kr => kr.type === type)!;
  }

  /**
   * Get Keyrings by Type
   *
   * Gets all keyrings of the given type.
   * @param type
   */
  getKeyringsByType(type: string) {
    return this.keyrings.filter(keyring => keyring.type === type);
  }

  /**
   * Clear Keyrings
   *
   * Deallocates all currently managed keyrings and accounts.
   * Used before initializing a new vault.
   */
  /* eslint-disable require-await */
  async clearKeyrings(): Promise<void> {
    // clear keyrings from memory
    this.keyrings = [];
    this.memStore.updateState({
      keyrings: [],
    });
  }

  /**
   * Get Accounts
   *
   * Returns the public addresses of all current accounts
   * managed by all currently unlocked keyrings.
   *
   * @returns The array of accounts.
   */
  async getAccounts(): Promise<string[]> {
    const keyrings = this.keyrings || [];
    const addrs = await Promise.all(keyrings.map(kr => kr.getAccounts())).then(
      keyringArrays => {
        return keyringArrays.reduce((res, arr) => {
          return res.concat(arr);
        }, []);
      },
    );
    return addrs.map(normalizeAddress);
  }

  /**
   * Get Keyring For Account
   *
   * Returns the currently initialized keyring that manages
   * the specified `address` if one exists.
   * @param address
   * @param type
   * @param includeWatchKeyring
   */
  async getKeyringForAccount(
    address: string,
    type?: string | KeyringTypeName,
    includeWatchKeyring = true,
  ): Promise<any> {
    const hexed = normalizeAddress(address).toLowerCase();
    log.debug(`KeyringService - getKeyringForAccount: ${hexed}`);
    let keyrings = type
      ? this.keyrings.filter(keyring => keyring.type === type)
      : this.keyrings;
    if (!includeWatchKeyring) {
      keyrings = keyrings.filter(
        keyring => keyring.type !== KEYRING_TYPE.WatchAddressKeyring,
      );
    }
    return Promise.all(
      keyrings.map(keyring => {
        return Promise.all([keyring, keyring.getAccounts()]);
      }),
    ).then(candidates => {
      const winners = candidates.filter(candidate => {
        const accounts = candidate[1].map(addr => {
          return normalizeAddress(addr).toLowerCase();
        });
        return accounts.includes(hexed);
      });
      if (winners && winners.length > 0) {
        return winners[0][0];
      }
      throw new Error('No keyring found for the requested account.');
    });
  }

  /**
   * Display For Keyring
   *
   * Is used for adding the current keyrings to the state object.
   * @param keyring
   * @param includeHidden
   */
  async displayForKeyring(
    keyring: KeyringInstance,
    includeHidden = true,
  ): Promise<DisplayedKeyring> {
    // const hiddenAddresses = preference.getHiddenAddresses();
    const hiddenAddresses = [] as KeyringAccount[];

    const accounts: Promise<
      ({ address: string; brandName: string } | string)[]
    > = (keyring as KeyringIntf).getAccountsWithBrand
      ? // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        (keyring as KeyringIntf).getAccountsWithBrand!()
      : keyring.getAccounts();

    // eslint-disable-next-line @typescript-eslint/no-shadow
    return accounts.then(accounts => {
      const allAccounts = accounts.map(account => ({
        address: normalizeAddress(
          typeof account === 'string' ? account : account.address,
        ),
        brandName:
          typeof account === 'string' ? keyring.type : account.brandName,
      }));

      return {
        type: keyring.type,
        accounts: includeHidden
          ? allAccounts
          : allAccounts.filter(
              account =>
                !hiddenAddresses.find(
                  item =>
                    item.type === keyring.type &&
                    item.address.toLowerCase() ===
                      account.address.toLowerCase(),
                ),
            ),
        keyring: new DisplayKeyring(keyring),
        byImport: (keyring as KeyringIntf).byImport,
        publicKey: (keyring as KeyringIntf).publicKey,
      } as DisplayedKeyring;
    });
  }

  getAllTypedAccounts(): Promise<DisplayedKeyring[]> {
    return Promise.all(
      this.keyrings.map(keyring => this.displayForKeyring(keyring)),
    );
  }

  async getAllTypedVisibleAccounts(): Promise<DisplayedKeyring[]> {
    const keyrings = await Promise.all(
      this.keyrings.map(keyring => this.displayForKeyring(keyring, false)),
    );
    return keyrings.filter(keyring => keyring.accounts.length > 0);
  }

  async getAllVisibleAccountsArray() {
    const typedAccounts = await this.getAllTypedVisibleAccounts();
    const result: KeyringAccount[] = [];
    typedAccounts.forEach(accountGroup => {
      result.push(
        ...accountGroup.accounts.map(account => ({
          address: account.address,
          brandName: account.brandName,
          type: accountGroup.type,
          byImport: accountGroup.byImport,
        })),
      );
    });

    return result;
  }

  async getAllAddresses() {
    const keyrings = await this.getAllTypedAccounts();
    const result: { address: string; type: string; brandName: string }[] = [];
    keyrings.forEach(accountGroup => {
      result.push(
        ...accountGroup.accounts.map(account => ({
          address: account.address,
          brandName: account.brandName,
          type: accountGroup.type,
          byImport: accountGroup.byImport,
        })),
      );
    });

    return result;
  }

  async hasAddress(address: string) {
    const addresses = await this.getAllAddresses();
    return Boolean(
      addresses.find(item => addressUtils.isSameAddress(item.address, address)),
    );
  }

  /**
   * Update Memstore Keyrings
   *
   * Updates the in-memory keyrings, without persisting.
   */
  private async _updateMemStoreKeyrings(): Promise<void> {
    const keyrings = await Promise.all(
      this.keyrings.map(keyring => this.displayForKeyring(keyring)),
    );
    return this.memStore.updateState({ keyrings });
  }

  /**
   * Mnemonic Phrase
   */
  generateMnemonic(): string {
    return bip39.generateMnemonic(import_english.wordlist);
  }

  async generatePreMnemonic(): Promise<string> {
    if (!this.#password) {
      throw new Error('background.error.unlock');
    }
    const mnemonic = this.generateMnemonic();
    const preMnemonics = await this.encryptor.encrypt(this.#password, mnemonic);
    this.memStore.updateState({ preMnemonics });

    return mnemonic;
  }

  removePreMnemonics() {
    this.memStore.updateState({ preMnemonics: '' });
  }

  async getPreMnemonics(): Promise<any> {
    if (!this.memStore.getState().preMnemonics) {
      return '';
    }

    if (!this.#password) {
      throw new Error('background.error.unlock');
    }

    return await this.encryptor.decrypt(
      this.#password,
      this.memStore.getState().preMnemonics,
    );
  }

  /**
   * CreateNewVaultAndRestore Mnenoic
   *
   * Destroys any old encrypted storage,
   * creates a new HD wallet from the given seed with 1 account.
   *
   * @emits KeyringController#unlock
   * @param {string} seed - The BIP44-compliant seed phrase.
   * @returns {Promise<Object>} A Promise that resolves to the state.
   */
  createKeyringWithMnemonics(seed: string): Promise<any> {
    if (!bip39.validateMnemonic(seed, import_english.wordlist)) {
      return Promise.reject(new Error('background.error.invalidMnemonic'));
    }

    let keyring: any;
    return (
      this.persistAllKeyrings()
        .then(() => {
          return this.addNewKeyring(KEYRING_TYPE.HdKeyring, {
            mnemonic: seed,
            activeIndexes: [],
          });
        })
        .then(firstKeyring => {
          keyring = firstKeyring;
          return firstKeyring.getAccounts();
        })
        // .then(([firstAccount]) => {
        //   if (!firstAccount) {
        //     throw new Error('KeyringController - First Account not found.');
        //   }
        //   return null;
        // })
        .then(this.persistAllKeyrings.bind(this))
        .then(() => this._setUnlocked({ scene: 'finish:createKeyringWithMnemonics' }))
        .then(this.fullUpdate.bind(this))
        .then(() => keyring)
    );
  }

  updateHdKeyringIndex(keyring: KeyringInstance) {
    if (keyring.type !== KEYRING_TYPE.HdKeyring) {
      return;
    }
    if (this.keyrings.find(item => item === keyring)) {
      return;
    }
    const keryings = this.keyrings.filter(
      item => item.type === KEYRING_TYPE.HdKeyring,
    );
    keyring.index =
      Math.max(
        ...keryings.map(item => (item as any).index),
        keryings.length - 1,
      ) + 1;
  }

  DEV_GET_UNENCRYPTED_KEYRING_DATA() {
    const { unencryptedKeyringData, hasEncryptedKeyringData } =
      this.store.getState();
    return {
      unencryptedKeyringData,
      hasEncryptedKeyringData,
    };
  }

  /**
   * unencryptedKeyringData is saved in the store
   */
  savedUnencryptedKeyringData(): boolean {
    return 'unencryptedKeyringData' in this.store.getState();
  }

  /**
   * has seed phrase or private key in the store
   */
  hasEncryptedKeyringData(): boolean {
    return this.store.getState().hasEncryptedKeyringData;
  }

  /**
   * has unencrypted keyring data (not seed phrase or private key) in the store
   */
  hasUnencryptedKeyringData(): boolean {
    return (this.store.getState().unencryptedKeyringData?.length ?? 0) > 0;
  }

  async resetBooted() {
    this.store.updateState({ booted: undefined });
  }

  async getUnencryptedKeyringTypes() {
    return (this.store
      .getState()
      .unencryptedKeyringData?.map(item => item.type) ?? []) as string[];
  }

  /**
   * Restore Keyring Helper
   *
   * Attempts to initialize a new keyring from the provided serialized payload.
   * On success, returns the resulting keyring instance.
   *
   * @param serialized
   * @param push
   */
  private async _restoreKeyringByKeyringSerializedData(
    serialized: KeyringSerializedData,
  ): Promise<any> {
    const { type, data } = serialized;
    const Keyring = this.getKeyringClassForType(type);
    const keyring =
      typeof this.onCreateKeyring === 'function'
        ? this.onCreateKeyring(Keyring)
        : new Keyring({});
    await keyring.deserialize(data);

    // getAccounts also validates the accounts for some keyrings
    await keyring.getAccounts();

    return keyring;
  }

  async syncExtensionData(vault: KeyringSerializedData[]) {
    // restore mnemonic keyring
    const newVault = vault.map(item => {
      if (item.type === KEYRING_TYPE.HdKeyring) {
        return {
          ...item,
          data: {
            ...item.data,
            accounts: Object.keys(item.data.accountDetails),
          },
        };
      }
      return item;
    });

    let oldKeyringSerializedData: KeyringSerializedData[] = [];

    if (this.#password !== undefined) {
      const encryptedVault = this.store.getState().vault;
      if (!encryptedVault) {
        throw new Error('Cannot unlock without a previous vault');
      }

      oldKeyringSerializedData = (await this.encryptor.decrypt(
        this.#password!,
        encryptedVault,
      )) as KeyringSerializedData[];
    }

    const allAccounts = await this.getAllVisibleAccountsArray();

    const addedAccounts: DisplayedKeyring['accounts'] = [];

    const newKeyrings: KeyringInstance[] = await Promise.all(
      Array.from(newVault as any).map(
        this._restoreKeyringByKeyringSerializedData.bind(this) as any,
      ),
    );

    await Promise.all(
      newKeyrings.map(keyring =>
        this.displayForKeyring(keyring).then(newDisplayKeyring => {
          const newAccounts = newDisplayKeyring.accounts;

          newAccounts?.forEach(newAccount => {
            const newAccountExist = allAccounts?.some(
              existAddr =>
                newAccount?.address?.toLowerCase() ===
                  existAddr?.address?.toLowerCase() &&
                keyring.type === (existAddr.type || existAddr.brandName),
            );

            if (!newAccountExist && newAccounts.length) {
              addedAccounts.push({
                ...newAccount,
                type: keyring.type as KEYRING_TYPE,
              });
            }
          });
        }),
      ),
    );

    await this.clearKeyrings();

    const mergeKeyringSerializedData = mergeVault(
      oldKeyringSerializedData,
      newVault,
    );

    await Promise.all(
      Array.from(mergeKeyringSerializedData).map(
        this._restoreKeyring.bind(this) as any,
      ),
    );
    await this.persistAllKeyrings();

    await this._updateMemStoreKeyrings();

    return addedAccounts;
  }

  async encryptWithPassword(content: any) {
    if (!this.#password) {
      throw new Error('password can not be null');
    }
    const encrypted = await passwordEncrypt({
      data: content,
      password: this.#password,
    });
    return encrypted;
  }

  async decryptWithPassword(str: string) {
    if (!this.#password) {
      throw new Error('password can not be null');
    }
    const decrypted = await passwordDecrypt({
      encryptedData: str,
      password: this.#password,
    });
    return decrypted;
  }
}

/* eslint-enable jsdoc/check-tag-names */
/* eslint-enable jsdoc/check-types */
/* eslint-enable jsdoc/no-types */
/* eslint-enable jsdoc/check-param-names */
/* eslint-enable jsdoc/require-param-description */
/* eslint-enable jsdoc/require-returns */
/* eslint-enable jsdoc/require-description */
