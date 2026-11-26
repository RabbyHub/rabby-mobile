/* eslint-disable promise/no-multiple-resolved */
/* eslint-disable jsdoc/require-param-description */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable prefer-promise-reject-errors */
import { TransactionFactory } from '@ethereumjs/tx';
import type {
  EVMTransaction,
  EVMTransactionEIP1559,
  Response as OneKeyResponse,
} from '@onekeyfe/hd-core';
import { addressUtils } from '@rabby-wallet/base-utils';
import * as sigUtil from 'eth-sig-util';
import * as ethUtil from 'ethereumjs-util';
import EventEmitter from 'events';
import HDKey from 'hdkey';

import type { OneKeyBridgeInterface } from './onekey-bridge-interface';

const { isSameAddress } = addressUtils;

const keyringType = 'Onekey Hardware';
const hdPathString = "m/44'/60'/0'/0";
const pathBase = 'm';
const MAX_INDEX = 1000;
const DELAY_BETWEEN_POPUPS = 1000;
// HardwareErrorCode.DeviceNotOpenedPassphrase from @onekeyfe/hd-shared
const DEVICE_NOT_OPENED_PASSPHRASE = 113;
// HardwareErrorCode.TransportInvalidProtobuf from @onekeyfe/hd-shared
const TRANSPORT_INVALID_PROTOBUF = 603;
// HardwareErrorCode.TransportProtocolProbeFailed from newer @onekeyfe/hd-shared
const TRANSPORT_PROTOCOL_PROBE_FAILED = 604;

type ConnectProtocol = 'V1' | 'V2';

/**
 * Normalize a device connect id for case-insensitive protocol lookup.
 *
 * @param connectId - The raw connect id.
 * @returns The trimmed lowercase connect id, or undefined when empty.
 */
function normalizeConnectId(connectId?: string | null): string | undefined {
  const normalized = connectId?.trim().toLowerCase();
  return normalized || undefined;
}

/**
 * Whether an SDK failure indicates a bound transport protocol mismatch.
 *
 * @param payload - The failed SDK response payload or thrown error.
 * @param payload.code - The SDK error code.
 * @param payload.error - The SDK error message.
 * @param payload.message - The thrown Error message.
 * @returns True when the stored protocol binding should be cleared and reprobed.
 */
function isProtocolMismatchError(payload?: {
  code?: unknown;
  error?: unknown;
  message?: unknown;
}) {
  const code = Number(payload?.code);
  if (
    code === TRANSPORT_INVALID_PROTOBUF ||
    code === TRANSPORT_PROTOCOL_PROBE_FAILED
  ) {
    return true;
  }
  return /protocol mismatch|protocol probe/iu.test(
    String(payload?.error ?? payload?.message ?? ''),
  );
}

/**
 * Normalize a rejection value into an Error with a readable message.
 *
 * @param e - The rejected value.
 * @returns An Error instance.
 */
function toError(e: unknown): Error {
  if (e instanceof Error) {
    return e;
  }
  if (typeof e === 'string') {
    return new Error(e);
  }
  const payload = e as {
    message?: unknown;
    error?: unknown;
    code?: unknown;
    errorCode?: unknown;
  } | null;
  // SDK failures use `error` for the text. Ignoring it stringifies the
  // payload and drops the readable device message.
  const message = payload?.message ?? payload?.error;
  let error: Error;
  if (typeof message === 'string' && message) {
    error = new Error(message);
  } else {
    try {
      error = new Error(JSON.stringify(e) ?? 'Unknown error');
    } catch {
      error = new Error('Unknown error');
    }
  }
  const code = payload?.code ?? payload?.errorCode;
  if (code !== undefined) {
    Object.assign(error, { code });
  }
  return error;
}

/**
 * Preserve the SDK error code alongside its existing message.
 *
 * @param payload - The failed SDK response payload.
 * @param payload.error - The SDK error message.
 * @param payload.code - The SDK error code.
 * @param fallbackMessage - The message used when the SDK provides none.
 * @returns An Error carrying the SDK code when present.
 */
function sdkError(
  payload: { error?: string; code?: unknown } | undefined,
  fallbackMessage: string,
): Error {
  return toError({
    message: payload?.error || fallbackMessage,
    code: payload?.code,
  });
}

/**
 * Whether a failed wallet selection means passphrase protection is off.
 *
 * @param payload - The failed SDK response payload.
 * @param payload.code - The SDK error code.
 * @param payload.error - The SDK error message.
 * @returns True when the standard wallet should be selected instead.
 */
function isPassphraseDisabledError(payload?: {
  code?: unknown;
  error?: unknown;
}) {
  return (
    payload?.code === DEVICE_NOT_OPENED_PASSPHRASE ||
    /passphrase disabled/iu.test(String(payload?.error ?? ''))
  );
}

/**
 * Whether openWalletSession is missing from this firmware/bridge.
 *
 * @param payload - The failed SDK response payload or thrown error.
 * @param payload.code - The SDK error code.
 * @param payload.error - The SDK error message.
 * @param payload.message - The thrown Error message.
 * @returns True when unlock should fall back to getPassphraseState.
 */
function isUnsupportedWalletSessionError(payload?: {
  code?: unknown;
  error?: unknown;
  message?: unknown;
}) {
  const code = payload?.code;
  const text = String(payload?.error ?? payload?.message ?? '');
  return (
    code === 404 ||
    code === 'MethodNotAllowed' ||
    /onekey action not supported/iu.test(text) ||
    /method not found/iu.test(text) ||
    /methodnotallowed/iu.test(text)
  );
}

/**
 * Whether the device call was cancelled by the user.
 *
 * @param payload - The failed SDK response payload.
 * @param payload.code - The SDK error code.
 * @param payload.error - The SDK error message.
 * @param payload.message - The thrown Error message.
 * @returns True when signing must not self-heal or retry.
 */
function isCancelledError(payload?: {
  code?: unknown;
  error?: unknown;
  message?: unknown;
}) {
  const code = payload?.code;
  return (
    code === 802 ||
    code === 803 ||
    code === 822 ||
    /action cancelled/iu.test(String(payload?.error ?? payload?.message ?? ''))
  );
}

/**
 * Whether a connect id can no longer address the device.
 *
 * Busy and PIN failures are not stale: the same id is still the device.
 *
 * @param payload - The failed SDK response payload.
 * @param payload.code - The SDK error code.
 * @param payload.error - The SDK error message.
 * @param payload.message - The thrown Error message.
 * @returns True when discovery should look for a replacement connect id.
 */
function isStaleConnectError(payload?: {
  code?: unknown;
  error?: unknown;
  message?: unknown;
}) {
  const code = payload?.code;
  // 105 DeviceNotFound, 713 BleTimeout, 720 BleDeviceDisconnected.
  return (
    code === 105 ||
    code === 713 ||
    code === 720 ||
    /device not found|disconnected/iu.test(
      String(payload?.error ?? payload?.message ?? ''),
    )
  );
}

/**
 * Read the passphrase protection flag from a getDeviceState payload.
 *
 * @param payload - The getDeviceState payload.
 * @returns The flag, or undefined when the device did not report it.
 */
function readPassphraseProtection(payload: unknown): boolean | undefined {
  const value = (payload as { status?: { passphraseProtection?: unknown } })
    ?.status?.passphraseProtection;
  return typeof value === 'boolean' ? value : undefined;
}

/**
 * Whether getDeviceState reports the device unlocked with its main PIN.
 *
 * @param payload - The getDeviceState payload.
 * @returns True only when the device is unlocked and not via an attach PIN.
 */
function readMainWalletUnlocked(payload: unknown): boolean {
  const status = (
    payload as { status?: { unlocked?: unknown; unlockedAttachPin?: unknown } }
  )?.status;
  return status?.unlocked === true && status?.unlockedAttachPin === false;
}

/**
 * Read the transport protocol from a getDeviceState payload.
 *
 * @param payload - The getDeviceState payload.
 * @returns The protocol, or undefined when the device did not report it.
 */
function readProtocol(payload: unknown): 'V1' | 'V2' | undefined {
  const value = (payload as { protocol?: unknown })?.protocol;
  return value === 'V1' || value === 'V2' ? value : undefined;
}

type PassphraseParams = {
  passphraseState?: string;
  useEmptyPassphrase?: boolean;
};

/** Cancellation version and unlock epoch captured when an unlock starts. */
type OneKeyUnlockGuard = {
  version: number;
  epoch: number;
};

const NULL_TYPED_DATA_ERROR =
  'Invalid EIP-712 typed data: null is not a valid value for typed signing';

export enum LedgerHDPathType {
  LedgerLive = 'LedgerLive',
  Legacy = 'Legacy',
  BIP44 = 'BIP44',
}

type HDPathType = LedgerHDPathType;

type Account = {
  address: string;
  index: number;
};

type AccountDetail = {
  hdPathBasePublicKey?: string;
  hdPath: string;
  hdPathType: HDPathType;
  index: number;
  connectId?: string | null;
  deviceId?: string | null;
  /**
   * Stray hidden-wallet id. Mobile does not write this, but a vault copied
   * from the extension can still carry it. 113 recovery deletes it.
   */
  passphraseState?: string;
};

/**
 * Check if the given transaction is made with ethereumjs-tx or @ethereumjs/tx
 *
 * Transactions built with older versions of ethereumjs-tx have a
 * getChainId method that newer versions do not.
 * Older versions are mutable
 * while newer versions default to being immutable.
 * Expected shape and type
 * of data for v, r and s differ (Buffer (old) vs BN (new)).
 *
 * @param tx
 * @param tx.getChainId
 * @returns Returns `true` if tx is an old-style ethereumjs-tx transaction.
 */
function isOldStyleEthereumjsTx(tx: { getChainId: any }): boolean {
  return typeof tx.getChainId === 'function';
}

/**
 * Map typed-data hashing failures to a readable client error.
 *
 * @param error - The thrown hashing error.
 * @returns A normalized Error.
 */
function normalizeTypedDataHashError(error: unknown) {
  const message =
    error instanceof Error ? error.message : String(error || 'Unknown error');

  if (
    message.includes('toArray') ||
    message.includes('Received null') ||
    message.includes('received "null"') ||
    message.includes('got "null"')
  ) {
    return new Error(NULL_TYPED_DATA_ERROR);
  }

  return new Error(`Invalid EIP-712 typed data: ${message}`);
}

class OneKeyKeyring extends EventEmitter {
  static type = keyringType;

  type = keyringType;

  accounts: string[] = [];

  hdk = new HDKey();

  page = 0;

  perPage = 5;

  unlockedAccount = 0;

  paths: Record<string, number> = {};

  hdPath = '';

  deviceId: string | null = null;

  connectId: string | null = null;

  passphraseState: string | undefined = undefined;

  /** Last passphrase protection flag read from getDeviceState, if any. */
  private _passphraseProtection: boolean | undefined = undefined;

  /** Last protocol read from getDeviceState, if any. */
  private _protocol: 'V1' | 'V2' | undefined = undefined;

  /** Whether the last getDeviceState showed the main PIN wallet unlocked. */
  private _mainWalletUnlocked = false;

  /** Whether the last getDeviceState reported an attach-PIN session. */
  private _unlockedAttachPin = false;

  /** Connect id of the device call currently in flight, if it differs. */
  pendingConnectId: string | null = null;

  private cancellationVersion = 0;

  /**
   * Bumped on every cleanUp, including a device switch that does not cancel.
   *
   * Kept separate from `cancellationVersion` so an in-flight signature still
   * surfaces the SDK disconnect code instead of "signing cancelled".
   */
  private unlockEpoch = 0;

  private pendingSignings = 0;

  private unlockPromise?: Promise<string>;

  private pendingWorkCancelled = false;

  private passphraseStateCleared = false;

  private deviceProtocolsChanged = false;

  accountDetails: Record<string, AccountDetail>;

  deviceProtocols: Record<string, ConnectProtocol> = {};

  bridge!: OneKeyBridgeInterface;

  constructor(
    opts: any & {
      bridge: OneKeyBridgeInterface;
    } = {},
  ) {
    super();
    if (!opts.bridge) {
      throw new Error('Bridge is required');
    }
    this.bridge = opts.bridge;
    this.accountDetails = {};
    this.deserialize(opts);
  }

  async init() {
    await this.bridge.init();
    this._bindRememberedDeviceProtocols();
  }

  _deviceConnectId?: string;

  setDeviceConnectId(deviceConnectId?: string) {
    if (deviceConnectId && deviceConnectId !== this._deviceConnectId) {
      this.cleanUp();
    }
    this._deviceConnectId = deviceConnectId;
  }

  serialize(): Promise<any> {
    return Promise.resolve({
      hdPath: this.hdPath,
      accounts: this.accounts,
      page: this.page,
      paths: this.paths,
      perPage: this.perPage,
      unlockedAccount: this.unlockedAccount,
      accountDetails: this.accountDetails,
      deviceProtocols: this.deviceProtocols,
    });
  }

  deserialize(opts: any = {}): Promise<void> {
    this.hdPath = opts.hdPath || hdPathString;
    this.accounts = opts.accounts || [];
    this.page = opts.page || 0;
    this.perPage = 5;
    this.paths = opts.paths || {};
    this.accountDetails = opts.accountDetails || {};
    this.deviceProtocols = {};
    if (opts.deviceProtocols && typeof opts.deviceProtocols === 'object') {
      for (const [connectId, protocol] of Object.entries(
        opts.deviceProtocols as Record<string, unknown>,
      )) {
        const normalized = normalizeConnectId(connectId);
        if (normalized && (protocol === 'V1' || protocol === 'V2')) {
          this.deviceProtocols[normalized] = protocol;
        }
      }
    }
    this.deviceProtocolsChanged = false;
    this._bindRememberedDeviceProtocols();
    return Promise.resolve();
  }

  private _bindRememberedDeviceProtocols() {
    for (const [connectId, protocol] of Object.entries(this.deviceProtocols)) {
      this.bridge.setDeviceConnectProtocol?.(connectId, protocol);
    }
  }

  private _getRememberedDeviceProtocol(
    connectId?: string | null,
  ): ConnectProtocol | undefined {
    const normalized = normalizeConnectId(connectId);
    return normalized ? this.deviceProtocols[normalized] : undefined;
  }

  private _rememberDeviceProtocol(
    connectId: string | null | undefined,
    protocol: ConnectProtocol | undefined,
  ) {
    const normalized = normalizeConnectId(connectId);
    if (!normalized || (protocol !== 'V1' && protocol !== 'V2')) {
      return;
    }
    this.bridge.setDeviceConnectProtocol?.(connectId!, protocol);
    if (this.deviceProtocols[normalized] !== protocol) {
      this.deviceProtocols[normalized] = protocol;
      this.deviceProtocolsChanged = true;
    }
  }

  private _forgetDeviceProtocol(connectId: string | null | undefined) {
    const normalized = normalizeConnectId(connectId);
    if (!normalized) {
      return;
    }
    this.bridge.setDeviceConnectProtocol?.(connectId!, undefined);
    if (normalized in this.deviceProtocols) {
      delete this.deviceProtocols[normalized];
      this.deviceProtocolsChanged = true;
    }
  }

  isUnlocked(): boolean {
    return Boolean(this.hdk && this.hdk.publicKey);
  }

  /**
   * Drop the unlocked xpub and wallet/device identity.
   *
   * The selected BLE target (`_deviceConnectId`) is kept so the caller can
   * still search that device. `cleanUp` clears it separately.
   */
  private _resetUnlockedSession() {
    this.hdk = new HDKey();
    this.passphraseState = undefined;
    this.deviceId = null;
    this.connectId = null;
  }

  /**
   * True when this unlock or signing was invalidated, for example by lock.
   *
   * @param version - The version captured when the operation started.
   */
  private _assertNotCancelled(version: number) {
    if (version !== this.cancellationVersion) {
      throw new Error('OneKey signing cancelled');
    }
  }

  /**
   * Reject an unlock that lock cancelled or that a device switch replaced.
   *
   * @param version - Cancellation version captured when the unlock started.
   * @param epoch - Unlock epoch captured when the unlock started.
   */
  private _assertSameUnlock(version: number, epoch: number) {
    this._assertNotCancelled(version);
    if (epoch !== this.unlockEpoch) {
      throw new Error('OneKey signing cancelled');
    }
  }

  /**
   * Whether disconnect cleanup or cancel has invalidated this unlock.
   *
   * @param guard - The generation captured when the unlock started.
   * @returns True when a later guard check would reject the unlock.
   */
  private _unlockWasReplaced(guard: OneKeyUnlockGuard | undefined) {
    if (!guard) {
      return false;
    }
    return (
      guard.version !== this.cancellationVersion ||
      guard.epoch !== this.unlockEpoch
    );
  }

  /**
   * Keep a failed SDK response when this unlock was already invalidated.
   *
   * Disconnect cleanup bumps the epoch while the call is in flight. Checking
   * the epoch first replaces 107/109 with a code-less cancel, and the next
   * mini-sign tx then bumps nonce. A successful response does not throw here.
   *
   * @param guard - The generation captured when the unlock started.
   * @param response - The SDK response, success or failure.
   * @param response.success - Whether the SDK call succeeded.
   * @param response.payload - The SDK payload.
   * @param fallbackMessage - Used when the payload has no error text.
   */
  private _throwStaleSdkFailure(
    guard: OneKeyUnlockGuard | undefined,
    response: { success: boolean; payload?: unknown },
    fallbackMessage: string,
  ) {
    if (response.success || !this._unlockWasReplaced(guard)) {
      return;
    }
    const payload = response.payload as
      | { error?: string; code?: unknown }
      | undefined;
    throw sdkError(
      payload && typeof payload === 'object' && !Array.isArray(payload)
        ? payload
        : undefined,
      fallbackMessage,
    );
  }

  /**
   * Drop a pending unlock so the next device cannot reuse or be cleared by it.
   *
   * Does not bump `cancellationVersion` and does not call `bridge.cancel`.
   */
  private _invalidatePendingUnlock() {
    this.unlockEpoch += 1;
    this.unlockPromise = undefined;
  }

  /**
   * Invalidate any in-flight unlock or signing and ask the device to stop
   * only when something is actually pending.
   *
   * @returns The device cancel promise when a call is in flight.
   */
  cancelPendingWork() {
    this.pendingWorkCancelled = true;
    if (this.unlockPromise || this.pendingSignings) {
      return this.cancel();
    }
    this.cancellationVersion += 1;
    return undefined;
  }

  /**
   * Stop the device call that is in flight, even when its connect id has not
   * been stored on the keyring yet.
   *
   * @returns The device cancel promise, or undefined when no device is selected.
   */
  cancel() {
    this.cancellationVersion += 1;
    const connectId =
      this.pendingConnectId || this.connectId || this._deviceConnectId;
    if (!connectId) {
      return undefined;
    }
    return this.bridge.cancel(connectId);
  }

  /**
   * Count an in-flight signature so lock and import cleanup can see it.
   *
   * @returns The cancellation version captured when the signature started.
   */
  private _beginSigning(): number {
    this.pendingSignings += 1;
    return this.cancellationVersion;
  }

  /** Drop one in-flight signature. */
  private _endSigning() {
    this.pendingSignings = Math.max(0, this.pendingSignings - 1);
  }

  /**
   * Whether 113 recovery removed a passphrase state that the vault still has.
   *
   * The flag is consumed once so a later signature does not persist again.
   *
   * @returns True when the caller should persist account details.
   */
  consumePassphraseStateCleared(): boolean {
    const cleared = this.passphraseStateCleared;
    this.passphraseStateCleared = false;
    return cleared;
  }

  /**
   * Whether the remembered connect-id -> protocol map changed since the last
   * check.
   *
   * @returns True when the caller should persist the keyring.
   */
  consumeDeviceProtocolsChanged(): boolean {
    const changed = this.deviceProtocolsChanged;
    this.deviceProtocolsChanged = false;
    return changed;
  }

  /**
   * Drop the in-memory OneKey session.
   *
   * Called with no argument, this only clears fields. `setDeviceConnectId`
   * relies on that form staying synchronous.
   *
   * @param cancelPending - Also cancel an in-flight unlock before clearing.
   * @returns Nothing. A pending cancel resolves to undefined.
   */
  cleanUp(): undefined;

  cleanUp(cancelPending: true): Promise<undefined> | undefined;

  cleanUp(cancelPending = false) {
    // A signing on this keyring is owned by its approval. Closing an import
    // sheet with cancelPending must not wipe that signing's session.
    if (
      cancelPending &&
      this.pendingSignings > 0 &&
      !this.pendingWorkCancelled
    ) {
      return undefined;
    }
    this.pendingWorkCancelled = false;
    // Snapshot before invalidation clears the promise. A device switch uses
    // the no-argument form: the old unlock must not commit, and it must not
    // cancel the device, so an in-flight signature can still report unplug.
    const hadPendingUnlock = Boolean(this.unlockPromise);
    this._invalidatePendingUnlock();
    let cancelPromise: Promise<unknown> | undefined;
    if (cancelPending) {
      if (hadPendingUnlock) {
        cancelPromise = Promise.resolve(this.cancel());
      } else {
        this.cancellationVersion += 1;
      }
    }
    this._resetUnlockedSession();
    this._deviceConnectId = undefined;
    this.pendingConnectId = null;
    this._passphraseProtection = undefined;
    this._protocol = undefined;
    this._mainWalletUnlocked = false;
    this._unlockedAttachPin = false;
    if (cancelPromise) {
      return Promise.resolve(cancelPromise).then(() => undefined);
    }
    return undefined;
  }

  private async _readDeviceState(
    connectId: string,
    unlockGuard: OneKeyUnlockGuard | undefined,
    staleFallbackMessage: string,
  ) {
    const assertCurrent = () => {
      if (!unlockGuard) {
        return;
      }
      this._assertSameUnlock(unlockGuard.version, unlockGuard.epoch);
    };
    const rememberedProtocol = this._getRememberedDeviceProtocol(connectId);
    if (rememberedProtocol) {
      this.bridge.setDeviceConnectProtocol?.(connectId, rememberedProtocol);
    }
    let res: Awaited<ReturnType<OneKeyBridgeInterface['getDeviceState']>>;
    try {
      res = await this.bridge.getDeviceState(connectId);
      this._throwStaleSdkFailure(unlockGuard, res, staleFallbackMessage);
      assertCurrent();
    } catch (error) {
      const normalizedError = toError(error);
      if (
        !rememberedProtocol ||
        isCancelledError(normalizedError) ||
        !isProtocolMismatchError(normalizedError)
      ) {
        throw error;
      }
      this._forgetDeviceProtocol(connectId);
      res = await this.bridge.getDeviceState(connectId, {
        forceProtocolDetection: true,
      });
      this._throwStaleSdkFailure(unlockGuard, res, staleFallbackMessage);
      assertCurrent();
    }

    if (
      !res.success &&
      rememberedProtocol &&
      !isCancelledError(res.payload) &&
      isProtocolMismatchError(res.payload)
    ) {
      this._forgetDeviceProtocol(connectId);
      res = await this.bridge.getDeviceState(connectId, {
        forceProtocolDetection: true,
      });
      this._throwStaleSdkFailure(unlockGuard, res, staleFallbackMessage);
      assertCurrent();
    }

    if (res.success) {
      this._rememberDeviceProtocol(connectId, readProtocol(res.payload));
    }

    return res;
  }

  async trySearchDevice(needCancel = false, unlockGuard?: OneKeyUnlockGuard) {
    const assertCurrent = () => {
      if (!unlockGuard) {
        return;
      }
      this._assertSameUnlock(unlockGuard.version, unlockGuard.epoch);
    };
    await this.init();
    assertCurrent();

    let deviceStateRead = false;
    if (this._deviceConnectId) {
      this.pendingConnectId = this._deviceConnectId;
    }
    const devicePromise = this._deviceConnectId
      ? this._readDeviceState(
          this._deviceConnectId,
          unlockGuard,
          'searchDevices failed',
        ).then(async res => {
          if (!res.success) {
            // A BLE reconnect issues a new connect id. The stored one then
            // fails lookup; search once and adopt the device that is here.
            if (!isStaleConnectError(res.payload)) {
              throw sdkError(res.payload, 'searchDevices failed');
            }
            const searched = await this.bridge.searchDevices();
            this._throwStaleSdkFailure(
              unlockGuard,
              searched,
              'searchDevices failed',
            );
            assertCurrent();
            if (!searched.success || searched.payload.length <= 0) {
              throw sdkError(res.payload, 'searchDevices failed');
            }
            const preferred = this.connectId || this._deviceConnectId;
            return (
              searched.payload.find(item => item.connectId === preferred) ||
              searched.payload[0]
            );
          }
          deviceStateRead = true;
          this._passphraseProtection = readPassphraseProtection(res.payload);
          this._protocol = readProtocol(res.payload);
          this._mainWalletUnlocked = readMainWalletUnlocked(res.payload);
          this._unlockedAttachPin =
            res.payload.status?.unlockedAttachPin === true;

          return {
            deviceId: res.payload.identity.deviceId,
            connectId: this._deviceConnectId,
          };
        })
      : this.bridge.searchDevices().then(res => {
          this._throwStaleSdkFailure(unlockGuard, res, 'searchDevices failed');
          assertCurrent();
          if (!res.success) {
            throw sdkError(res.payload, 'searchDevices failed');
          }

          if (res.payload.length <= 0) {
            throw new Error('No OneKey Device found');
          }

          const preferred = this.connectId || this._deviceConnectId;
          return (
            res.payload.find(item => item.connectId === preferred) ||
            res.payload[0]
          );
        });

    return devicePromise.then(async device => {
      assertCurrent();
      if (!device) {
        throw new Error('no device');
      }
      const { connectId } = device;
      let { deviceId } = device;
      if (connectId) {
        // Cancel must hit this id even if the stored one is still the old id.
        this.pendingConnectId = connectId;
      }

      // Passphrase protection is reported by getDeviceState, not by device
      // discovery. Read it even when searchDevices already returned a
      // deviceId, so the V2 standard-wallet decision is never made with an
      // unknown value.
      if (connectId && (!deviceId || !deviceStateRead)) {
        const state = await this._readDeviceState(
          connectId,
          unlockGuard,
          'getDeviceState failed',
        );
        if (!state.success) {
          // A known deviceId is enough to continue; the unlock flow can still
          // fall back to the standard wallet when wallet selection fails.
          if (!deviceId) {
            throw sdkError(state.payload, 'getDeviceState failed');
          }
        } else {
          deviceStateRead = true;
          this._passphraseProtection = readPassphraseProtection(state.payload);
          this._protocol = readProtocol(state.payload);
          this._mainWalletUnlocked = readMainWalletUnlocked(state.payload);
          this._unlockedAttachPin =
            state.payload.status?.unlockedAttachPin === true;
          deviceId = deviceId || state.payload.identity.deviceId;
        }
      }

      if (!deviceId || !connectId) {
        throw new Error('no deviceId or connectId');
      }

      if (connectId !== this._deviceConnectId) {
        this._deviceConnectId = connectId;
      }

      if (needCancel) {
        this.bridge.cancel(connectId);
      }

      return {
        deviceId,
        connectId,
      };
    });
  }

  unlock(): Promise<string> {
    // Reading the device state costs a BLE round trip, and the import list
    // calls this once per address. Skip it while the selected device is the
    // one whose xpub is in memory. A device switch goes through
    // setDeviceConnectId -> cleanUp, which drops the xpub first.
    if (
      !this.unlockPromise &&
      this.isUnlocked() &&
      Boolean(this.deviceId && this.connectId) &&
      this.connectId === this._deviceConnectId
    ) {
      this.pendingWorkCancelled = false;
      return Promise.resolve('already unlocked');
    }
    if (!this.unlockPromise) {
      const promise = this.unlockDevice().finally(() => {
        // A device switch replaces this promise. The old finally must not
        // drop the replacement.
        if (this.unlockPromise === promise) {
          this.unlockPromise = undefined;
        }
      });
      this.unlockPromise = promise;
    }
    return this.unlockPromise;
  }

  /**
   * Open the device wallet and commit xpub only after it is read.
   *
   * A different device, a failed read, or a cancel that lands after the read
   * must not leave the previous device's xpub in place.
   */
  private async unlockDevice(): Promise<string> {
    this.pendingWorkCancelled = false;
    const version = this.cancellationVersion;
    const epoch = this.unlockEpoch;
    const unlockGuard = { version, epoch };
    const checkCancelled = () => {
      this._assertSameUnlock(version, epoch);
    };
    try {
      this._passphraseProtection = undefined;
      this._protocol = undefined;
      this._mainWalletUnlocked = false;
      this._unlockedAttachPin = false;

      const { deviceId, connectId } = await this.trySearchDevice(
        false,
        unlockGuard,
      );
      checkCancelled();

      const sameDeviceIdentity =
        Boolean(this.deviceId && this.connectId) &&
        this.deviceId === deviceId &&
        this.connectId === connectId;
      if (sameDeviceIdentity && this.isUnlocked()) {
        return 'already unlocked';
      }
      if (!sameDeviceIdentity) {
        this._resetUnlockedSession();
        checkCancelled();
      }

      const selectViaGetPassphraseState = async (): Promise<
        string | undefined
      > => {
        // Protocol V1 or bridges without openWalletSession:
        // getPassphraseState() without options always opens wallet
        // selection, and answering it with "passphrase on device" fails
        // with "Passphrase disabled" when the device has passphrase
        // protection off. Select the standard wallet instead.
        let standardWallet = this._passphraseProtection === false;
        let passphraseState = await this.bridge.getPassphraseState(
          connectId,
          standardWallet ? { useEmptyPassphrase: true } : undefined,
        );
        this._throwStaleSdkFailure(
          unlockGuard,
          passphraseState,
          'getPassphraseState failed',
        );
        checkCancelled();
        if (
          !passphraseState.success &&
          !standardWallet &&
          isPassphraseDisabledError(passphraseState.payload)
        ) {
          standardWallet = true;
          passphraseState = await this.bridge.getPassphraseState(connectId, {
            useEmptyPassphrase: true,
          });
          this._throwStaleSdkFailure(
            unlockGuard,
            passphraseState,
            'getPassphraseState failed',
          );
          checkCancelled();
        }
        if (!passphraseState.success) {
          throw sdkError(passphraseState.payload, 'getPassphraseState failed');
        }
        // On V2 the standard-wallet session still returns a wallet id
        // (btc_test_address). Passing it on a passphrase-off device makes
        // the SDK throw DeviceNotOpenedPassphrase (113), so the standard
        // wallet is represented by an empty passphraseState.
        return this._resolvePassphraseStateForImport({
          connectId,
          protocol: this._protocol,
          unlockedAttachPin: this._unlockedAttachPin,
          passphraseState: standardWallet
            ? undefined
            : passphraseState.payload || undefined,
          unlockGuard,
        });
      };

      // Follow Rabby's original flow on every device:
      // getPassphraseState() resumes the wallet the device already has
      // open and otherwise asks for the passphrase on the device. A Pro 2
      // (Protocol V2) uses openWalletSession only where that call cannot:
      // passphrase off (standard wallet), and a locked device or an
      // attach-PIN session (the device must accept any PIN).
      let nextPassphraseState: string | undefined;
      const { openWalletSession } = this.bridge;
      if (
        this._protocol === 'V2' &&
        openWalletSession &&
        (this._passphraseProtection === false || !this._mainWalletUnlocked)
      ) {
        // A standard wallet must not keep any wallet id, otherwise
        // turning passphrase protection off later makes every signature
        // fail with DeviceNotOpenedPassphrase (113) until re-import.
        try {
          const mode =
            this._passphraseProtection === false ? 'standard' : 'select-hidden';
          let session = await openWalletSession(connectId, { mode });
          this._throwStaleSdkFailure(
            unlockGuard,
            session,
            'openWalletSession failed',
          );
          checkCancelled();
          if (
            !session.success &&
            mode === 'select-hidden' &&
            isPassphraseDisabledError(session.payload)
          ) {
            session = await openWalletSession(connectId, {
              mode: 'standard',
            });
            this._throwStaleSdkFailure(
              unlockGuard,
              session,
              'openWalletSession failed',
            );
            checkCancelled();
          }
          if (
            !session.success &&
            isUnsupportedWalletSessionError(session.payload)
          ) {
            nextPassphraseState = await selectViaGetPassphraseState();
          } else if (!session.success) {
            throw sdkError(session.payload, 'openWalletSession failed');
          } else {
            nextPassphraseState = await this._resolvePassphraseStateForImport({
              connectId,
              protocol: this._protocol,
              walletType: session.payload.walletType,
              passphraseState: session.payload.passphraseState,
              unlockGuard,
            });
          }
        } catch (e) {
          if (
            isUnsupportedWalletSessionError(
              e as { code?: unknown; error?: unknown; message?: unknown },
            )
          ) {
            nextPassphraseState = await selectViaGetPassphraseState();
          } else {
            throw e;
          }
        }
      } else {
        nextPassphraseState = await selectViaGetPassphraseState();
      }
      checkCancelled();

      const res = await this.bridge.evmGetPublicKey(connectId, deviceId, {
        showOnOneKey: false,
        chainId: 1,
        path: hdPathString,
        passphraseState: nextPassphraseState,
        useEmptyPassphrase: this._isEmptyPassphrase(nextPassphraseState),
      });
      // A device read that failed keeps its SDK code. 107 and 109 share the
      // text "Device interrupted"; replacing that with "signing cancelled"
      // would make an unplug bump the next nonce. A successful read that is
      // already stale still fails the check below.
      this._throwStaleSdkFailure(unlockGuard, res, 'getPublicKey failed');
      if (!res.success) {
        throw sdkError(res.payload, 'getPublicKey failed');
      }
      checkCancelled();

      const nextHdk = new HDKey();
      nextHdk.publicKey = Buffer.from(res.payload.pub, 'hex');
      nextHdk.chainCode = Buffer.from(res.payload.node.chain_code, 'hex');
      // A cancel that lands after the read must not publish this xpub.
      checkCancelled();
      this.hdk = nextHdk;
      this.passphraseState = nextPassphraseState;
      this.deviceId = deviceId;
      this.connectId = connectId;
      return 'just unlocked';
    } catch (e) {
      throw toError(e);
    } finally {
      if (epoch === this.unlockEpoch) {
        this.pendingConnectId = null;
      }
    }
  }

  setAccountToUnlock(index: string): void {
    this.unlockedAccount = parseInt(index, 10);
  }

  addAccounts(n = 1): Promise<any> {
    return new Promise((resolve, reject) => {
      this.unlock()
        .then(_ => {
          const from = this.unlockedAccount;
          const to = from + n;

          for (let i = from; i < to; i++) {
            const address = this._addressFromIndex(pathBase, i);
            const checksummedAddress = ethUtil.toChecksumAddress(address);
            if (
              this.accounts.some(
                account => account.toLowerCase() === address.toLowerCase(),
              )
            ) {
              // importFirstAddress relies on this error to switch to the
              // "import more addresses" flow for an already imported device.
              throw new Error("The address you're trying to import is invalid");
            }
            this.accounts.push(address);
            this.paths[checksummedAddress] = i;
            this.accountDetails[checksummedAddress] = {
              hdPath: `${this.hdPath}/${i}`,
              hdPathType: LedgerHDPathType.BIP44,
              hdPathBasePublicKey: this.getPathBasePublicKey(),
              index: i,
              connectId: this._deviceConnectId,
            };
            this.page = 0;
          }
          resolve(this.accounts);
        })
        .catch(e => {
          reject(e);
        });
    });
  }

  getFirstPage(): Promise<any> {
    this.page = 0;
    return this.__getPage(1);
  }

  getNextPage(): Promise<any> {
    return this.__getPage(1);
  }

  getPreviousPage(): Promise<any> {
    return this.__getPage(-1);
  }

  getAddresses(start: number, end: number): Promise<any> {
    return new Promise((resolve, reject) => {
      this.unlock()
        .then(_ => {
          const from = start;
          const to = end;

          const accounts: any[] = [];

          for (let i = from; i < to; i++) {
            const address = this._addressFromIndex(pathBase, i);
            accounts.push({
              address,
              balance: null,
              index: i + 1,
            });
            this.paths[ethUtil.toChecksumAddress(address)] = i;
          }
          resolve(accounts);
        })
        .catch(e => {
          reject(e);
        });
    });
  }

  __getPage(increment: number): Promise<any> {
    this.page += increment;

    if (this.page <= 0) {
      this.page = 1;
    }

    return new Promise((resolve, reject) => {
      this.unlock()
        .then(_ => {
          const from = (this.page - 1) * this.perPage;
          const to = from + this.perPage;

          const accounts: any[] = [];

          for (let i = from; i < to; i++) {
            const address = this._addressFromIndex(pathBase, i);
            accounts.push({
              address,
              balance: null,
              index: i + 1,
            });
            this.paths[ethUtil.toChecksumAddress(address)] = i;
          }
          resolve(accounts);
        })
        .catch(e => {
          reject(e);
        });
    });
  }

  getAccounts(): Promise<string[]> {
    return Promise.resolve(this.accounts.slice());
  }

  removeAccount(address: string): void {
    if (
      !this.accounts.map(a => a.toLowerCase()).includes(address.toLowerCase())
    ) {
      throw new Error(`Address ${address} not found in this keyring`);
    }
    this.accounts = this.accounts.filter(
      a => a.toLowerCase() !== address.toLowerCase(),
    );
    const checksummedAddress = ethUtil.toChecksumAddress(address);
    delete this.accountDetails[checksummedAddress];
    delete this.paths[checksummedAddress];
  }

  // tx is an instance of the ethereumjs-transaction class.
  signTransaction(address: string, tx: any): Promise<any> {
    const cancellationVersion = this._beginSigning();
    return new Promise((resolve, reject) => {
      this.unlock()
        .then(status => {
          setTimeout(
            (_: any) => {
              if (cancellationVersion !== this.cancellationVersion) {
                reject(new Error('OneKey signing cancelled'));
                return;
              }
              if (isOldStyleEthereumjsTx(tx)) {
                // In this version of ethereumjs-tx we must add the chainId in hex format
                // to the initial v value. The chainId must be included in the serialized
                // transaction which is only communicated to ethereumjs-tx in this
                // value. In newer versions the chainId is communicated via the 'Common'
                // object.
                // eslint-disable-next-line @typescript-eslint/no-floating-promises
                this._signTransaction(
                  address,
                  tx.getChainId(),
                  tx,
                  (payload: { v: string; r: string; s: string }) => {
                    tx.v = Buffer.from(payload.v, 'hex');
                    tx.r = Buffer.from(payload.r, 'hex');
                    tx.s = Buffer.from(payload.s, 'hex');
                    return tx;
                  },
                  cancellationVersion,
                )
                  .then(resolve)
                  .catch(e => reject(toError(e)));
              } else {
                // eslint-disable-next-line @typescript-eslint/no-floating-promises
                this._signTransaction(
                  address,
                  Number(tx.common.chainId()),
                  tx,
                  (payload: { v: string; r: string; s: string }) => {
                    // Because tx will be immutable, first get a plain javascript object that
                    // represents the transaction. Using txData here as it aligns with the
                    // nomenclature of ethereumjs/tx.
                    const txData = tx.toJSON();
                    // The fromTxData utility expects a type to support transactions with a type other than 0
                    txData.type = tx.type;
                    // The fromTxData utility expects v,r and s to be hex prefixed
                    txData.v = ethUtil.addHexPrefix(payload.v);
                    txData.r = ethUtil.addHexPrefix(payload.r);
                    txData.s = ethUtil.addHexPrefix(payload.s);
                    // Adopt the 'common' option from the original transaction and set the
                    // returned object to be frozen if the original is frozen.
                    return TransactionFactory.fromTxData(txData, {
                      common: tx.common,
                      freeze: Object.isFrozen(tx),
                    });
                  },
                  cancellationVersion,
                )
                  .then(resolve)
                  .catch(e => reject(toError(e)));
              }
              // This is necessary to avoid popup collision
              // between the unlock & sign trezor popups
            },
            status === 'just unlocked' ? DELAY_BETWEEN_POPUPS : 0,
          );
        })
        .catch(e => {
          reject(toError(e));
        });
    }).finally(() => {
      this._endSigning();
    });
  }

  async _signTransaction(
    address: string,
    chainId: number,
    tx: any,
    handleSigning: any,
    cancellationVersion?: number,
  ) {
    let transaction: EVMTransaction | EVMTransactionEIP1559;
    if (isOldStyleEthereumjsTx(tx)) {
      // legacy transaction from ethereumjs-tx package has no .toJSON() function,
      // so we need to convert to hex-strings manually manually
      transaction = {
        to: this._normalize(tx.to),
        value: this._normalize(tx.value),
        data: this._normalize(tx.data),
        chainId,
        nonce: this._normalize(tx.nonce),
        gasLimit: this._normalize(tx.gasLimit),
        gasPrice: this._normalize(tx.gasPrice),
      };
    } else {
      // new-style transaction from @ethereumjs/tx package
      // we can just copy tx.toJSON() for everything except chainId, which must be a number
      transaction = {
        ...tx.toJSON(),
        chainId,
      };
    }
    return this._withPassphraseRecovery(
      address,
      {
        passphraseState: this.passphraseState,
        useEmptyPassphrase: this._isEmptyPassphrase(this.passphraseState),
      },
      params =>
        this.bridge.evmSignTransaction(this.connectId!, this.deviceId!, {
          path: this._pathFromAddress(address),
          transaction,
          ...params,
        }),
      cancellationVersion,
    ).then(res => {
      if (
        cancellationVersion !== undefined &&
        cancellationVersion !== this.cancellationVersion
      ) {
        throw new Error('OneKey signing cancelled');
      }
      if (res.success) {
        const newOrMutatedTx = handleSigning(res.payload);
        const addressSignedWith = ethUtil.toChecksumAddress(
          ethUtil.addHexPrefix(
            newOrMutatedTx.getSenderAddress().toString('hex'),
          ),
        );
        const correctAddress = ethUtil.toChecksumAddress(address);
        if (addressSignedWith !== correctAddress) {
          throw new Error('signature doesnt match the right address');
        }

        return newOrMutatedTx;
      }
      throw sdkError(res.payload, 'Unknown error');
    });
  }

  signMessage(withAccount: string, data: string): Promise<any> {
    return this.signPersonalMessage(withAccount, data);
  }

  // For personal_sign, we need to prefix the message:
  signPersonalMessage(withAccount: string, message: string): Promise<any> {
    const messageHex = ethUtil.stripHexPrefix(message);
    const cancellationVersion = this._beginSigning();
    return new Promise((resolve, reject) => {
      this.unlock()
        .then(status => {
          setTimeout(
            (_: any) => {
              if (cancellationVersion !== this.cancellationVersion) {
                reject(new Error('OneKey signing cancelled'));
                return;
              }
              this._withPassphraseRecovery(
                withAccount,
                {
                  passphraseState: this.passphraseState,
                  useEmptyPassphrase: this._isEmptyPassphrase(
                    this.passphraseState,
                  ),
                },
                params =>
                  this.bridge.evmSignMessage(this.connectId!, this.deviceId!, {
                    path: this._pathFromAddress(withAccount),
                    messageHex,
                    ...params,
                  }),
                cancellationVersion,
              )
                .then(response => {
                  if (cancellationVersion !== this.cancellationVersion) {
                    reject(new Error('OneKey signing cancelled'));
                    return;
                  }
                  if (response.success) {
                    if (!isSameAddress(response.payload.address, withAccount)) {
                      reject(
                        new Error('signature doesnt match the right address'),
                      );
                      return;
                    }
                    const signature = `0x${response.payload.signature}`;
                    const addressSignedWith = sigUtil.recoverPersonalSignature({
                      data: ethUtil.addHexPrefix(messageHex),
                      sig: signature,
                    });
                    if (!isSameAddress(addressSignedWith, withAccount)) {
                      reject(
                        new Error('signature doesnt match the right address'),
                      );
                      return;
                    }
                    // eslint-disable-next-line promise/no-multiple-resolved
                    resolve(signature);
                  } else {
                    reject(sdkError(response.payload, 'Unknown error'));
                  }
                })
                .catch(e => {
                  console.log('Error while trying to sign a message ', e);
                  reject(toError(e));
                });
              // This is necessary to avoid popup collision
              // between the unlock & sign trezor popups
            },
            status === 'just unlocked' ? DELAY_BETWEEN_POPUPS : 0,
          );
        })
        .catch(e => {
          console.log('Error while trying to sign a message ', e);
          reject(toError(e));
        });
    }).finally(() => {
      this._endSigning();
    });
  }

  async signTypedData(address: string, data: any, opts: any) {
    switch (opts.version) {
      case 'V1':
        return this.signTypedData_v1(address, data, opts);
      case 'V3':
        return this.signTypedData_v3_v4(address, data, opts);
      case 'V4':
        return this.signTypedData_v3_v4(address, data, opts);
      default:
        return this.signTypedData_v1(address, data, opts);
    }
  }

  signTypedData_v1(_address: string, _typedData: any, _opts = {}) {
    // Waiting on trezor to enable this
    throw new Error('Not supported on this device');
  }

  // personal_signTypedData, signs data along with the schema
  signTypedData_v3_v4(
    address: string,
    typedData: any,
    opts: { version?: 'V3' | 'V4' } = {},
  ) {
    const cancellationVersion = this._beginSigning();
    return new Promise((resolve, reject) => {
      const isV4 = opts.version === 'V4';
      let domain: Record<string, any>;
      let domainSeparatorHex: string;
      let hashStructMessageHex: string;

      try {
        const {
          domain: sanitizedDomain,
          types,
          primaryType,
          message,
        } = sigUtil.TypedDataUtils.sanitizeData(typedData);

        domain = sanitizedDomain;
        domainSeparatorHex = sigUtil.TypedDataUtils.hashStruct(
          'EIP712Domain',
          domain,
          types,
          isV4,
        ).toString('hex');
        hashStructMessageHex = sigUtil.TypedDataUtils.hashStruct(
          primaryType as string,
          message,
          types,
          isV4,
        ).toString('hex');
      } catch (error) {
        reject(normalizeTypedDataHashError(error));
        return;
      }

      this.unlock()
        .then(status => {
          setTimeout(
            (_: any) => {
              if (cancellationVersion !== this.cancellationVersion) {
                reject(new Error('OneKey signing cancelled'));
                return;
              }
              try {
                this._withPassphraseRecovery(
                  address,
                  {
                    passphraseState: this.passphraseState,
                    useEmptyPassphrase: this._isEmptyPassphrase(
                      this.passphraseState,
                    ),
                  },
                  params =>
                    this.bridge.evmSignTypedData(
                      this.connectId!,
                      this.deviceId!,
                      {
                        path: this._pathFromAddress(address),
                        data: typedData,
                        metamaskV4Compat: isV4,
                        domainHash: domainSeparatorHex,
                        messageHash: hashStructMessageHex,
                        chainId: domain.chainId
                          ? Number(domain.chainId)
                          : undefined,
                        ...params,
                      },
                    ),
                  cancellationVersion,
                )
                  .then(response => {
                    if (cancellationVersion !== this.cancellationVersion) {
                      reject(new Error('OneKey signing cancelled'));
                      return;
                    }
                    if (response.success) {
                      const signature = ethUtil.addHexPrefix(
                        response.payload.signature,
                      );
                      const addressSignedWith = isV4
                        ? sigUtil.recoverTypedSignature_v4({
                            data: typedData,
                            sig: signature,
                          })
                        : sigUtil.recoverTypedSignature({
                            data: typedData,
                            sig: signature,
                          });

                      if (!isSameAddress(addressSignedWith, address)) {
                        reject(
                          new Error('signature doesnt match the right address'),
                        );
                        return;
                      }
                      resolve(signature);
                    } else {
                      let code =
                        (response.payload && response.payload.code) || '';
                      // eslint-disable-next-line @typescript-eslint/no-shadow
                      const message =
                        (response.payload && response.payload.error) || '';
                      let errorMsg =
                        (response.payload && response.payload.error) ||
                        'Unknown error';

                      let errorUrl = '';
                      if (message.includes('EIP712Domain')) {
                        code = 'EIP712_DOMAIN_NOT_SUPPORT';
                      } else if (message.includes('EIP712')) {
                        code = 'EIP712_BLIND_SIGN_DISABLED';
                        // eslint-disable-next-line @typescript-eslint/no-unused-vars
                        errorUrl =
                          'https://help.onekey.so/hc/zh-cn/articles/4406637762959';
                      }
                      if (code === 'Failure_UnexpectedMessage') {
                        code = 'EIP712_FIRMWARE_NOT_SUPPORT';
                        errorMsg = 'Not supported on this device';
                      }

                      const error = sdkError(response.payload, 'Unknown error');
                      if (
                        typeof code === 'string' &&
                        code.startsWith('EIP712_')
                      ) {
                        error.message = JSON.stringify({ code, errorMsg });
                      }
                      reject(error);
                    }
                  })
                  .catch(e => {
                    console.log('Error while trying to sign a message ', e);
                    reject(toError(e));
                  });
              } catch (e: any) {
                reject(toError(e));
              }
              // This is necessary to avoid popup collision
              // between the unlock & sign trezor popups
            },
            status === 'just unlocked' ? DELAY_BETWEEN_POPUPS : 0,
          );
        })
        .catch(e => {
          console.log('Error while trying to sign a message ', e);
          reject(toError(e));
        });
    }).finally(() => {
      this._endSigning();
    });
  }

  exportAccount(): Promise<any> {
    return Promise.reject(new Error('Not supported on this device'));
  }

  forgetDevice(): void {
    this.accounts = [];
    this.accountDetails = {};
    this.passphraseState = undefined;
    this.passphraseStateCleared = false;
    this.pendingConnectId = null;
    this.deviceId = null;
    this.connectId = null;
    this._deviceConnectId = undefined;
    this.hdk = new HDKey();
    this.page = 0;
    this.unlockedAccount = 0;
    this.paths = {};
  }

  /* PRIVATE METHODS */

  /**
   * Retry a signing call once without a stale hidden-wallet session when the
   * device reports that passphrase protection is off.
   *
   * The stale state is only dropped when the standard wallet owns the
   * account. A genuinely hidden wallet keeps its session and surfaces the
   * original device error unchanged.
   *
   * @param address - The account being signed with.
   * @param params - The passphrase parameters used for the first call.
   * @param call - The device call to perform.
   * @param cancellationVersion - Version captured when signing started. A
   * change means lock or cancel landed and the recovery must not retry.
   * @returns The first response, or the retried response.
   */
  private async _withPassphraseRecovery<T>(
    address: string,
    params: PassphraseParams,
    call: (params: PassphraseParams) => OneKeyResponse<T>,
    cancellationVersion?: number,
  ): Promise<Awaited<OneKeyResponse<T>>> {
    const cancelled = () =>
      cancellationVersion !== undefined &&
      cancellationVersion !== this.cancellationVersion;
    const response = await call(params);

    if (
      cancelled() ||
      response.success ||
      this._isEmptyPassphrase(params.passphraseState) ||
      isCancelledError(response.payload) ||
      !isPassphraseDisabledError(response.payload)
    ) {
      return response;
    }

    const { connectId, deviceId } = this;
    if (!connectId || !deviceId) {
      return response;
    }

    try {
      const publicKey = await this.bridge.evmGetPublicKey(connectId, deviceId, {
        path: this._pathFromAddress(address),
        showOnOneKey: false,
        chainId: 1,
        useEmptyPassphrase: true,
      });
      if (cancelled() || !publicKey.success) {
        return response;
      }

      const derivedAddress = ethUtil.toChecksumAddress(
        ethUtil.bufferToHex(
          ethUtil.publicToAddress(
            Buffer.from(publicKey.payload.pub, 'hex'),
            true,
          ),
        ),
      );
      if (!isSameAddress(derivedAddress, address)) {
        return response;
      }

      // The account belongs to the standard wallet. Drop the stale hidden
      // wallet id, including one stored on the account, and sign once more
      // without it. The xpub was read for that hidden wallet, so it cannot
      // stay in memory either.
      const checksummedAddress = ethUtil.toChecksumAddress(address);
      const detail = this.accountDetails[checksummedAddress];
      if (detail && detail.passphraseState !== undefined) {
        delete detail.passphraseState;
        this.passphraseStateCleared = true;
      }
      this.passphraseState = undefined;
      this.hdk = new HDKey();
      if (cancelled()) {
        return response;
      }

      return await call({
        passphraseState: undefined,
        useEmptyPassphrase: true,
      });
    } catch (e) {
      console.log('Error while recovering the standard wallet session', e);
      return response;
    }
  }

  /**
   * SDK 1.2.7 `openWalletSession({ mode: 'select-hidden' })` still reports
   * walletType "hidden" when the user enters an empty passphrase on a Pro 2,
   * and the passphraseState is the standard wallet's btc_test_address. Compare
   * that identity with a useEmptyPassphrase probe and, if they match, treat the
   * session as the standard wallet so the id is never persisted. The probe runs
   * only for an ambiguous V2 session (hidden type + non-empty state). Skip
   * attach-PIN sessions because the probe would prompt for the Main PIN. After
   * opening a new session, refresh the status instead of trusting the
   * pre-session flag. Only the legacy getPassphraseState resume path may use
   * that flag to skip the refresh and probe. A failed probe keeps the hidden id
   * so import can proceed, unless cancelled.
   *
   * @param options0 - The imported wallet session.
   * @param options0.connectId - Device connect id used for the identity probe.
   * @param options0.protocol - Hardware protocol reported by getDeviceState.
   * @param options0.unlockedAttachPin - Pre-session attach-PIN flag; only pass
   * it when resuming via getPassphraseState without opening a new session.
   * @param options0.walletType - Wallet type reported by openWalletSession.
   * @param options0.passphraseState - Wallet identity returned by the SDK.
   * @param options0.unlockGuard - Unlock generation. Checked after each await
   * so a cancel cannot start another device call.
   * @returns The hidden wallet id, or undefined for the standard wallet.
   */
  private async _resolvePassphraseStateForImport({
    connectId,
    protocol,
    unlockedAttachPin,
    walletType,
    passphraseState,
    unlockGuard,
  }: {
    connectId: string;
    protocol?: string;
    unlockedAttachPin?: boolean;
    walletType?: 'standard' | 'hidden';
    passphraseState?: string | null;
    unlockGuard: OneKeyUnlockGuard;
  }): Promise<string | undefined> {
    const assertCurrent = () => {
      this._assertSameUnlock(unlockGuard.version, unlockGuard.epoch);
    };
    if (walletType === 'standard') {
      return undefined;
    }
    const imported = passphraseState || undefined;
    if (this._isEmptyPassphrase(imported)) {
      return undefined;
    }
    if (protocol !== 'V2' || unlockedAttachPin === true) {
      return imported;
    }
    try {
      const state = await this.bridge.getDeviceState(connectId);
      this._throwStaleSdkFailure(unlockGuard, state, 'getDeviceState failed');
      assertCurrent();
      if (!state.success && isCancelledError(state.payload)) {
        throw sdkError(state.payload, 'getDeviceState cancelled');
      }
      if (state.success && state.payload.status?.unlockedAttachPin === true) {
        return imported;
      }
    } catch (e) {
      const error = toError(e);
      const { code } = error as { code?: unknown };
      if (code !== undefined) {
        this._throwStaleSdkFailure(
          unlockGuard,
          { success: false, payload: { error: error.message, code } },
          error.message,
        );
      }
      assertCurrent();
      if (isCancelledError(error)) {
        throw error;
      }
      // On non-cancel refresh failures, still try the probe as before.
      console.log('failed to refresh OneKey attach-PIN status', e);
    }
    assertCurrent();
    const standardIdentity = await this._getStandardWalletIdentity(
      connectId,
      unlockGuard,
    );
    assertCurrent();
    if (standardIdentity && standardIdentity === imported) {
      return undefined;
    }
    return imported;
  }

  private async _getStandardWalletIdentity(
    connectId: string,
    unlockGuard: OneKeyUnlockGuard,
  ): Promise<string | undefined> {
    const assertCurrent = () => {
      this._assertSameUnlock(unlockGuard.version, unlockGuard.epoch);
    };
    try {
      assertCurrent();
      const result = await this.bridge.getPassphraseState(connectId, {
        useEmptyPassphrase: true,
      });
      if (result) {
        this._throwStaleSdkFailure(
          unlockGuard,
          result,
          'getPassphraseState cancelled',
        );
      }
      assertCurrent();
      if (result && !result.success && isCancelledError(result.payload)) {
        throw sdkError(result.payload, 'getPassphraseState cancelled');
      }
      if (
        result?.success &&
        typeof result.payload === 'string' &&
        result.payload
      ) {
        return result.payload;
      }
    } catch (e) {
      const error = toError(e);
      const { code } = error as { code?: unknown };
      if (code !== undefined) {
        this._throwStaleSdkFailure(
          unlockGuard,
          { success: false, payload: { error: error.message, code } },
          error.message,
        );
      }
      assertCurrent();
      if (isCancelledError(error)) {
        throw error;
      }
      console.log('failed to read OneKey standard wallet identity', e);
    }
    return undefined;
  }

  _isEmptyPassphrase(passphraseState: string | undefined | null): boolean {
    return (
      passphraseState === null ||
      passphraseState === undefined ||
      passphraseState === ''
    );
  }

  _normalize(buf: Buffer): string {
    return ethUtil.bufferToHex(buf).toString();
  }

  // eslint-disable-next-line no-shadow, @typescript-eslint/no-shadow
  _addressFromIndex(pathBase: string, i: number): string {
    const dkey = this.hdk.derive(`${pathBase}/${i}`);
    const address = ethUtil
      .publicToAddress(dkey.publicKey, true)
      .toString('hex');
    return ethUtil.toChecksumAddress(`0x${address}`);
  }

  _pathFromAddress(address: string): string {
    return `${this.hdPath}/${this.indexFromAddress(address)}`;
  }

  indexFromAddress(address: string) {
    const checksummedAddress = ethUtil.toChecksumAddress(address);
    let index =
      this.paths[checksummedAddress] ??
      this.accountDetails[checksummedAddress]?.index;

    if (typeof index === 'undefined') {
      for (let i = 0; i < MAX_INDEX; i++) {
        if (checksummedAddress === this._addressFromIndex(pathBase, i)) {
          index = i;
          break;
        }
      }
    }

    if (typeof index === 'undefined') {
      throw new Error('Unknown address');
    }
    return index;
  }

  async getCurrentAccounts() {
    await this.unlock();
    const addresses = await this.getAccounts();
    const currentPublicKey = this.getPathBasePublicKey();
    const accounts: Account[] = [];

    // eslint-disable-next-line @typescript-eslint/prefer-for-of
    for (let i = 0; i < addresses.length; i++) {
      const address = addresses[i];
      await this._fixAccountDetail(address);

      const detail = this.accountDetails[ethUtil.toChecksumAddress(address)];

      if (detail?.hdPathBasePublicKey !== currentPublicKey) {
        continue;
      }

      try {
        const account = {
          address,
          index: this.indexFromAddress(address) + 1,
        };
        accounts.push(account);
      } catch (e) {
        console.log('address not found', address);
      }
    }

    return accounts;
  }

  private getPathBasePublicKey() {
    return this.hdk.publicKey.toString('hex');
  }

  private async _fixAccountDetail(address: string) {
    const checksummedAddress = ethUtil.toChecksumAddress(address);
    const detail = this.accountDetails[checksummedAddress];

    // The detail is already fixed
    if (detail?.hdPathBasePublicKey && detail.hdPath) {
      return;
    }

    let addressInDevice;
    let index;

    try {
      index = this.indexFromAddress(address);
      addressInDevice = this._addressFromIndex(pathBase, index);
    } catch (e) {
      console.log('address not found', address);
    }

    if (!addressInDevice || !isSameAddress(address, addressInDevice)) {
      return;
    }

    this.accountDetails[checksummedAddress] = {
      ...detail,
      index: index as any,
      hdPath: this._pathFromAddress(address),
      hdPathType: LedgerHDPathType.BIP44,
      hdPathBasePublicKey: this.getPathBasePublicKey(),
      connectId: this._deviceConnectId,
    };
  }

  getAccountInfo(address: string) {
    const detail = this.accountDetails[ethUtil.toChecksumAddress(address)];
    if (detail) {
      const { index, hdPathType, hdPathBasePublicKey, connectId } = detail;
      return {
        address,
        index: index + 1,
        balance: null,
        hdPathType,
        hdPathBasePublicKey,
        connectId,
      };
    }
    return undefined;
  }

  fixConnectId(address: string, connectId: string) {
    const checksummedAddress = ethUtil.toChecksumAddress(address);
    const detail = this.accountDetails[checksummedAddress];
    if (!detail) {
      return;
    }

    if (detail.connectId !== connectId) {
      this.accountDetails[checksummedAddress] = {
        ...detail,
        connectId,
      };
    }
  }
}

export default OneKeyKeyring;
/* eslint-enable promise/no-multiple-resolved */
/* eslint-enable jsdoc/require-param-description */
/* eslint-enable @typescript-eslint/no-non-null-assertion */
/* eslint-enable prefer-promise-reject-errors */
