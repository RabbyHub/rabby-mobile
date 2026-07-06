/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type { TypedTransaction } from '@ethereumjs/tx';
import {
  TransactionFactory,
  FeeMarketEIP1559Transaction,
} from '@ethereumjs/tx';
import { addressUtils } from '@rabby-wallet/base-utils';
import { eventBus as keyringEventBus } from '@rabby-wallet/keyring-utils';
import * as sigUtil from 'eth-sig-util';
import * as ethUtil from 'ethereumjs-util';

import { is1559Tx, LedgerHDPathType } from './utils';

import HDPathType = LedgerHDPathType;

const { isSameAddress } = addressUtils;

const type = 'Ledger Hardware';

const HD_PATH_BASE = {
  [HDPathType.BIP44]: "m/44'/60'/0'/0",
  [HDPathType.Legacy]: "m/44'/60'/0'",
  [HDPathType.LedgerLive]: "m/44'/60'/0'/0/0",
};

const HD_PATH_TYPE = {
  [HD_PATH_BASE.Legacy]: HDPathType.Legacy,
  [HD_PATH_BASE.BIP44]: HDPathType.BIP44,
  [HD_PATH_BASE.LedgerLive]: HDPathType.LedgerLive,
};

type Account = {
  address: string;
  balance: number | null;
  index: number;
};

type AccountDetail = {
  hdPath: string;
  hdPathBasePublicKey?: string;
  hdPathType?: HDPathType;
  deviceId?: string;
};

type LedgerAddress = {
  address: string;
  publicKey: string;
  chainCode?: string;
};

type LedgerSignature = {
  r: string;
  s: string;
  v: string | number;
};

export type LedgerKeyringSession = {
  getAddress(
    path: string,
    options?: { checkOnDevice?: boolean; returnChainCode?: boolean },
  ): Promise<LedgerAddress>;
  signTransaction(path: string, rawTx: Uint8Array): Promise<LedgerSignature>;
  signPersonalMessage(
    path: string,
    message: string | Uint8Array,
  ): Promise<LedgerSignature>;
  signTypedData(path: string, data: any): Promise<LedgerSignature>;
  getAppAndVersion?(): Promise<{ appName: string; version: string }>;
  close?(): Promise<void> | void;
};

type LedgerKeyringOptions = {
  getLedgerSession?: (deviceId?: string) => Promise<LedgerKeyringSession>;
  transportType?: 'ble' | 'hid';
} & any;

function stripHex(value: string | number) {
  return ethUtil.stripHexPrefix(
    typeof value === 'number' ? value.toString(16) : value,
  );
}

function normalizeSignature(payload: LedgerSignature) {
  return {
    r: stripHex(payload.r).padStart(64, '0'),
    s: stripHex(payload.s).padStart(64, '0'),
    v: stripHex(payload.v),
  };
}

function normalizeMessageSignature(payload: LedgerSignature) {
  const signature = normalizeSignature(payload);
  const numericV =
    typeof payload.v === 'number' ? payload.v : parseInt(stripHex(payload.v), 16);
  const v = numericV < 27 ? numericV + 27 : numericV;

  return {
    ...signature,
    v: v.toString(16).padStart(2, '0'),
  };
}

function getTransactionSenderAddress(tx: {
  getSenderAddress: () => Buffer | { toString(): string };
}) {
  const sender = tx.getSenderAddress();
  const senderAddress = Buffer.isBuffer(sender)
    ? sender.toString('hex')
    : sender.toString();

  return ethUtil.toChecksumAddress(ethUtil.addHexPrefix(senderAddress));
}

class LedgerKeyring {
  accountDetails: Record<string, AccountDetail>;

  static type = type;

  type = type;

  page: number;

  perPage: number;

  unlockedAccount: number;

  paths: Record<string, number>;

  hdPath: any;

  accounts: any;

  session: null | LedgerKeyringSession;

  sessionDeviceId?: string;

  hasHIDPermission: null | boolean;

  usedHDPathTypeList: Record<string, HDPathType> = {};

  events = keyringEventBus;

  deviceId?: string;

  getLedgerSession: (deviceId?: string) => Promise<LedgerKeyringSession>;

  transportType: 'ble' | 'hid' = 'hid';

  constructor(opts: LedgerKeyringOptions = {}) {
    this.accountDetails = {};
    this.page = 0;
    this.perPage = 5;
    this.unlockedAccount = 0;
    this.paths = {};
    this.hasHIDPermission = null;
    this.session = null;
    this.usedHDPathTypeList = {};
    this.getLedgerSession =
      opts.getLedgerSession ||
      (async () => {
        throw new Error('Ledger: DMK session factory is not configured');
      });
    this.transportType = opts.transportType || 'hid';
    this.deserialize(opts);
  }

  serialize() {
    return Promise.resolve({
      hdPath: this.hdPath,
      accounts: this.accounts,
      accountDetails: this.accountDetails,
      hasHIDPermission: this.hasHIDPermission,
      usedHDPathTypeList: this.usedHDPathTypeList,
    });
  }

  deserialize(opts: any = {}) {
    this.hdPath = opts.hdPath || HD_PATH_BASE.Legacy;
    this.accounts = opts.accounts || [];
    this.accountDetails = opts.accountDetails || {};
    if (opts.hasHIDPermission !== undefined) {
      this.hasHIDPermission = opts.hasHIDPermission;
    }

    if (!opts.accountDetails) {
      this._migrateAccountDetails(opts);
    }

    if (opts.usedHDPathTypeList) {
      this.usedHDPathTypeList = opts.usedHDPathTypeList;
    }

    // Remove accounts that don't have corresponding account details
    this.accounts = this.accounts.filter((account: string) =>
      Object.keys(this.accountDetails).includes(
        ethUtil.toChecksumAddress(account),
      ),
    );

    return Promise.resolve();
  }

  setDeviceId(deviceId: string) {
    this.deviceId = deviceId;
  }

  getDeviceId() {
    return this.deviceId;
  }

  _migrateAccountDetails(opts: { accountIndexes: { [x: string]: any } }) {
    if (opts.accountIndexes) {
      for (const account of Object.keys(opts.accountIndexes)) {
        this.accountDetails[account] = {
          hdPath: this._getPathForIndex(opts.accountIndexes[account]),
        };
      }
    }
  }

  isUnlocked() {
    return Boolean(this.session);
  }

  setAccountToUnlock(index: number) {
    this.unlockedAccount =
      typeof index === 'number' ? index : parseInt(index, 10);
  }

  setHdPath(hdPath: string) {
    this.hdPath = hdPath;
  }

  async makeApp(_signing = false) {
    if (this.session && this.sessionDeviceId === this.deviceId) {
      return;
    }

    if (this.session) {
      await this.cleanUp();
    }

    this.session = await this.getLedgerSession(this.deviceId);
    this.sessionDeviceId = this.deviceId;
  }

  async cleanUp() {
    const session = this.session;
    this.session = null;
    this.sessionDeviceId = undefined;
    await session?.close?.();
  }

  async unlock(hdPath?: string | undefined, force?: boolean): Promise<string> {
    if (force) {
      hdPath = this.hdPath;
    }
    if (this.isUnlocked() && !hdPath) {
      return 'already unlocked';
    }
    const path = this._toLedgerPath(hdPath || this.hdPath);

    await this.makeApp();
    const res = await this.session!.getAddress(path, {
      returnChainCode: true,
    });
    const { address } = res;

    return address;
  }

  addAccounts(n = 1) {
    return new Promise((resolve, reject) => {
      this.unlock()
        .then(async _ => {
          const from = this.unlockedAccount;
          const to = from + n;
          for (let i = from; i < to; i++) {
            const path = this._getPathForIndex(i);
            let address: string;
            address = await this.unlock(path);

            const hdPathType = this.getHDPathType(path);
            this.accountDetails[ethUtil.toChecksumAddress(address)] = {
              hdPath: path,
              hdPathBasePublicKey: await this.getPathBasePublicKey(hdPathType),
              hdPathType,
              deviceId: this.deviceId,
            };

            address = address.toLowerCase();

            if (!this.accounts.includes(address)) {
              this.accounts.push(address);
            } else {
              throw new Error(
                "The address you're trying to import is invalid",
              );
            }
            this.page = 0;
          }
          resolve(this.accounts);
        })
        .catch(reject);
    });
  }

  getFirstPage() {
    this.page = 0;
    return this.__getPage(1);
  }

  getNextPage() {
    return this.__getPage(1);
  }

  getPreviousPage() {
    return this.__getPage(-1);
  }

  getAccounts() {
    return Promise.resolve(this.accounts.slice());
  }

  removeAccount(address: string) {
    if (
      !this.accounts
        .map((a: string) => a.toLowerCase())
        .includes(address.toLowerCase())
    ) {
      throw new Error(`Address ${address} not found in this keyring`);
    }
    this.accounts = this.accounts.filter(
      (a: string) => a.toLowerCase() !== address.toLowerCase(),
    );
    const checksummedAddress = ethUtil.toChecksumAddress(address);
    delete this.accountDetails[checksummedAddress];
    delete this.paths[checksummedAddress];
  }

  // tx is an instance of the ethereumjs-transaction class.
  async signTransaction(
    address: any,
    tx: {
      getChainId: () => Buffer;
      v: string | Buffer;
      r: string | Buffer;
      s: string | Buffer;
      serialize: () => {
        (): any;
        new (): any;
        toString: { (arg0: string): any; new (): any };
      };
      getMessageToSign: (arg0: boolean) => any;
      toJSON: () => any;
      common: any;
    },
  ) {
    // make sure the previous transaction is cleaned up
    await this._reconnect();

    // transactions built with older versions of ethereumjs-tx have a
    // getChainId method that newer versions do not. Older versions are mutable
    // while newer versions default to being immutable. Expected shape and type
    // of data for v, r and s differ (Buffer (old) vs BN (new))
    if (typeof tx.getChainId === 'function') {
      // In this version of ethereumjs-tx we must add the chainId in hex format
      // to the initial v value. The chainId must be included in the serialized
      // transaction which is only communicated to ethereumjs-tx in this
      // value. In newer versions the chainId is communicated via the 'Common'
      // object.
      tx.v = ethUtil.bufferToHex(tx.getChainId());
      tx.r = '0x00';
      tx.s = '0x00';

      const rawTxHex = tx.serialize().toString('hex');

      return this._signTransaction(
        address,
        rawTxHex,
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        (payload: {
          v:
            | WithImplicitCoercion<string>
            | { [Symbol.toPrimitive](hint: 'string'): string };
          r:
            | WithImplicitCoercion<string>
            | { [Symbol.toPrimitive](hint: 'string'): string };
          s:
            | WithImplicitCoercion<string>
            | { [Symbol.toPrimitive](hint: 'string'): string };
        }) => {
          tx.v = Buffer.from(payload.v, 'hex');
          tx.r = Buffer.from(payload.r, 'hex');
          tx.s = Buffer.from(payload.s, 'hex');
          return tx;
        },
      );
    }
    // For transactions created by newer versions of @ethereumjs/tx
    // Note: https://github.com/ethereumjs/ethereumjs-monorepo/issues/1188
    // It is not strictly necessary to do this additional setting of the v
    // value. We should be able to get the correct v value in serialization
    // if the above issue is resolved. Until then this must be set before
    // calling .serialize(). Note we are creating a temporarily mutable object
    // forfeiting the benefit of immutability until this happens. We do still
    // return a Transaction that is frozen if the originally provided
    // transaction was also frozen.
    const messageToSign = tx.getMessageToSign(false);
    let rawTxHex = Buffer.isBuffer(messageToSign)
      ? messageToSign.toString('hex')
      : ethUtil.rlp.encode(messageToSign).toString('hex');

    // FIXME: This is a temporary fix for the issue with the Ledger device, waiting for a fix from Ledger
    if (!Array.isArray(ethUtil.rlp.decode(Buffer.from(rawTxHex, 'hex')))) {
      console.log('rlpTx not an array');
      rawTxHex = Buffer.from(messageToSign).toString('hex');
    }

    return this._signTransaction(
      address,
      rawTxHex,
      (payload: { v: string; r: string; s: string }) => {
        // Because tx will be immutable, first get a plain javascript object that
        // represents the transaction. Using txData here as it aligns with the
        // nomenclature of ethereumjs/tx.
        const txData = tx.toJSON();
        // The fromTxData utility expects v,r and s to be hex prefixed
        txData.v = ethUtil.addHexPrefix(payload.v);
        txData.r = ethUtil.addHexPrefix(payload.r);
        txData.s = ethUtil.addHexPrefix(payload.s);
        // Adopt the 'common' option from the original transaction and set the
        // returned object to be frozen if the original is frozen.
        if (is1559Tx(txData)) {
          return FeeMarketEIP1559Transaction.fromTxData(txData);
        }
        return TransactionFactory.fromTxData(txData, {
          common: tx.common,
          freeze: Object.isFrozen(tx),
        });
      },
    );
  }

  async _reconnect() {
    await this.makeApp();
    if (!this.session) {
      throw new Error('Ledger: Failed to connect to Ledger');
    }
  }

  async _signTransaction(
    address: any,
    rawTxHex: string,
    handleSigning: {
      (payload: any): any;
      (payload: any): TypedTransaction;
      // eslint-disable-next-line @typescript-eslint/unified-signatures
      (arg0: { s: string; v: string; r: string }): any;
    },
  ) {
    try {
      const hdPath = await this.unlockAccountByAddress(address);
      await this.makeApp(true);
      const res = normalizeSignature(
        await this.session!.signTransaction(
          this._toLedgerPath(hdPath),
          Buffer.from(rawTxHex, 'hex'),
        ),
      );
      const newOrMutatedTx = handleSigning(res);
      const valid = newOrMutatedTx.verifySignature();
      if (!valid) {
        throw new Error('Ledger: The transaction signature is not valid');
      }
      const addressSignedWith = getTransactionSenderAddress(newOrMutatedTx);
      const correctAddress = ethUtil.toChecksumAddress(address);
      if (addressSignedWith !== correctAddress) {
        throw new Error(
          "Ledger: The signature doesn't match the right address",
        );
      }
      return newOrMutatedTx;
    } catch (err: any) {
      await this.cleanUp();
      throw new Error(
        err.toString() || 'Ledger: Unknown error while signing transaction',
      );
    }
  }

  signMessage(withAccount: any, data: any) {
    return this.signPersonalMessage(withAccount, data);
  }

  // For personal_sign, we need to prefix the message:
  async signPersonalMessage(withAccount: string, message: string) {
    await this._reconnect();
    try {
      await this.makeApp(true);
      const hdPath = await this.unlockAccountByAddress(withAccount);
      const res = normalizeMessageSignature(
        await this.session!.signPersonalMessage(
          this._toLedgerPath(hdPath),
          Buffer.from(ethUtil.stripHexPrefix(message), 'hex'),
        ),
      );
      const signature = `0x${res.r}${res.s}${res.v}`;
      const addressSignedWith = sigUtil.recoverPersonalSignature({
        data: message,
        sig: signature,
      });
      if (
        ethUtil.toChecksumAddress(addressSignedWith) !==
        ethUtil.toChecksumAddress(withAccount)
      ) {
        throw new Error(
          "Ledger: The signature doesn't match the right address",
        );
      }
      return signature;
    } catch (e: any) {
      await this.cleanUp();
      throw new Error(
        e.toString() || 'Ledger: Unknown error while signing message',
      );
    }
  }

  async unlockAccountByAddress(address: string) {
    const hdPath = this.getHdPathByAddress(address);
    const unlockedAddress: string = await this.unlock(hdPath);

    // unlock resolves to the address for the given hdPath as reported by the ledger device
    // if that address is not the requested address, then this account belongs to a different device or seed
    if (unlockedAddress.toLowerCase() !== address.toLowerCase()) {
      throw new Error(
        `Ledger: Account ${address} does not belong to the connected device`,
      );
    }
    return hdPath;
  }

  private getHdPathByAddress(address: string) {
    const checksummedAddress = ethUtil.toChecksumAddress(address);
    const detail = this.accountDetails[checksummedAddress];
    if (!detail) {
      throw new Error(
        `Ledger: Account for address '${checksummedAddress}' not found`,
      );
    }
    return detail.hdPath;
  }

  async signTypedData(withAccount: string, data: any, options: any = {}) {
    const isV4 = options.version === 'V4';
    if (!isV4) {
      throw new Error(
        'Ledger: Only version 4 of typed data signing is supported',
      );
    }

    await this._reconnect();
    try {
      const hdPath = await this.unlockAccountByAddress(withAccount);
      await this.makeApp(true);

      const res = normalizeMessageSignature(
        await this.session!.signTypedData(this._toLedgerPath(hdPath), data),
      );
      const signature = `0x${res.r}${res.s}${res.v}`;
      const addressSignedWith = sigUtil.recoverTypedSignature_v4({
        data,
        sig: signature,
      });
      if (
        ethUtil.toChecksumAddress(addressSignedWith) !==
        ethUtil.toChecksumAddress(withAccount)
      ) {
        throw new Error('Ledger: The signature doesnt match the right address');
      }
      return signature;
    } catch (e: any) {
      await this.cleanUp();
      throw new Error(
        e.toString() || 'Ledger: Unknown error while signing message',
      );
    }
  }

  exportAccount() {
    throw new Error('Not supported on this device');
  }

  forgetDevice() {
    this.accounts = [];
    this.page = 0;
    this.unlockedAccount = 0;
    this.paths = {};
    this.accountDetails = {};
  }

  /* PRIVATE METHODS */

  async __getPage(increment: number) {
    this.page += increment;

    if (this.page <= 0) {
      this.page = 1;
    }
    const from = (this.page - 1) * this.perPage;
    const to = from + this.perPage;

    await this.unlock();
    const accounts = await this._getAccountsBIP44(from, to);

    return accounts;
  }

  async getAddresses(start: number, end: number) {
    const from = start;
    const to = end;
    await this.unlock();
    const accounts = await this._getAccountsBIP44(from, to);

    return accounts;
  }

  getIndexFromAddress(address: string) {
    const checksummedAddress = ethUtil.toChecksumAddress(address);
    if (!this.accountDetails[checksummedAddress]) {
      throw new Error(`Address ${address} not found`);
    }
    let index: null | number = null;
    const { hdPath } = this.accountDetails[checksummedAddress];
    if (/m\/44'\/60'\/(\d+)'\/0\/0/u.test(hdPath)) {
      const res = hdPath.match(/m\/44'\/60'\/(\d+)'\/0\/0/u);
      if (res && res[1]) {
        index = parseInt(res[1], 10);
      }
    } else {
      const _checksummedAddress = ethUtil.toChecksumAddress(address);
      const arr = this.accountDetails[_checksummedAddress].hdPath.split('/');
      index = Number(arr[arr.length - 1]);
    }
    return index;
  }

  authorizeHIDPermission() {
    this.hasHIDPermission = true;
  }

  async _getAccountsBIP44(from: number, to: number) {
    const accounts: Account[] = [];

    for (let i = from; i < to; i++) {
      const path = this._getPathForIndex(i);
      const address = await this.unlock(path);

      accounts.push({
        address,
        balance: null,
        index: i + 1,
      });
    }
    return accounts;
  }

  _getPathForIndex(index: number) {
    // Check if the path is BIP 44 (Ledger Live)
    return this._isLedgerLiveHdPath()
      ? `m/44'/60'/${index}'/0/0`
      : `${this.hdPath}/${index}`;
  }

  _isLedgerLiveHdPath() {
    return this.hdPath === "m/44'/60'/0'/0/0";
  }

  _toLedgerPath(path: { toString: () => string }) {
    return path.toString().replace('m/', '');
  }

  private getHDPathType(path: string) {
    if (/^m\/44'\/60'\/(\d+)'\/0\/0$/u.test(path)) {
      return HDPathType.LedgerLive;
    } else if (/^m\/44'\/60'\/0'\/0\/(\d+)$/u.test(path)) {
      return HDPathType.BIP44;
    } else if (/^m\/44'\/60'\/0'\/(\d+)$/u.test(path)) {
      return HDPathType.Legacy;
    }
    throw new Error('Invalid path');
  }

  private async getPathBasePublicKey(hdPathType: HDPathType) {
    const pathBase = this.getHDPathBase(hdPathType);
    const res = await this.getDeviceAddress(pathBase);

    return res.publicKey;
  }

  private getHDPathBase(hdPathType: HDPathType) {
    return HD_PATH_BASE[hdPathType];
  }

  private getHDPathTypeFromPath(hdPath: string) {
    return HD_PATH_TYPE[hdPath];
  }

  private async _fixAccountDetail(address: string) {
    const checksummedAddress = ethUtil.toChecksumAddress(address);
    const detail = this.accountDetails[checksummedAddress];

    // The detail is already fixed
    if (detail.hdPathBasePublicKey) {
      return;
    }
    // Check if the account is of the device
    // so we get address from the device by the hdPath
    const hdPathType = this.getHDPathType(detail.hdPath);

    // Account
    const res = await this.getDeviceAddress(detail.hdPath);
    const addressInDevice = res.address;

    // The address is not the same, so we don't need to fix
    if (!isSameAddress(addressInDevice, address)) {
      return;
    }

    // Right, we need to fix the account detail
    detail.hdPathType = hdPathType;
    detail.hdPathBasePublicKey = await this.getPathBasePublicKey(hdPathType);
  }

  // return top 3 accounts for each path type
  async getInitialAccounts() {
    await this.unlock();
    const defaultHDPath = this.hdPath;
    this.setHdPath(this.getHDPathBase(HDPathType.LedgerLive));
    const LedgerLiveAccounts = await this.getAddresses(0, 3);
    this.setHdPath(this.getHDPathBase(HDPathType.BIP44));
    const BIP44Accounts = await this.getAddresses(0, 3);
    this.setHdPath(this.getHDPathBase(HDPathType.Legacy));
    const LegacyAccounts = await this.getAddresses(0, 3);
    this.setHdPath(defaultHDPath);

    return {
      [HDPathType.LedgerLive]: LedgerLiveAccounts,
      [HDPathType.BIP44]: BIP44Accounts,
      [HDPathType.Legacy]: LegacyAccounts,
    };
  }

  async getCurrentAccounts() {
    await this.unlock();
    const addresses = await this.getAccounts();
    const pathBase = this.hdPath;
    const { publicKey: currentPublicKey } =
      await this.getDeviceAddress(pathBase);
    const hdPathType = this.getHDPathTypeFromPath(pathBase);
    const accounts: Account[] = [];
    // eslint-disable-next-line @typescript-eslint/prefer-for-of
    for (let i = 0; i < addresses.length; i++) {
      const address = addresses[i];
      await this._fixAccountDetail(address);

      const detail = this.accountDetails[ethUtil.toChecksumAddress(address)];

      if (detail.hdPathBasePublicKey === currentPublicKey) {
        const info = this.getAccountInfo(address);
        if (info) {
          accounts.push(info);
        }
        continue;
      }

      // Live and BIP44 first account is the same
      // we need to check the first account when the path type is LedgerLive or BIP44
      if (
        hdPathType !== HDPathType.Legacy &&
        (detail.hdPathType === HDPathType.LedgerLive ||
          detail.hdPathType === HDPathType.BIP44)
      ) {
        const info = this.getAccountInfo(address);
        if (info?.index === 1) {
          const res = await this.getDeviceAddress(detail.hdPath);
          if (isSameAddress(res.address, address)) {
            accounts.push(info);
          }
        }
      }
    }

    return accounts;
  }

  getAccountInfo(address: string) {
    const detail = this.accountDetails[ethUtil.toChecksumAddress(address)];
    if (detail) {
      const { hdPath, hdPathType, hdPathBasePublicKey, deviceId } = detail;
      return {
        address,
        index: this.getIndexFromPath(hdPath, hdPathType) + 1,
        balance: null,
        hdPathType,
        hdPathBasePublicKey,
        deviceId,
      };
    }
    return undefined;
  }

  private getIndexFromPath(path: string, hdPathType?: HDPathType) {
    switch (hdPathType) {
      case HDPathType.BIP44:
        return parseInt(path.split('/')[5]);
      case HDPathType.Legacy:
        return parseInt(path.split('/')[4]);
      case HDPathType.LedgerLive:
        return parseInt(path.split('/')[3]);
      default:
        throw new Error('Invalid path');
    }
  }

  private async getDeviceAddress(path: string) {
    await this.makeApp();
    return this.session!.getAddress(this._toLedgerPath(path), {
      returnChainCode: true,
    });
  }

  async setHDPathType(hdPathType: HDPathType) {
    const hdPath = this.getHDPathBase(hdPathType);
    this.setHdPath(hdPath);
  }

  async setCurrentUsedHDPathType() {
    const key = await this.getPathBasePublicKey(HDPathType.Legacy);
    this.usedHDPathTypeList[key] = this.getHDPathTypeFromPath(this.hdPath);
  }

  async getCurrentUsedHDPathType() {
    const key = await this.getPathBasePublicKey(HDPathType.Legacy);
    return this.usedHDPathTypeList[key];
  }

  openEthApp = (): Promise<Buffer> => {
    return Promise.resolve(Buffer.alloc(0));
  };

  quitApp = (): Promise<Buffer> => {
    return Promise.resolve(Buffer.alloc(0));
  };

  getAppAndVersion = async (): Promise<{
    appName: string;
    version: string;
  }> => {
    await this.makeApp();

    const result = await this.session?.getAppAndVersion?.();
    if (result) {
      return result;
    }

    return {
      appName: 'Ethereum',
      version: '',
    };
  };

  fixDeviceId(address: string, deviceId: string) {
    const checksummedAddress = ethUtil.toChecksumAddress(address);
    const detail = this.accountDetails[checksummedAddress];
    if (!detail) {
      return;
    }

    if (detail.deviceId !== deviceId) {
      this.accountDetails[checksummedAddress] = {
        ...detail,
        deviceId,
      };
    }
  }
}

export default LedgerKeyring;
/* eslint-enable @typescript-eslint/no-non-null-assertion */
