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

export type KeyringPasswordOrigin = 'built-in' | 'auto-generated' | 'user';

export type KeyringAuthTransition = 'disable-biometrics';

export type KeyringPasswordState = {
  version: 1;
  origin: KeyringPasswordOrigin;
  pendingAuthTransition?: KeyringAuthTransition;
};

export type KeyringPasswordUpdateOptions = {
  passwordState?: KeyringPasswordState;
};

type KeyringState = {
  booted?: string;
  vault?: string;
  unencryptedKeyringData?: KeyringSerializedData[];
  publicAccountSnapshot?: PublicAccountSnapshot;
  hasEncryptedKeyringData: boolean;
  passwordState?: KeyringPasswordState;
};

type MemStoreState = {
  isUnlocked: boolean;
  keyringRuntimeReady: boolean;
  keyringRuntimeRestoring: boolean;
  keyringRuntimeRestoreError: string | null;
  keyringTypes: any[];
  keyrings: any[];
  preMnemonics: string;
};

type OnSetAddressAlias = (
  keyring: KeyringInstance | KeyringIntf | undefined,
  account: AccountItemWithBrandQueryResult,
  contactService?: ContactBookService,
) => Promise<void>;

type OnSetAddressAliases = (
  keyring: KeyringInstance | KeyringIntf | undefined,
  accounts: AccountItemWithBrandQueryResult[],
  contactService?: ContactBookService,
) => Promise<void>;

type OnCreateKeyring = (
  Keyring: typeof KeyringIntf,
) => KeyringInstance | KeyringIntf;

type PublicAccountSnapshotItem = {
  address: string;
  type: KeyringTypeName;
  brandName: string;
  byImport?: boolean;
  publicKey?: string;
  hdPathBasePublicKey?: string;
  hdPathType?: string;
  hdPathIndex?: number;
  hasBackup?: boolean;
  needPassphrase?: boolean;
};

type PublicAccountSnapshot = {
  version: 4;
  updatedAt: number;
  accounts: PublicAccountSnapshotItem[];
};

/**
 * Public account snapshot version history:
 * - v3: locked-readable account identity and public keyring metadata.
 * - v4: adds locked-readable HD metadata and backup/import state:
 *   hdPathBasePublicKey, hdPathType, hdPathIndex, hasBackup, needPassphrase,
 *   and mnemonic basePublicKey normalization into hdPathBasePublicKey so locked
 *   address detail can render HD Path, imported mnemonic source, and backup
 *   reminders.
 */
const PUBLIC_ACCOUNT_SNAPSHOT_VERSION = 4;

function normalizeKeyringPasswordState(
  value: KeyringPasswordState | undefined,
): KeyringPasswordState | undefined {
  if (
    value?.version !== 1 ||
    !['built-in', 'auto-generated', 'user'].includes(value.origin) ||
    (value.pendingAuthTransition !== undefined &&
      value.pendingAuthTransition !== 'disable-biometrics')
  ) {
    return undefined;
  }

  return value;
}

const isSensitiveKeyringType = (type: string) =>
  UNENCRYPTED_IGNORE_KEYRING.includes(type as any);

export const WALLET_LOCKED_ERROR_PREFIX = 'background.error.unlock';

/**
 * Every lock guard used to throw the bare sentinel message, so Sentry grouped
 * all of them into one issue and the stack alone could not tell which guard
 * fired — `ensureKeyringRuntimeReady` is reachable from six different call
 * sites that share an identical frame sequence.
 *
 * The sentinel stays as a PREFIX so `isWalletUnlockRequired` and the existing
 * `toThrow('background.error.unlock')` assertions keep matching; the suffix
 * gives each site its own fingerprint. `unlockSource` carries the same value
 * as a property for consumers that would rather read it than parse the message.
 *
 * @param source - identifier of the guard that rejected, e.g. `assert_unlocked`
 */
function walletLockedError(source: string) {
  const error = new Error(
    `${WALLET_LOCKED_ERROR_PREFIX}:${source}`,
  ) as Error & { unlockSource: string };
  error.unlockSource = source;
  return error;
}

export type KeyringServiceOptions = {
  encryptor?: EncryptorAdapter;
  keyringClasses?: (typeof KeyringIntf)[];
  onSetAddressAlias?: OnSetAddressAlias;
  onSetAddressAliases?: OnSetAddressAliases;
  onCreateKeyring?: OnCreateKeyring;
  perfLogger?: KeyringPerfLogger;
};

export type KeyringPerfLogger = {
  instant?: (event: string, data?: Record<string, unknown>) => void;
};

export type PersistType = 'perps' | 'keyring';

export type KeyringEventAccount = {
  address: string;
  type: KeyringTypeName;
  brandName: string;
};

export type KeyringVaultStorageDebugState = {
  hasVault: boolean;
  vaultBytes: number;
  vaultHash: string | null;
  hasBooted: boolean;
  hasUnencryptedKeyringData: boolean;
  unencryptedKeyringCount: number;
  hasEncryptedKeyringData: boolean;
};

export type KeyringVaultTimingResult = {
  label: string;
  source: 'password' | 'cachedKey';
  success: boolean;
  durationMs: number;
  error?: string;
  keyringCount?: number;
};

export type SubmitPasswordOptions = {
  /**
   * The password came from a trusted OS-protected source, e.g. Android
   * biometric keychain. In this case vault decryption is enough validation.
   */
  trustedPassword?: boolean;
  /**
   * OS-protected exported encryptor key for the current vault.
   * When valid, this lets biometric unlock skip PBKDF2 derivation.
   */
  trustedVaultKeyString?: string;
  /**
   * Called after password-based vault decrypt so callers can persist the
   * exported key for the next biometric unlock.
   */
  onTrustedVaultKeyString?: (vaultKeyString: string) => void | Promise<void>;
  deferMemStoreKeyringsUpdate?: boolean;
  deferKeyringRuntimeRestore?: boolean;
};

type DeferredKeyringRuntimeRestore = {
  keyringsToRestore: KeyringSerializedData[];
  unencryptedKeyringData: KeyringSerializedData[];
  hasUnencryptedKeyringData: boolean;
  scheduledAt: number;
};

function getUtf8ByteLength(value: string) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.byteLength(value, 'utf8');
  }

  return unescape(encodeURIComponent(value)).length;
}

function hashString(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function getErrorText(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function nowMs() {
  return Date.now();
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
  private readonly onSetAddressAliases?: OnSetAddressAliases;
  private readonly onCreateKeyring?: OnCreateKeyring;
  private readonly perfLogger?: KeyringPerfLogger;
  private pendingKeyringRuntimeRestore: DeferredKeyringRuntimeRestore | null =
    null;
  private keyringRuntimeRestorePromise: Promise<any[]> | null = null;
  private keyringRuntimeRestoreId = 0;
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
      onSetAddressAliases,
      onCreateKeyring,
      perfLogger,
      contactService,
    } = options || {};

    this.contactService = contactService;

    this.encryptor = inputEncryptor;
    this.keyringClasses = Object.values(keyringClasses);
    this.memStore = new ObservableStore({
      isUnlocked: false,
      keyringRuntimeReady: false,
      keyringRuntimeRestoring: false,
      keyringRuntimeRestoreError: null,
      keyringTypes: this.keyringClasses.map(krt => krt.type),
      keyrings: [],
      preMnemonics: '',
    });
    this.onSetAddressAlias = onSetAddressAlias;
    this.onSetAddressAliases = onSetAddressAliases;
    this.onCreateKeyring = onCreateKeyring;
    this.perfLogger = perfLogger;

    this.keyrings = [];
  }

  private traceKeyringPerf(event: string, data: Record<string, unknown> = {}) {
    this.perfLogger?.instant?.(event, data);
  }

  private updateKeyringRuntimeState(
    state: Partial<
      Pick<
        MemStoreState,
        | 'keyringRuntimeReady'
        | 'keyringRuntimeRestoring'
        | 'keyringRuntimeRestoreError'
      >
    >,
  ) {
    this.memStore.updateState(state);
  }

  private resetKeyringRuntimeState() {
    this.keyringRuntimeRestoreId += 1;
    this.pendingKeyringRuntimeRestore = null;
    this.keyringRuntimeRestorePromise = null;
    this.updateKeyringRuntimeState({
      keyringRuntimeReady: false,
      keyringRuntimeRestoring: false,
      keyringRuntimeRestoreError: null,
    });
  }

  private markKeyringRuntimeReady() {
    this.pendingKeyringRuntimeRestore = null;
    this.keyringRuntimeRestorePromise = null;
    this.updateKeyringRuntimeState({
      keyringRuntimeReady: true,
      keyringRuntimeRestoring: false,
      keyringRuntimeRestoreError: null,
    });
  }
  loadStore(initState: Partial<KeyringState>) {
    this.store = new ObservableStore({
      booted: initState.booted || undefined,
      vault: initState.vault || undefined,
      unencryptedKeyringData: initState.unencryptedKeyringData || undefined,
      publicAccountSnapshot: this.normalizePublicAccountSnapshot(
        initState.publicAccountSnapshot,
      ),
      hasEncryptedKeyringData: initState.hasEncryptedKeyringData || false,
      passwordState: normalizeKeyringPasswordState(initState.passwordState),
    });
  }
  private async _setupBoot(
    password: string,
    passwordState?: KeyringPasswordState,
  ) {
    this.#password = password;
    const encryptBooted = await this.encryptor.encrypt(password, 'true');
    this.store.updateState({
      booted: encryptBooted,
      ...(passwordState ? { passwordState } : null),
    });
  }
  async boot(password: string, options: KeyringPasswordUpdateOptions = {}) {
    await this._setupBoot(password, options.passwordState);
    this.memStore.updateState({
      isUnlocked: true,
      keyringRuntimeReady: true,
      keyringRuntimeRestoring: false,
      keyringRuntimeRestoreError: null,
    });
  }
  // TODO: add strict check for newPassword in logic layer too.
  async updatePassword(
    oldPassword: string,
    newPassword: string,
    options: KeyringPasswordUpdateOptions = {},
  ) {
    await this.verifyPassword(oldPassword);
    const wasUnlocked = this.isUnlocked();

    this.emit('beforeUpdatePassword', {
      keyringState: this.store.getState(),
    });

    const restoredVaultIntoRuntime =
      await this.ensureVaultLoadedForPasswordUpdate(oldPassword);

    await this.persistPasswordAndAllKeyrings(
      newPassword,
      options.passwordState,
    );

    if (!wasUnlocked) {
      await this.restoreLockedRuntimeAfterPasswordUpdate();
    } else if (restoredVaultIntoRuntime) {
      await this._updateMemStoreKeyrings();
    }
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
  private getPublicAccountSnapshotAccountCount() {
    const snapshot = this.getPublicAccountSnapshotFromStore();
    return this.isPublicAccountSnapshotValid(snapshot)
      ? snapshot?.accounts.length ?? 0
      : 0;
  }
  async getCountOfAccountsInKeyring() {
    const snapshotAccountCount = this.getPublicAccountSnapshotAccountCount();
    if (snapshotAccountCount > 0) {
      return snapshotAccountCount;
    }

    const accounts = await this.getAllTypedVisibleAccounts();
    return accounts.length;
  }
  /**
   * @description on no keyrings stored, force reset password
   * @param newPassword
   */
  async resetPassword(
    newPassword: string,
    options: KeyringPasswordUpdateOptions = {},
  ) {
    if (await this.getCountOfAccountsInKeyring()) {
      throw new Error(
        "You're trying to overwrite password on existing keyrings.",
      );
    }

    this.keyrings = [];
    await this.persistPasswordAndAllKeyrings(
      newPassword,
      options.passwordState,
    );
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
      this.store.updateState({
        vault: undefined,
        booted: undefined,
        passwordState: undefined,
      });
    }
  }
  getPasswordState() {
    return this.store.getState().passwordState;
  }
  setPasswordState(passwordState: KeyringPasswordState) {
    this.store.updateState({ passwordState });
  }
  completeAuthTransition(transition: KeyringAuthTransition) {
    const current = this.getPasswordState();
    if (!current || current.pendingAuthTransition !== transition) {
      return false;
    }

    this.store.updateState({
      passwordState: {
        ...current,
        pendingAuthTransition: undefined,
      },
    });
    return true;
  }
  isBooted() {
    return Boolean(this.store.getState().booted);
  }
  isUnlocked() {
    return this.memStore.getState().isUnlocked;
  }
  isKeyringRuntimeReady() {
    return this.memStore.getState().keyringRuntimeReady;
  }
  isKeyringRuntimeRestoring() {
    return this.memStore.getState().keyringRuntimeRestoring;
  }
  private hasRuntimeKeyringForType(type: string | KeyringTypeName) {
    return this.keyrings.some(keyring => keyring.type === type);
  }
  private hasPendingRuntimeKeyringDataForType(type: string | KeyringTypeName) {
    const pending = this.pendingKeyringRuntimeRestore;
    if (pending) {
      return [
        ...pending.keyringsToRestore,
        ...pending.unencryptedKeyringData,
      ].some(serialized => serialized.type === type);
    }

    return Boolean(
      this.store
        .getState()
        .unencryptedKeyringData?.some(serialized => serialized.type === type),
    );
  }
  private shouldWaitForKeyringRuntime(type?: string | KeyringTypeName) {
    if (!this.isUnlocked() || this.isKeyringRuntimeReady()) {
      return false;
    }

    if (type) {
      return (
        isSensitiveKeyringType(type) ||
        (!this.hasRuntimeKeyringForType(type) &&
          this.hasPendingRuntimeKeyringDataForType(type))
      );
    }

    return true;
  }
  private async ensureKeyringRuntimeReadyForType(
    reason: string,
    type?: string | KeyringTypeName,
  ) {
    if (this.shouldWaitForKeyringRuntime(type)) {
      await this.ensureKeyringRuntimeReady(reason);
    }
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
    this.resetKeyringRuntimeState();
    this.memStore.updateState({ isUnlocked: false });
    // remove keyrings
    this.keyrings = [];
    await this.restoreUnencryptedKeyrings();
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
  private _setUnlocked(options: {
    scene:
      | 'unlock'
      | 'finish:importPrivateKey'
      | 'finish:createKeyringWithMnemonics';
  }): void {
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
  async submitPassword(
    password: string,
    options: SubmitPasswordOptions = {},
  ): Promise<MemStoreState> {
    if (this._isSubmittingPassword) {
      this.traceKeyringPerf('submit_password.already_submitting');
      return this.memStore.getState();
    }

    const startedAt = nowMs();
    const encryptedVault = this.store.getState().vault;
    const hasVault = Boolean(encryptedVault);
    const trustedPassword = Boolean(options.trustedPassword);
    const shouldVerifyBeforeUnlock = !trustedPassword || !hasVault;

    this.traceKeyringPerf('submit_password.start', {
      hasVault,
      trustedPassword,
      hasTrustedVaultKeyString:
        typeof options.trustedVaultKeyString === 'string',
      deferMemStoreKeyringsUpdate: Boolean(options.deferMemStoreKeyringsUpdate),
      deferKeyringRuntimeRestore: Boolean(options.deferKeyringRuntimeRestore),
      shouldVerifyBeforeUnlock,
    });

    try {
      this._isSubmittingPassword = true;
      if (shouldVerifyBeforeUnlock) {
        this.traceKeyringPerf('submit_password.verify_password_start', {
          elapsedMs: nowMs() - startedAt,
        });
        await this.verifyPassword(password);
        this.traceKeyringPerf('submit_password.verify_password_end', {
          elapsedMs: nowMs() - startedAt,
        });
      }
      this.#password = password;
      try {
        if (hasVault) {
          this.traceKeyringPerf('submit_password.unlock_keyrings_start', {
            elapsedMs: nowMs() - startedAt,
          });
          this.keyrings = await this.unlockKeyrings(password, {
            trustedVaultKeyString: options.trustedVaultKeyString,
            onTrustedVaultKeyString: options.onTrustedVaultKeyString,
            deferMemStoreKeyringsUpdate: options.deferMemStoreKeyringsUpdate,
            deferKeyringRuntimeRestore: options.deferKeyringRuntimeRestore,
          });
          this.traceKeyringPerf('submit_password.unlock_keyrings_end', {
            elapsedMs: nowMs() - startedAt,
            keyringCount: this.keyrings.length,
          });
        }
      } catch (error) {
        if (hasVault) {
          throw error;
        }
      }
      this.traceKeyringPerf('submit_password.set_unlocked_start', {
        elapsedMs: nowMs() - startedAt,
      });
      this._setUnlocked({ scene: 'unlock' });
      this.traceKeyringPerf('submit_password.set_unlocked_end', {
        elapsedMs: nowMs() - startedAt,
      });

      // Populate the locked-read stores for older vaults without forcing a
      // rewrite on every unlock.
      if (
        this.keyrings.length &&
        (!this.store.getState().unencryptedKeyringData ||
          !this.hasPublicAccountSnapshot())
      ) {
        this.traceKeyringPerf('submit_password.legacy_persist_start', {
          elapsedMs: nowMs() - startedAt,
        });
        await this.persistAllKeyrings();
        this.traceKeyringPerf('submit_password.legacy_persist_end', {
          elapsedMs: nowMs() - startedAt,
        });
      }

      this.traceKeyringPerf('submit_password.full_update_start', {
        elapsedMs: nowMs() - startedAt,
      });
      const state = this.fullUpdate();
      this.traceKeyringPerf('submit_password.full_update_end', {
        elapsedMs: nowMs() - startedAt,
      });
      this.traceKeyringPerf('submit_password.end', {
        elapsedMs: nowMs() - startedAt,
        keyringCount: this.keyrings.length,
      });
      return state;
    } catch (error) {
      this.traceKeyringPerf('submit_password.error', {
        elapsedMs: nowMs() - startedAt,
        error: getErrorText(error),
      });
      throw error;
    } finally {
      this._isSubmittingPassword = false;
    }
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
    if (this.shouldWaitForKeyringRuntime()) {
      await this.ensureKeyringRuntimeReady('remove_empty_keyrings');
    }
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
    await this.ensureKeyringRuntimeReadyForType('check_for_duplicate', type);
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
    try {
      this.assertCanPersistKeyringMutation(selectedKeyring);
    } catch (error) {
      return Promise.reject(error);
    }

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
      .then(() => this.persistKeyringsForKeyring(selectedKeyring))
      .then(this._updateMemStoreKeyrings.bind(this))
      .then(this.fullUpdate.bind(this))
      .then(() => _accounts);
  }

  async addNewWatchAccounts(
    selectedKeyring: KeyringInstance | KeyringIntf,
    addresses: string[],
  ): Promise<string[]> {
    await this.ensureKeyringRuntimeReadyForType(
      'add_new_watch_accounts',
      selectedKeyring.type,
    );
    this.assertCanPersistKeyringMutation(selectedKeyring);

    if (
      selectedKeyring.type !== KEYRING_TYPE.WatchAddressKeyring ||
      typeof selectedKeyring.setAccountToAdd !== 'function'
    ) {
      throw new Error('addNewWatchAccounts requires a Watch Address keyring');
    }

    const existingAccounts = await selectedKeyring.getAccounts();
    const existingAddresses = new Set(
      existingAccounts.map(address => normalizeAddress(address).toLowerCase()),
    );
    const addedAddresses: string[] = [];

    try {
      for (const address of addresses) {
        const normalizedAddress = normalizeAddress(address);
        const normalizedKey = normalizedAddress.toLowerCase();
        if (existingAddresses.has(normalizedKey)) {
          continue;
        }

        selectedKeyring.setAccountToAdd(normalizedAddress);
        const added = await selectedKeyring.addAccounts(1);
        if (!added[0]) {
          throw new Error('Watch Address keyring did not add an account');
        }
        const addedAddress = normalizeAddress(added[0]);
        existingAddresses.add(addedAddress.toLowerCase());
        addedAddresses.push(addedAddress);
      }
    } catch (error) {
      await selectedKeyring.deserialize({ accounts: existingAccounts });
      throw error;
    }

    if (!addedAddresses.length) {
      return [];
    }

    const addedAccounts = addedAddresses.map(address => ({
      address,
      brandName: selectedKeyring.type,
      type: selectedKeyring.type as KeyringTypeName,
    }));

    if (this.onSetAddressAliases) {
      await this.onSetAddressAliases(
        selectedKeyring,
        addedAccounts,
        this.contactService,
      );
    } else {
      await Promise.all(
        addedAccounts.map(account =>
          this.onSetAddressAlias?.(
            selectedKeyring,
            account,
            this.contactService,
          ),
        ),
      );
    }
    await this.persistKeyringsForKeyring(selectedKeyring);
    await this._updateMemStoreKeyrings();
    this.fullUpdate();
    addedAccounts.forEach(account => {
      this.emit('newAccount', account as KeyringEventAccount);
    });

    return addedAddresses;
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
    this.assertUnlocked();
    await this.ensureKeyringRuntimeReady('export_account');

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
        this.assertCanPersistKeyringMutation(keyring);

        // Not all the keyrings support this, so we have to check
        if (typeof keyring.removeAccount === 'function') {
          keyring.removeAccount(address, brand);
          const accountLike: KeyringEventAccount = {
            address,
            type,
            brandName: brand || '',
          };
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
        return currentKeyring;
      })
      .then(currentKeyring => this.persistKeyringsForKeyring(currentKeyring))
      .then(this._updateMemStoreKeyrings.bind(this))
      .then(this.fullUpdate.bind(this))
      .catch(e => {
        return Promise.reject(e);
      });
  }
  removeKeyringByPublicKey(publicKey: string) {
    return this.ensureKeyringRuntimeReady('remove_keyring_by_public_key')
      .then(() => {
        const keyring = (this.keyrings as KeyringIntf[]).find(
          item => item.publicKey === publicKey,
        );
        if (keyring) {
          this.assertCanPersistKeyringMutation(keyring);
        }

        this.keyrings = (this.keyrings as KeyringIntf[]).filter(item => {
          if (item.publicKey) {
            return item.publicKey !== publicKey;
          }
          return true;
        });
      })
      .then(() => this.persistAllKeyrings())
      .then(this._updateMemStoreKeyrings.bind(this))
      .then(this.fullUpdate.bind(this))
      .catch(e => {
        return Promise.reject(e);
      });
  }
  async addKeyring<T extends KeyringInstance>(
    keyring: KeyringInstance,
  ): Promise<string[] | T | boolean> {
    if (this.shouldWaitForKeyringRuntime(keyring.type)) {
      await this.ensureKeyringRuntimeReady('add_keyring');
    }
    this.assertCanPersistKeyringMutation(keyring);

    return keyring
      .getAccounts()
      .then(accounts => {
        return this.checkForDuplicate(keyring.type, accounts);
      })
      .then(() => {
        this.keyrings.push(keyring);
        return this.persistKeyringsForKeyring(keyring);
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
  private async serializeKeyrings(keyrings = this.keyrings) {
    return Promise.all(
      keyrings.map(async keyring => {
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
  }
  /**
   * Unlock Keyrings
   *
   * Attempts to unlock the persisted encrypted storage,
   * initializing the persisted keyrings to RAM.
   * @param password
   */
  async unlockKeyrings(
    password: string,
    options: SubmitPasswordOptions = {},
  ): Promise<any[]> {
    const startedAt = nowMs();
    const encryptedVault = this.store.getState().vault;
    if (!encryptedVault) {
      // throw new Error(i18n.t('background.error.canNotUnlock'));
      throw new Error('Cannot unlock without a previous vault');
    }

    this.traceKeyringPerf('unlock_keyrings.start', {
      hasTrustedVaultKeyString:
        typeof options.trustedVaultKeyString === 'string',
      deferMemStoreKeyringsUpdate: Boolean(options.deferMemStoreKeyringsUpdate),
      deferKeyringRuntimeRestore: Boolean(options.deferKeyringRuntimeRestore),
    });
    this.traceKeyringPerf('unlock_keyrings.clear_keyrings_start');
    await this.clearKeyrings();
    this.traceKeyringPerf('unlock_keyrings.clear_keyrings_end', {
      elapsedMs: nowMs() - startedAt,
    });
    let vault: unknown = null;

    if (options.trustedVaultKeyString) {
      this.traceKeyringPerf('unlock_keyrings.decrypt_cached_key_start', {
        elapsedMs: nowMs() - startedAt,
      });
      try {
        vault = await this.encryptor.decryptWithExportedKey(
          encryptedVault,
          options.trustedVaultKeyString,
        );
        this.traceKeyringPerf('unlock_keyrings.decrypt_cached_key_end', {
          elapsedMs: nowMs() - startedAt,
          success: true,
        });
      } catch {
        vault = null;
        this.traceKeyringPerf('unlock_keyrings.decrypt_cached_key_end', {
          elapsedMs: nowMs() - startedAt,
          success: false,
        });
      }
    }

    if (!vault) {
      this.traceKeyringPerf('unlock_keyrings.decrypt_password_start', {
        elapsedMs: nowMs() - startedAt,
      });
      const decryptDetail = await this.encryptor.decryptWithDetail(
        password,
        encryptedVault,
      );
      vault = decryptDetail.vault;
      this.traceKeyringPerf('unlock_keyrings.decrypt_password_end', {
        elapsedMs: nowMs() - startedAt,
        hasExportedKeyString: Boolean(decryptDetail.exportedKeyString),
      });

      if (decryptDetail.exportedKeyString) {
        Promise.resolve()
          .then(() =>
            options.onTrustedVaultKeyString?.(decryptDetail.exportedKeyString!),
          )
          .catch(() => {
            // The cache is only a fast path for future unlocks.
          });
      }
    }

    const unencryptedKeyringData = this.store.getState().unencryptedKeyringData;
    const hasUnencryptedKeyringData = Array.isArray(unencryptedKeyringData);
    const keyringsToRestore = hasUnencryptedKeyringData
      ? (vault as KeyringSerializedData[]).filter(({ type }) =>
          isSensitiveKeyringType(type),
        )
      : (vault as KeyringSerializedData[]);
    const shouldDeferKeyringRuntimeRestore = Boolean(
      options.deferKeyringRuntimeRestore && this.hasPublicAccountSnapshot(),
    );

    if (
      options.deferKeyringRuntimeRestore &&
      !shouldDeferKeyringRuntimeRestore
    ) {
      this.traceKeyringPerf(
        'unlock_keyrings.defer_runtime_restore_unavailable',
        {
          elapsedMs: nowMs() - startedAt,
          hasPublicAccountSnapshot: this.hasPublicAccountSnapshot(),
        },
      );
    }

    if (shouldDeferKeyringRuntimeRestore) {
      this.pendingKeyringRuntimeRestore = {
        keyringsToRestore: Array.from(
          keyringsToRestore as KeyringSerializedData[],
        ),
        unencryptedKeyringData: hasUnencryptedKeyringData
          ? Array.from(unencryptedKeyringData)
          : [],
        hasUnencryptedKeyringData,
        scheduledAt: nowMs(),
      };
      this.updateKeyringRuntimeState({
        keyringRuntimeReady: false,
        keyringRuntimeRestoring: false,
        keyringRuntimeRestoreError: null,
      });
      this.traceKeyringPerf('unlock_keyrings.defer_runtime_restore_scheduled', {
        elapsedMs: nowMs() - startedAt,
        sensitiveKeyringCount: keyringsToRestore.length,
        unencryptedKeyringCount: hasUnencryptedKeyringData
          ? unencryptedKeyringData.length
          : 0,
      });
      return this.keyrings;
    }

    // TODO: FIXME
    this.traceKeyringPerf('unlock_keyrings.restore_sensitive_start', {
      elapsedMs: nowMs() - startedAt,
      keyringCount: keyringsToRestore.length,
      hasUnencryptedKeyringData,
    });
    await Promise.all(
      Array.from(keyringsToRestore as KeyringSerializedData[]).map(serialized =>
        this._restoreKeyring(serialized),
      ),
    );
    this.traceKeyringPerf('unlock_keyrings.restore_sensitive_end', {
      elapsedMs: nowMs() - startedAt,
      runtimeKeyringCount: this.keyrings.length,
    });
    if (hasUnencryptedKeyringData) {
      this.traceKeyringPerf('unlock_keyrings.restore_unencrypted_start', {
        elapsedMs: nowMs() - startedAt,
        keyringCount: unencryptedKeyringData.length,
      });
      await Promise.all(
        unencryptedKeyringData.map(serialized =>
          this._restoreKeyring(serialized),
        ),
      );
      this.traceKeyringPerf('unlock_keyrings.restore_unencrypted_end', {
        elapsedMs: nowMs() - startedAt,
        runtimeKeyringCount: this.keyrings.length,
      });
    }
    if (!options.deferMemStoreKeyringsUpdate) {
      this.traceKeyringPerf('unlock_keyrings.update_memstore_start', {
        elapsedMs: nowMs() - startedAt,
      });
      await this._updateMemStoreKeyrings();
      this.traceKeyringPerf('unlock_keyrings.update_memstore_end', {
        elapsedMs: nowMs() - startedAt,
      });
    } else {
      this.traceKeyringPerf('unlock_keyrings.update_memstore_skipped', {
        elapsedMs: nowMs() - startedAt,
      });
    }
    this.traceKeyringPerf('unlock_keyrings.end', {
      elapsedMs: nowMs() - startedAt,
      keyringCount: this.keyrings.length,
    });
    this.markKeyringRuntimeReady();
    return this.keyrings;
  }
  async startDeferredKeyringRuntimeRestore(reason = 'unknown'): Promise<any[]> {
    if (this.isKeyringRuntimeReady()) {
      this.traceKeyringPerf('keyring_runtime_restore_skip_ready', {
        reason,
        keyringCount: this.keyrings.length,
      });
      return this.keyrings;
    }

    if (this.keyringRuntimeRestorePromise) {
      this.traceKeyringPerf('keyring_runtime_restore_join_existing', {
        reason,
      });
      return this.keyringRuntimeRestorePromise;
    }

    const pending = this.pendingKeyringRuntimeRestore;
    if (!pending) {
      if (
        this.keyrings.length ||
        !this.store.getState().hasEncryptedKeyringData
      ) {
        this.markKeyringRuntimeReady();
        return this.keyrings;
      }

      throw new Error('Keyring runtime is not ready');
    }

    const restoreId = this.keyringRuntimeRestoreId + 1;
    this.keyringRuntimeRestoreId = restoreId;
    const previousKeyrings = this.keyrings.slice();
    const nextKeyrings = previousKeyrings.slice();
    const startedAt = nowMs();
    this.pendingKeyringRuntimeRestore = null;
    this.updateKeyringRuntimeState({
      keyringRuntimeReady: false,
      keyringRuntimeRestoring: true,
      keyringRuntimeRestoreError: null,
    });
    this.traceKeyringPerf('keyring_runtime_restore_start', {
      reason,
      pendingMs: startedAt - pending.scheduledAt,
      sensitiveKeyringCount: pending.keyringsToRestore.length,
      unencryptedKeyringCount: pending.hasUnencryptedKeyringData
        ? pending.unencryptedKeyringData.length
        : 0,
    });

    this.keyringRuntimeRestorePromise = (async () => {
      try {
        await Promise.all(
          pending.keyringsToRestore.map(serialized =>
            this._restoreKeyring(serialized, {
              restoreId,
              targetKeyrings: nextKeyrings,
            }),
          ),
        );
        this.traceKeyringPerf('keyring_runtime_restore_sensitive_end', {
          reason,
          elapsedMs: nowMs() - startedAt,
          runtimeKeyringCount: nextKeyrings.length,
        });

        if (pending.hasUnencryptedKeyringData) {
          this.traceKeyringPerf('keyring_runtime_restore_unencrypted_start', {
            reason,
            elapsedMs: nowMs() - startedAt,
            keyringCount: pending.unencryptedKeyringData.length,
          });
          await Promise.all(
            pending.unencryptedKeyringData.map(serialized =>
              this._restoreKeyring(serialized, {
                restoreId,
                targetKeyrings: nextKeyrings,
              }),
            ),
          );
          this.traceKeyringPerf('keyring_runtime_restore_unencrypted_end', {
            reason,
            elapsedMs: nowMs() - startedAt,
            runtimeKeyringCount: nextKeyrings.length,
          });
        }

        if (restoreId !== this.keyringRuntimeRestoreId) {
          this.traceKeyringPerf('keyring_runtime_restore_stale_end', {
            reason,
            elapsedMs: nowMs() - startedAt,
          });
          return this.keyrings;
        }

        this.keyrings = nextKeyrings;
        this.traceKeyringPerf('keyring_runtime_restore_update_memstore_start', {
          reason,
          elapsedMs: nowMs() - startedAt,
          runtimeKeyringCount: this.keyrings.length,
        });
        await this._updateMemStoreKeyrings();
        this.traceKeyringPerf('keyring_runtime_restore_update_memstore_end', {
          reason,
          elapsedMs: nowMs() - startedAt,
          runtimeKeyringCount: this.keyrings.length,
        });
        this.markKeyringRuntimeReady();
        this.traceKeyringPerf('keyring_runtime_restore_end', {
          reason,
          elapsedMs: nowMs() - startedAt,
          runtimeKeyringCount: this.keyrings.length,
        });
        return this.keyrings;
      } catch (error) {
        if (restoreId === this.keyringRuntimeRestoreId) {
          this.keyrings = previousKeyrings;
          this.pendingKeyringRuntimeRestore = pending;
          this.keyringRuntimeRestorePromise = null;
          this.updateKeyringRuntimeState({
            keyringRuntimeReady: false,
            keyringRuntimeRestoring: false,
            keyringRuntimeRestoreError: getErrorText(error),
          });
        }

        this.traceKeyringPerf('keyring_runtime_restore_error', {
          reason,
          elapsedMs: nowMs() - startedAt,
          error: getErrorText(error),
        });
        throw error;
      }
    })();

    return this.keyringRuntimeRestorePromise;
  }

  async ensureKeyringRuntimeReady(reason = 'unknown') {
    if (!this.isUnlocked()) {
      this.traceKeyringPerf('ensure_keyring_runtime_ready_locked', { reason });
      throw walletLockedError(`ensure_keyring_runtime_ready.${reason}`);
    }

    if (this.isKeyringRuntimeReady()) {
      return;
    }

    const startedAt = nowMs();
    this.traceKeyringPerf('ensure_keyring_runtime_ready_wait_start', {
      reason,
      isRestoring: this.isKeyringRuntimeRestoring(),
    });
    await this.startDeferredKeyringRuntimeRestore(reason);
    this.traceKeyringPerf('ensure_keyring_runtime_ready_wait_end', {
      reason,
      elapsedMs: nowMs() - startedAt,
      keyringCount: this.keyrings.length,
    });
  }

  async refreshMemStoreKeyrings(): Promise<MemStoreState> {
    const startedAt = nowMs();
    const wasRuntimeReady = this.isKeyringRuntimeReady();
    const hadDeferredRuntimeRestore =
      !!this.pendingKeyringRuntimeRestore ||
      !!this.keyringRuntimeRestorePromise;
    this.traceKeyringPerf('refresh_memstore_keyrings.start', {
      keyringCount: this.keyrings.length,
      wasRuntimeReady,
      hadDeferredRuntimeRestore,
    });
    await this.ensureKeyringRuntimeReady('refresh_memstore_keyrings');
    if (wasRuntimeReady || !hadDeferredRuntimeRestore) {
      await this._updateMemStoreKeyrings();
      this.traceKeyringPerf('refresh_memstore_keyrings.update_memstore_end', {
        elapsedMs: nowMs() - startedAt,
      });
    } else {
      this.traceKeyringPerf(
        'refresh_memstore_keyrings.update_memstore_skipped',
        {
          elapsedMs: nowMs() - startedAt,
        },
      );
    }
    const state = this.fullUpdate();
    this.traceKeyringPerf('refresh_memstore_keyrings.end', {
      elapsedMs: nowMs() - startedAt,
    });
    return state;
  }
  getVaultStorageDebugState(): KeyringVaultStorageDebugState {
    const state = this.store.getState();
    const vault = state.vault;

    return {
      hasVault: !!vault,
      vaultBytes: vault ? getUtf8ByteLength(vault) : 0,
      vaultHash: vault ? hashString(vault) : null,
      hasBooted: !!state.booted,
      hasUnencryptedKeyringData: !!state.unencryptedKeyringData,
      unencryptedKeyringCount: state.unencryptedKeyringData?.length || 0,
      hasEncryptedKeyringData: state.hasEncryptedKeyringData,
    };
  }
  async debugExportTrustedVaultKeyString(password: string): Promise<string> {
    const encryptedVault = this.store.getState().vault;

    if (!encryptedVault) {
      throw new Error('Missing vault');
    }

    const detail = await this.encryptor.decryptWithDetail(
      password,
      encryptedVault,
    );

    if (!detail.exportedKeyString) {
      throw new Error('Missing exported vault key');
    }

    return detail.exportedKeyString;
  }
  private async measureVaultRestorePath(
    label: string,
    source: KeyringVaultTimingResult['source'],
    fn: () => Promise<KeyringSerializedData[]>,
  ): Promise<KeyringVaultTimingResult> {
    const previousKeyrings = this.keyrings;
    const startedAt = nowMs();

    try {
      this.keyrings = [];
      const vault = await fn();
      await Promise.all(
        Array.from(vault).map(serialized => this._restoreKeyring(serialized)),
      );

      return {
        label,
        source,
        success: true,
        durationMs: nowMs() - startedAt,
        keyringCount: this.keyrings.length,
      };
    } catch (error) {
      return {
        label,
        source,
        success: false,
        durationMs: nowMs() - startedAt,
        error: getErrorText(error),
      };
    } finally {
      this.keyrings = previousKeyrings;
    }
  }
  async debugMeasureUnlockPaths(options: {
    password?: string;
    trustedVaultKeyString?: string;
    measurePassword?: boolean;
    measureCachedKey?: boolean;
  }): Promise<KeyringVaultTimingResult[]> {
    const encryptedVault = this.store.getState().vault;
    const results: KeyringVaultTimingResult[] = [];
    const measurePassword =
      options.measurePassword ?? typeof options.password === 'string';
    const measureCachedKey =
      options.measureCachedKey ??
      typeof options.trustedVaultKeyString === 'string';

    if (measurePassword && encryptedVault && options.password) {
      results.push(
        await this.measureVaultRestorePath(
          'password: PBKDF2 + full restore',
          'password',
          async () => {
            const detail = await this.encryptor.decryptWithDetail(
              options.password!,
              encryptedVault,
            );
            return detail.vault as KeyringSerializedData[];
          },
        ),
      );
    } else if (measurePassword) {
      results.push({
        label: 'password: PBKDF2 + full restore',
        source: 'password',
        success: false,
        durationMs: 0,
        error: encryptedVault ? 'Missing password' : 'Missing vault',
      });
    }

    if (measureCachedKey && encryptedVault && options.trustedVaultKeyString) {
      results.push(
        await this.measureVaultRestorePath(
          'cached key: full restore',
          'cachedKey',
          async () =>
            (await this.encryptor.decryptWithExportedKey(
              encryptedVault,
              options.trustedVaultKeyString!,
            )) as KeyringSerializedData[],
        ),
      );
    } else if (measureCachedKey) {
      results.push({
        label: 'cached key: full restore',
        source: 'cachedKey',
        success: false,
        durationMs: 0,
        error: encryptedVault ? 'Missing cached key' : 'Missing vault',
      });
    }

    return results;
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
    options: {
      restoreId?: number;
      targetKeyrings?: any[];
    } = {},
  ): Promise<any> {
    const startedAt = nowMs();
    const { type, data } = serialized;
    this.traceKeyringPerf('restore_keyring.start', {
      type,
    });
    const Keyring = this.getKeyringClassForType(type);
    const keyring =
      typeof this.onCreateKeyring === 'function'
        ? this.onCreateKeyring(Keyring)
        : new Keyring({});
    this.traceKeyringPerf('restore_keyring.deserialize_start', {
      type,
      elapsedMs: nowMs() - startedAt,
    });
    await keyring.deserialize(data);
    this.traceKeyringPerf('restore_keyring.deserialize_end', {
      type,
      elapsedMs: nowMs() - startedAt,
    });

    // getAccounts also validates the accounts for some keyrings
    this.traceKeyringPerf('restore_keyring.get_accounts_start', {
      type,
      elapsedMs: nowMs() - startedAt,
    });
    await keyring.getAccounts();
    this.traceKeyringPerf('restore_keyring.get_accounts_end', {
      type,
      elapsedMs: nowMs() - startedAt,
    });
    if (
      typeof options.restoreId === 'number' &&
      options.restoreId !== this.keyringRuntimeRestoreId
    ) {
      this.traceKeyringPerf('restore_keyring.stale_skip', {
        type,
        elapsedMs: nowMs() - startedAt,
      });
      return keyring;
    }

    const targetKeyrings = options.targetKeyrings ?? this.keyrings;
    targetKeyrings.push(keyring);
    this.traceKeyringPerf('restore_keyring.end', {
      type,
      elapsedMs: nowMs() - startedAt,
    });
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
  //
  // PUBLIC METHODS
  //
  private normalizePublicAccountSnapshot(
    raw: any,
  ): PublicAccountSnapshot | undefined {
    if (
      !raw ||
      raw.version !== PUBLIC_ACCOUNT_SNAPSHOT_VERSION ||
      !Array.isArray(raw.accounts)
    ) {
      return undefined;
    }

    const accounts = raw.accounts
      .map((item: any) => {
        if (!item?.address || !item?.type) {
          return undefined;
        }

        const brandName =
          typeof item.brandName === 'string' && item.brandName
            ? item.brandName
            : item.type;

        return {
          address: normalizeAddress(item.address),
          type: item.type as KeyringTypeName,
          brandName,
          byImport:
            typeof item.byImport === 'boolean' ? item.byImport : undefined,
          publicKey:
            typeof item.publicKey === 'string' && item.publicKey
              ? item.publicKey
              : undefined,
          hdPathBasePublicKey:
            typeof item.hdPathBasePublicKey === 'string' &&
            item.hdPathBasePublicKey
              ? item.hdPathBasePublicKey
              : undefined,
          hdPathType:
            typeof item.hdPathType === 'string' && item.hdPathType
              ? item.hdPathType
              : undefined,
          hdPathIndex:
            typeof item.hdPathIndex === 'number' ? item.hdPathIndex : undefined,
          hasBackup:
            typeof item.hasBackup === 'boolean' ? item.hasBackup : undefined,
          needPassphrase:
            typeof item.needPassphrase === 'boolean'
              ? item.needPassphrase
              : undefined,
        } as PublicAccountSnapshotItem;
      })
      .filter(Boolean) as PublicAccountSnapshotItem[];

    if (raw.accounts.length > 0 && !accounts.length) {
      return undefined;
    }

    return {
      version: PUBLIC_ACCOUNT_SNAPSHOT_VERSION,
      updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : 0,
      accounts,
    };
  }
  private isPublicAccountSnapshotValid(snapshot?: PublicAccountSnapshot) {
    return (
      !!snapshot &&
      snapshot.version === PUBLIC_ACCOUNT_SNAPSHOT_VERSION &&
      Array.isArray(snapshot.accounts) &&
      snapshot.accounts.length > 0 &&
      snapshot.accounts.every(item => !!item.address && !!item.type)
    );
  }
  hasPublicAccountSnapshot() {
    return this.isPublicAccountSnapshotValid(
      this.getPublicAccountSnapshotFromStore(),
    );
  }
  hasPersistedPublicAccountSnapshot() {
    const snapshot = this.getPublicAccountSnapshotFromStore();
    return (
      !!snapshot &&
      snapshot.version === PUBLIC_ACCOUNT_SNAPSHOT_VERSION &&
      Array.isArray(snapshot.accounts)
    );
  }
  getPublicAccountSnapshotAccounts() {
    const snapshotAccounts = this.getAccountsFromSnapshot();
    if (snapshotAccounts.length) {
      this.traceKeyringPerf('public_snapshot_used', {
        method: 'getPublicAccountSnapshotAccounts',
        accountCount: snapshotAccounts.length,
      });
    }
    return snapshotAccounts;
  }
  private async getPublicAccountSnapshotAccountInfo(
    keyring: KeyringInstance,
    address: string,
  ) {
    if (typeof (keyring as any)?.getAccountInfo === 'function') {
      try {
        const accountInfo = await (keyring as any).getAccountInfo(address);
        if (accountInfo) {
          return accountInfo;
        }
      } catch {
        // Fall through to getInfoByAddress when a keyring exposes both APIs.
      }
    }

    if (typeof (keyring as any)?.getInfoByAddress === 'function') {
      try {
        return await (keyring as any).getInfoByAddress(address);
      } catch {
        return undefined;
      }
    }

    return undefined;
  }
  private async buildPublicAccountSnapshotFromRuntime(): Promise<PublicAccountSnapshot> {
    const typedAccounts = await Promise.all(
      this.keyrings.map(async keyring => ({
        keyring,
        display: await this.displayForKeyring(keyring),
      })),
    );

    const accounts = (
      await Promise.all(
        typedAccounts
          .filter(({ display }) => display.accounts.length > 0)
          .map(({ keyring, display }) =>
            Promise.all(
              display.accounts.map(async account => {
                const address = normalizeAddress(account.address);
                const type = display.type as KeyringTypeName;
                const accountInfo =
                  await this.getPublicAccountSnapshotAccountInfo(
                    keyring,
                    address,
                  );
                const hdPathBasePublicKey =
                  typeof accountInfo?.hdPathBasePublicKey === 'string' &&
                  accountInfo.hdPathBasePublicKey
                    ? accountInfo.hdPathBasePublicKey
                    : typeof accountInfo?.basePublicKey === 'string' &&
                      accountInfo.basePublicKey
                    ? accountInfo.basePublicKey
                    : undefined;

                return {
                  address,
                  type,
                  brandName: account.brandName || type,
                  byImport:
                    typeof display.byImport === 'boolean'
                      ? display.byImport
                      : undefined,
                  publicKey:
                    typeof display.publicKey === 'string' && display.publicKey
                      ? display.publicKey
                      : undefined,
                  hdPathBasePublicKey,
                  hdPathType:
                    typeof accountInfo?.hdPathType === 'string' &&
                    accountInfo.hdPathType
                      ? accountInfo.hdPathType
                      : undefined,
                  hdPathIndex:
                    typeof accountInfo?.index === 'number'
                      ? accountInfo.index
                      : undefined,
                  hasBackup:
                    typeof (keyring as any).hasBackup === 'boolean'
                      ? (keyring as any).hasBackup
                      : undefined,
                  needPassphrase:
                    typeof (keyring as any).needPassphrase === 'boolean'
                      ? (keyring as any).needPassphrase
                      : undefined,
                } as PublicAccountSnapshotItem;
              }),
            ),
          ),
      )
    ).flat();

    return {
      version: PUBLIC_ACCOUNT_SNAPSHOT_VERSION,
      updatedAt: Date.now(),
      accounts,
    };
  }
  private getPublicAccountSnapshotFromStore() {
    return this.normalizePublicAccountSnapshot(
      this.store.getState().publicAccountSnapshot,
    );
  }
  private async writeMergedPublicAccountSnapshotFromRuntime(
    changedTypes: string[] = [],
  ) {
    const runtimeSnapshot = await this.buildPublicAccountSnapshotFromRuntime();
    const runtimeTypes = new Set<string>(
      runtimeSnapshot.accounts.map(item => item.type),
    );
    changedTypes.forEach(type => runtimeTypes.add(type));

    const existingSnapshot = this.getPublicAccountSnapshotFromStore();
    const existingAccounts = existingSnapshot?.accounts || [];
    const snapshot: PublicAccountSnapshot = {
      version: PUBLIC_ACCOUNT_SNAPSHOT_VERSION,
      updatedAt: Date.now(),
      accounts: [
        ...existingAccounts.filter(item => !runtimeTypes.has(item.type)),
        ...runtimeSnapshot.accounts,
      ],
    };

    this.store.updateState({ publicAccountSnapshot: snapshot });
    return snapshot;
  }
  private getAccountsFromSnapshot() {
    const snapshot = this.getPublicAccountSnapshotFromStore();
    const accounts = snapshot?.accounts;
    if (!this.isPublicAccountSnapshotValid(snapshot) || !accounts) {
      return [];
    }

    return accounts.map(item => ({
      address: normalizeAddress(item.address),
      type: item.type,
      brandName: item.brandName || item.type,
      byImport: item.byImport,
      publicKey: item.publicKey,
      hdPathBasePublicKey: item.hdPathBasePublicKey,
      hdPathType: item.hdPathType,
      hdPathIndex: item.hdPathIndex,
      hasBackup: item.hasBackup,
      needPassphrase: item.needPassphrase,
    }));
  }
  private getTypedAccountsFromSnapshot() {
    const snapshot = this.getPublicAccountSnapshotFromStore();
    const accounts = snapshot?.accounts;
    if (!this.isPublicAccountSnapshotValid(snapshot) || !accounts) {
      return [];
    }

    const grouped = accounts.reduce(
      (acc, item) => {
        const groupId = [
          item.type,
          item.brandName,
          item.publicKey || '',
          item.hdPathBasePublicKey || '',
          item.hdPathType || '',
          String(item.hasBackup ?? ''),
          String(item.needPassphrase ?? ''),
          String(item.byImport ?? ''),
        ].join('|');
        if (!acc[groupId]) {
          acc[groupId] = {
            type: item.type,
            byImport: item.byImport,
            publicKey: item.publicKey,
            hasBackup: item.hasBackup,
            needPassphrase: item.needPassphrase,
            accounts: [] as PublicAccountSnapshotItem[],
          };
        }

        acc[groupId].accounts.push(item);
        return acc;
      },
      {} as Record<
        string,
        {
          type: KeyringTypeName;
          byImport?: boolean;
          publicKey?: string;
          hasBackup?: boolean;
          needPassphrase?: boolean;
          accounts: PublicAccountSnapshotItem[];
        }
      >,
    );

    return Object.values(grouped).map(group => ({
      type: group.type,
      accounts: group.accounts,
      keyring: new DisplayKeyring({
        type: group.type,
      }),
      byImport: group.byImport,
      publicKey: group.publicKey,
      hasBackup: group.hasBackup,
      needPassphrase: group.needPassphrase,
    })) as DisplayedKeyring[];
  }
  // TODO: add strict check for newPassword in logic layer too.
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
  assertUnlocked() {
    if (!this.isUnlocked()) {
      throw walletLockedError('assert_unlocked');
    }
  }
  private assertCanPersistKeyringMutation(keyring: { type: string }) {
    if (!isSensitiveKeyringType(keyring.type)) {
      return;
    }

    if (!this.#password || typeof this.#password !== 'string') {
      throw walletLockedError('persist_keyring_mutation');
    }
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
  // eslint-disable-next-line jsdoc/require-returns
  //
  // SIGNING METHODS
  //
  private getUnencryptedKeyringData(
    serializedKeyrings: KeyringSerializedData[],
  ) {
    return serializedKeyrings
      .map(({ type, data }) => {
        if (!isSensitiveKeyringType(type)) {
          return { type, data };
        }

        // maybe empty keyring
        // TODO: maybe need remove simple keyring if empty
        if (type === KEYRING_TYPE.SimpleKeyring && !data.length) {
          return undefined;
        }

        return undefined;
      })
      .filter(Boolean) as KeyringSerializedData[];
  }
  private hasEncryptedKeyrings(serializedKeyrings: KeyringSerializedData[]) {
    return serializedKeyrings.some(({ type, data }) => {
      if (!isSensitiveKeyringType(type)) {
        return false;
      }

      return !(type === KEYRING_TYPE.SimpleKeyring && !data.length);
    });
  }
  private async shouldRestoreVaultForPasswordUpdate() {
    const state = this.store.getState();
    if (!state.vault) {
      return false;
    }

    if (!this.isUnlocked() || !this.keyrings.length) {
      return true;
    }

    const serializedKeyrings = await this.serializeKeyrings();
    if (
      state.hasEncryptedKeyringData &&
      !this.hasEncryptedKeyrings(serializedKeyrings)
    ) {
      return true;
    }

    const persistedUnencryptedCount = state.unencryptedKeyringData?.length || 0;
    const runtimeUnencryptedCount =
      this.getUnencryptedKeyringData(serializedKeyrings).length;

    return persistedUnencryptedCount > 0 && runtimeUnencryptedCount === 0;
  }
  private async ensureVaultLoadedForPasswordUpdate(password: string) {
    if (!(await this.shouldRestoreVaultForPasswordUpdate())) {
      return false;
    }

    await this.unlockKeyrings(password, {
      deferMemStoreKeyringsUpdate: true,
    });
    return true;
  }
  private async restoreLockedRuntimeAfterPasswordUpdate() {
    this.#password = null;
    this.memStore.updateState({ isUnlocked: false });
    this.keyrings = [];
    await this.restoreUnencryptedKeyrings();
  }
  private async persistPasswordAndAllKeyrings(
    password: string,
    passwordState?: KeyringPasswordState,
  ) {
    if (this.isUnlocked() && !this.isKeyringRuntimeReady()) {
      await this.ensureKeyringRuntimeReady('persist_password_and_keyrings');
    }

    const serializedKeyrings = await this.serializeKeyrings();
    const hasEncryptedKeyringData =
      this.hasEncryptedKeyrings(serializedKeyrings);
    const unencryptedKeyringData =
      this.getUnencryptedKeyringData(serializedKeyrings);
    const publicAccountSnapshot =
      await this.buildPublicAccountSnapshotFromRuntime();
    const [booted, vault] = await Promise.all([
      this.encryptor.encrypt(password, 'true'),
      this.encryptor.encrypt(password, serializedKeyrings as unknown as Buffer),
    ]);

    this.#password = password;
    this.store.updateState({
      booted,
      vault,
      unencryptedKeyringData,
      publicAccountSnapshot,
      hasEncryptedKeyringData,
      ...(passwordState ? { passwordState } : null),
    });
  }
  async persistUnencryptedKeyrings(
    changedTypes: string[] = [],
  ): Promise<boolean> {
    const serializedKeyrings = await this.serializeKeyrings();
    const unencryptedKeyringData =
      this.getUnencryptedKeyringData(serializedKeyrings);
    await this.writeMergedPublicAccountSnapshotFromRuntime(changedTypes);

    this.store.updateState({
      unencryptedKeyringData,
    });

    return true;
  }
  async persistKeyringsForKeyring(keyring: any): Promise<boolean> {
    if (isSensitiveKeyringType(keyring.type)) {
      return this.persistAllKeyrings();
    }

    if (this.isUnlocked()) {
      return this.persistAllKeyrings();
    }

    return this.persistUnencryptedKeyrings([keyring.type]);
  }
  async persistAllKeyrings(): Promise<boolean> {
    if (this.isUnlocked() && !this.isKeyringRuntimeReady()) {
      await this.ensureKeyringRuntimeReady('persist_all_keyrings');
    }

    if (!this.#password || typeof this.#password !== 'string') {
      return Promise.reject(
        new Error('KeyringService - password is not a string'),
      );
    }

    const serializedKeyrings = await this.serializeKeyrings();
    const hasEncryptedKeyringData =
      this.hasEncryptedKeyrings(serializedKeyrings);
    const unencryptedKeyringData =
      this.getUnencryptedKeyringData(serializedKeyrings);
    const publicAccountSnapshot =
      await this.buildPublicAccountSnapshotFromRuntime();

    const encryptedString = await this.encryptor.encrypt(
      this.#password as string,
      serializedKeyrings as unknown as Buffer,
    );

    this.store.updateState({
      vault: encryptedString,
      unencryptedKeyringData,
      publicAccountSnapshot,
      hasEncryptedKeyringData,
    });

    return true;
  }
  async restoreUnencryptedKeyrings(): Promise<any[]> {
    const unencryptedKeyringData = this.store.getState().unencryptedKeyringData;
    if (!Array.isArray(unencryptedKeyringData)) {
      return this.keyrings;
    }

    this.keyrings = this.keyrings.filter(keyring =>
      isSensitiveKeyringType(keyring.type),
    );
    await Promise.all(
      unencryptedKeyringData.map(serialized =>
        this._restoreKeyring(serialized),
      ),
    );
    await this._updateMemStoreKeyrings();
    return this.keyrings;
  }
  /* eslint-disable require-await */
  async clearKeyrings(): Promise<void> {
    this.resetKeyringRuntimeState();
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
    if (!this.isKeyringRuntimeReady()) {
      const snapshotAccounts = this.getAccountsFromSnapshot();
      if (snapshotAccounts.length) {
        this.traceKeyringPerf('public_snapshot_fallback_used', {
          method: 'getAccounts',
          accountCount: snapshotAccounts.length,
        });
        return snapshotAccounts.map(item => normalizeAddress(item.address));
      }

      await this.ensureKeyringRuntimeReady('get_accounts');
    }

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
    await this.ensureKeyringRuntimeReadyForType(
      'get_keyring_for_account',
      type,
    );
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
        return winners[0]![0];
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
        hasBackup:
          typeof (keyring as any).hasBackup === 'boolean'
            ? (keyring as any).hasBackup
            : undefined,
        needPassphrase:
          typeof (keyring as any).needPassphrase === 'boolean'
            ? (keyring as any).needPassphrase
            : undefined,
      } as DisplayedKeyring;
    });
  }

  getAllTypedAccounts(): Promise<DisplayedKeyring[]> {
    if (!this.isKeyringRuntimeReady()) {
      const snapshotAccounts = this.getTypedAccountsFromSnapshot();
      if (snapshotAccounts.length) {
        this.traceKeyringPerf('public_snapshot_fallback_used', {
          method: 'getAllTypedAccounts',
          accountGroupCount: snapshotAccounts.length,
        });
        return Promise.resolve(snapshotAccounts);
      }
    }

    return Promise.all(
      this.keyrings.map(keyring => this.displayForKeyring(keyring)),
    );
  }

  async getAllTypedVisibleAccounts(): Promise<DisplayedKeyring[]> {
    if (!this.isKeyringRuntimeReady()) {
      const snapshotAccounts = this.getTypedAccountsFromSnapshot();
      if (snapshotAccounts.length) {
        this.traceKeyringPerf('public_snapshot_fallback_used', {
          method: 'getAllTypedVisibleAccounts',
          accountGroupCount: snapshotAccounts.length,
        });
        return snapshotAccounts;
      }
    }

    const keyrings = await Promise.all(
      this.keyrings.map(keyring => this.displayForKeyring(keyring, false)),
    );
    return keyrings.filter(keyring => keyring.accounts.length > 0);
  }

  async getAllVisibleAccountsArray() {
    if (!this.isKeyringRuntimeReady()) {
      const snapshotAccounts = this.getAccountsFromSnapshot();
      if (snapshotAccounts.length) {
        this.traceKeyringPerf('public_snapshot_fallback_used', {
          method: 'getAllVisibleAccountsArray',
          accountCount: snapshotAccounts.length,
        });
        return snapshotAccounts;
      }
    }

    const typedAccounts = await this.getAllTypedVisibleAccounts();
    const result: KeyringAccount[] = [];
    typedAccounts.forEach(accountGroup => {
      result.push(
        ...accountGroup.accounts.map(account => ({
          ...account,
          address: account.address,
          brandName: account.brandName,
          type: accountGroup.type,
          byImport: accountGroup.byImport,
          publicKey: accountGroup.publicKey,
          hasBackup: accountGroup.hasBackup,
          needPassphrase: accountGroup.needPassphrase,
        })),
      );
    });

    return result;
  }

  async getAllAddresses() {
    if (!this.isKeyringRuntimeReady()) {
      const snapshotAccounts = this.getAccountsFromSnapshot();
      if (snapshotAccounts.length) {
        this.traceKeyringPerf('public_snapshot_fallback_used', {
          method: 'getAllAddresses',
          accountCount: snapshotAccounts.length,
        });
        return snapshotAccounts;
      }
    }

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
    const startedAt = nowMs();
    this.traceKeyringPerf('update_memstore_keyrings.start', {
      keyringCount: this.keyrings.length,
    });
    const keyrings = await Promise.all(
      this.keyrings.map(keyring => this.displayForKeyring(keyring)),
    );
    this.traceKeyringPerf('update_memstore_keyrings.display_end', {
      elapsedMs: nowMs() - startedAt,
      displayedKeyringCount: keyrings.length,
    });
    const result = this.memStore.updateState({ keyrings });
    this.traceKeyringPerf('update_memstore_keyrings.end', {
      elapsedMs: nowMs() - startedAt,
      displayedKeyringCount: keyrings.length,
    });
    return result;
  }

  /**
   * Mnemonic Phrase
   */
  generateMnemonic(): string {
    return bip39.generateMnemonic(import_english.wordlist);
  }

  async generatePreMnemonic(): Promise<string> {
    if (!this.#password) {
      throw walletLockedError('generate_pre_mnemonic');
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
      throw walletLockedError('get_pre_mnemonics');
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
        .then(() =>
          this._setUnlocked({ scene: 'finish:createKeyringWithMnemonics' }),
        )
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
    if (!this.#password || typeof this.#password !== 'string') {
      throw walletLockedError('sync_extension_data');
    }

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

    const encryptedVault = this.store.getState().vault;
    if (!encryptedVault) {
      throw new Error('Cannot unlock without a previous vault');
    }

    oldKeyringSerializedData = (await this.encryptor.decrypt(
      this.#password,
      encryptedVault,
    )) as KeyringSerializedData[];

    const allAccounts = await this.getAllVisibleAccountsArray();

    const addedAccounts: KeyringEventAccount[] = [];

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
      Array.from(mergeKeyringSerializedData).map(serialized =>
        this._restoreKeyring(serialized),
      ),
    );
    await this.persistAllKeyrings();

    await this._updateMemStoreKeyrings();

    addedAccounts.forEach(account => {
      this.emit('newAccount', account);
    });

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
