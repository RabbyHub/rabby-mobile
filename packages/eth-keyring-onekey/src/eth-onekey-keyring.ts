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
    code?: unknown;
    errorCode?: unknown;
  } | null;
  const message = payload?.message;
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

  accountDetails: Record<string, AccountDetail>;

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

  init() {
    return this.bridge.init();
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
    });
  }

  deserialize(opts: any = {}): Promise<void> {
    this.hdPath = opts.hdPath || hdPathString;
    this.accounts = opts.accounts || [];
    this.page = opts.page || 0;
    this.perPage = 5;
    this.paths = opts.paths || {};
    this.accountDetails = opts.accountDetails || {};
    return Promise.resolve();
  }

  isUnlocked(): boolean {
    return Boolean(this.hdk && this.hdk.publicKey);
  }

  cleanUp() {
    this.hdk = new HDKey();
  }

  async trySearchDevice(needCancel = false) {
    await this.init();

    let deviceStateRead = false;
    const devicePromise = this._deviceConnectId
      ? this.bridge.getDeviceState(this._deviceConnectId).then(res => {
          if (!res.success) {
            throw sdkError(res.payload, 'searchDevices failed');
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
          if (!res.success) {
            throw sdkError(res.payload, 'searchDevices failed');
          }

          if (res.payload.length <= 0) {
            throw new Error('No OneKey Device found');
          }

          return res.payload[0];
        });

    return devicePromise.then(async device => {
      if (!device) {
        throw new Error('no device');
      }
      const { connectId } = device;
      let { deviceId } = device;

      // Passphrase protection is reported by getDeviceState, not by device
      // discovery. Read it even when searchDevices already returned a
      // deviceId, so the V2 standard-wallet decision is never made with an
      // unknown value.
      if (connectId && (!deviceId || !deviceStateRead)) {
        const state = await this.bridge.getDeviceState(connectId);
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
    if (this.isUnlocked()) {
      return Promise.resolve('already unlocked');
    }
    return new Promise((resolve, rejectRaw) => {
      // Reject with real Errors so callers/UI get a readable message
      // instead of a bare string or `{}`.
      const reject = (e: unknown) => {
        rejectRaw(toError(e));
      };
      this._passphraseProtection = undefined;
      this._protocol = undefined;
      this._mainWalletUnlocked = false;
      this._unlockedAttachPin = false;
      this.trySearchDevice()
        .then(async ({ deviceId, connectId }) => {
          if (
            this.deviceId &&
            this.connectId &&
            this.isUnlocked() &&
            this.deviceId === deviceId &&
            this.connectId === connectId
          ) {
            resolve('already unlocked');
            return;
          }
          this.deviceId = deviceId;
          this.connectId = connectId;

          const selectViaGetPassphraseState = async (): Promise<boolean> => {
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
            if (
              !passphraseState.success &&
              !standardWallet &&
              isPassphraseDisabledError(passphraseState.payload)
            ) {
              standardWallet = true;
              passphraseState = await this.bridge.getPassphraseState(
                connectId,
                {
                  useEmptyPassphrase: true,
                },
              );
            }
            if (!passphraseState.success) {
              reject(
                sdkError(passphraseState.payload, 'getPassphraseState failed'),
              );
              return false;
            }
            // On V2 the standard-wallet session still returns a wallet id
            // (btc_test_address). Passing it on a passphrase-off device makes
            // the SDK throw DeviceNotOpenedPassphrase (113), so the standard
            // wallet is represented by an empty passphraseState.
            this.passphraseState = await this._resolvePassphraseStateForImport({
              connectId,
              protocol: this._protocol,
              unlockedAttachPin: this._unlockedAttachPin,
              passphraseState: standardWallet
                ? undefined
                : passphraseState.payload || undefined,
            });
            return true;
          };

          // Follow Rabby's original flow on every device:
          // getPassphraseState() resumes the wallet the device already has
          // open and otherwise asks for the passphrase on the device. A Pro 2
          // (Protocol V2) uses openWalletSession only where that call cannot:
          // passphrase off (standard wallet), and a locked device or an
          // attach-PIN session (the device must accept any PIN).
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
                this._passphraseProtection === false
                  ? 'standard'
                  : 'select-hidden';
              let session = await openWalletSession(connectId, { mode });
              if (
                !session.success &&
                mode === 'select-hidden' &&
                isPassphraseDisabledError(session.payload)
              ) {
                session = await openWalletSession(connectId, {
                  mode: 'standard',
                });
              }
              if (
                !session.success &&
                isUnsupportedWalletSessionError(session.payload)
              ) {
                if (!(await selectViaGetPassphraseState())) {
                  return;
                }
              } else if (!session.success) {
                reject(sdkError(session.payload, 'openWalletSession failed'));
                return;
              } else {
                this.passphraseState =
                  await this._resolvePassphraseStateForImport({
                    connectId,
                    protocol: this._protocol,
                    unlockedAttachPin: this._unlockedAttachPin,
                    walletType: session.payload.walletType,
                    passphraseState: session.payload.passphraseState,
                  });
              }
            } catch (e) {
              if (
                isUnsupportedWalletSessionError(
                  e as { code?: unknown; error?: unknown; message?: unknown },
                )
              ) {
                if (!(await selectViaGetPassphraseState())) {
                  return;
                }
              } else {
                reject(e);
                return;
              }
            }
          } else if (!(await selectViaGetPassphraseState())) {
            return;
          }

          await this.bridge
            .evmGetPublicKey(connectId, deviceId, {
              showOnOneKey: false,
              chainId: 1,
              path: hdPathString,
              passphraseState: this.passphraseState,
              useEmptyPassphrase: this._isEmptyPassphrase(this.passphraseState),
            })
            .then(res => {
              if (res.success) {
                this.hdk.publicKey = Buffer.from(res.payload.pub, 'hex');
                this.hdk.chainCode = Buffer.from(
                  res.payload.node.chain_code,
                  'hex',
                );
                resolve('just unlocked');
              } else {
                reject(sdkError(res.payload, 'getPublicKey failed'));
              }
            });
        })
        .catch(e => {
          reject(toError(e));
        });
    });
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
            if (!this.accounts.includes(address)) {
              this.accounts.push(address);
              this.accountDetails[ethUtil.toChecksumAddress(address)] = {
                hdPath: this._pathFromAddress(address),
                hdPathType: LedgerHDPathType.BIP44,
                hdPathBasePublicKey: this.getPathBasePublicKey(),
                index: i,
                connectId: this._deviceConnectId,
              };
            } else {
              throw new Error("The address you're trying to import is invalid");
            }
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
    return new Promise((resolve, reject) => {
      this.unlock()
        .then(status => {
          setTimeout(
            (_: any) => {
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
                )
                  .then(resolve)
                  .catch(reject);
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
                )
                  .then(resolve)
                  .catch(reject);
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
    });
  }

  async _signTransaction(
    address: string,
    chainId: number,
    tx: any,
    handleSigning: any,
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
    ).then(res => {
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
    return new Promise((resolve, reject) => {
      this.unlock()
        .then(status => {
          setTimeout(
            (_: any) => {
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
              )
                .then(response => {
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
                )
                  .then(response => {
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
    });
  }

  exportAccount(): Promise<any> {
    return Promise.reject(new Error('Not supported on this device'));
  }

  forgetDevice(): void {
    this.accounts = [];
    this.accountDetails = {};
    this.passphraseState = undefined;
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
   * @returns The first response, or the retried response.
   */
  private async _withPassphraseRecovery<T>(
    address: string,
    params: PassphraseParams,
    call: (params: PassphraseParams) => OneKeyResponse<T>,
  ): Promise<Awaited<OneKeyResponse<T>>> {
    const response = await call(params);

    if (
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
      if (!publicKey.success) {
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

      // The account belongs to the standard wallet: drop the stale hidden
      // wallet session and sign once more without a passphrase state.
      this.passphraseState = undefined;

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
   * attach-PIN sessions because the probe would prompt for the Main PIN. A
   * failed probe keeps the hidden id so import can proceed, unless cancelled.
   *
   * @param options0 - The imported wallet session.
   * @param options0.connectId - Device connect id used for the identity probe.
   * @param options0.protocol - Hardware protocol reported by getDeviceState.
   * @param options0.unlockedAttachPin - Whether an attach PIN unlocked the device.
   * @param options0.walletType - Wallet type reported by openWalletSession.
   * @param options0.passphraseState - Wallet identity returned by the SDK.
   * @returns The hidden wallet id, or undefined for the standard wallet.
   */
  private async _resolvePassphraseStateForImport({
    connectId,
    protocol,
    unlockedAttachPin,
    walletType,
    passphraseState,
  }: {
    connectId: string;
    protocol?: string;
    unlockedAttachPin?: boolean;
    walletType?: 'standard' | 'hidden';
    passphraseState?: string | null;
  }): Promise<string | undefined> {
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
      if (!state.success && isCancelledError(state.payload)) {
        throw sdkError(state.payload, 'getDeviceState cancelled');
      }
      if (state.success && state.payload.status?.unlockedAttachPin === true) {
        return imported;
      }
    } catch (e) {
      const error = toError(e);
      if (isCancelledError(error)) {
        throw error;
      }
      // On non-cancel refresh failures, still try the probe as before.
      console.log('failed to refresh OneKey attach-PIN status', e);
    }
    const standardIdentity = await this._getStandardWalletIdentity(connectId);
    if (standardIdentity && standardIdentity === imported) {
      return undefined;
    }
    return imported;
  }

  private async _getStandardWalletIdentity(
    connectId: string,
  ): Promise<string | undefined> {
    try {
      const result = await this.bridge.getPassphraseState(connectId, {
        useEmptyPassphrase: true,
      });
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
      this.paths[checksummedAddress] ||
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
