/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type { TypedTransaction } from '@ethereumjs/tx';
import {
  TransactionFactory,
  FeeMarketEIP1559Transaction,
} from '@ethereumjs/tx';
import LedgerEth from '@ledgerhq/hw-app-eth';
import type Transport from '@ledgerhq/hw-transport';
import { addressUtils } from '@rabby-wallet/base-utils';
import {
  SignHelper,
  SIGN_HELPER_EVENTS as EVENTS,
  eventBus,
} from '@rabby-wallet/keyring-utils';
import * as sigUtil from 'eth-sig-util';
import * as ethUtil from 'ethereumjs-util';

import { wait, is1559Tx, LedgerHDPathType } from './utils';

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

  transport: null | Transport;

  app: null | LedgerEth;

  hasHIDPermission: null | boolean;

  usedHDPathTypeList: Record<string, HDPathType> = {};

  signHelper = new SignHelper({
    errorEventName: EVENTS.LEDGER.REJECTED,
  });

  events = eventBus;

  deviceId?: string;

  getTransport: (deviceId: string) => Promise<Transport>;

  transportType: 'ble' | 'hid' = 'hid';

  constructor(
    opts: {
      getTransport: () => Promise<Transport>;
      transportType: 'ble' | 'hid';
    } & any = {},
  ) {
    this.accountDetails = {};
    this.page = 0;
    this.perPage = 5;
    this.unlockedAccount = 0;
    this.paths = {};
    this.hasHIDPermission = null;
    this.transport = null;
    this.app = null;
    this.usedHDPathTypeList = {};
    this.getTransport = opts.getTransport;
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
    return Boolean(this.app);
  }

  setAccountToUnlock(index: number) {
    this.unlockedAccount =
      typeof index === 'number' ? index : parseInt(index, 10);
  }

  setHdPath(hdPath: string) {
    this.hdPath = hdPath;
  }

  async makeApp(_signing = false) {
    if (!this.app || this.transportType === 'ble') {
      try {
        this.transport = await this.getTransport(this.deviceId!);
        this.app = new LedgerEth(this.transport);
      } catch (e: any) {
        if (this.transportType === 'ble') {
          throw e;
        } else if (!e.message?.includes('The device is already open')) {
          console.error(e);
        }
      }
    }
  }

  async cleanUp() {
    this.app = null;
    if (this.transport) {
      await this.transport.close();
    }
    this.transport = null;
  }

  async unlock(hdPath?: string | undefined, force?: boolean): Promise<string> {
    if (force) {
      hdPath = this.hdPath;
    }
    if (this.isUnlocked() && !hdPath) {
      return 'already unlocked';
    }
    const path = hdPath ? this._toLedgerPath(hdPath) : this.hdPath;

    await this.makeApp();
    const res = await this.app!.getAddress(path, false, true);
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
                "The address you're are trying to import is invalid",
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

  resend() {
    this.signHelper.resend();
  }

  // tx is an instance of the ethereumjs-transaction class.
  signTransaction(
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
    return this.signHelper.invoke(async () => {
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
    });
  }

  async _reconnect() {
    await this.cleanUp();

    let count = 0;
    // wait connect the WebHID
    while (!this.app) {
      await this.makeApp();
      // eslint-disable-next-line no-loop-func
      await wait(() => {
        // eslint-disable-next-line no-plusplus
        if (count++ > 50) {
          throw new Error('Ledger: Failed to connect to Ledger');
        }
      }, 100);
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
    const hdPath = await this.unlockAccountByAddress(address);
    await this.makeApp(true);
    try {
      const res = await this.app!.signTransaction(hdPath, rawTxHex);
      const newOrMutatedTx = handleSigning(res);
      const valid = newOrMutatedTx.verifySignature();
      if (valid) {
        return newOrMutatedTx;
      }
      throw new Error('Ledger: The transaction signature is not valid');
    } catch (err: any) {
      throw new Error(
        err.toString() || 'Ledger: Unknown error while signing transaction',
      );
    } finally {
      this.cleanUp();
    }
  }

  signMessage(withAccount: any, data: any) {
    return this.signPersonalMessage(withAccount, data);
  }

  // For personal_sign, we need to prefix the message:
  async signPersonalMessage(withAccount: string, message: string) {
    return this.signHelper.invoke(async () => {
      await this._reconnect();
      try {
        await this.makeApp(true);
        const hdPath = await this.unlockAccountByAddress(withAccount);
        const res = await this.app!.signPersonalMessage(
          hdPath,
          ethUtil.stripHexPrefix(message),
        );
        // let v: string | number = res.v - 27;
        let v = res.v.toString(16);
        if (v.length < 2) {
          v = `0${v}`;
        }
        const signature = `0x${res.r}${res.s}${v}`;
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
        throw new Error(
          e.toString() || 'Ledger: Unknown error while signing message',
        );
      } finally {
        this.cleanUp();
      }
    });
  }

  async unlockAccountByAddress(address: string) {
    const checksummedAddress = ethUtil.toChecksumAddress(address);
    if (!Object.keys(this.accountDetails).includes(checksummedAddress)) {
      throw new Error(
        `Ledger: Account for address '${checksummedAddress}' not found`,
      );
    }
    const { hdPath } = this.accountDetails[checksummedAddress];
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

  async signTypedData(withAccount: string, data: any, options: any = {}) {
    return this.signHelper.invoke(async () => {
      await this._reconnect();
      const isV4 = options.version === 'V4';
      if (!isV4) {
        throw new Error(
          'Ledger: Only version 4 of typed data signing is supported',
        );
      }

      const hdPath = await this.unlockAccountByAddress(withAccount);
      try {
        await this.makeApp(true);

        let res: {
          v: number;
          s: string;
          r: string;
        };

        // https://github.com/LedgerHQ/ledger-live/blob/5bae039273beeeb02d8640d778fd7bf5f7fd3776/libs/coin-evm/src/hw-signMessage.ts#L68C7-L79C10
        try {
          res = await this.app!.signEIP712Message(hdPath, data);
        } catch (e: any) {
          const shouldFallbackOnHashedMethod =
            'statusText' in e && e.statusText === 'INS_NOT_SUPPORTED';
          if (!shouldFallbackOnHashedMethod) {
            throw e;
          }

          const { domain, types, primaryType, message } =
            sigUtil.TypedDataUtils.sanitizeData(data);
          const domainSeparatorHex = sigUtil.TypedDataUtils.hashStruct(
            'EIP712Domain',
            domain,
            types,
            isV4,
          ).toString('hex');
          const hashStructMessageHex = sigUtil.TypedDataUtils.hashStruct(
            primaryType as string,
            message,
            types,
            isV4,
          ).toString('hex');

          res = await this.app!.signEIP712HashedMessage(
            hdPath,
            domainSeparatorHex,
            hashStructMessageHex,
          );
        }

        let v = res.v.toString(16);
        if (v.length < 2) {
          v = `0${v}`;
        }
        const signature = `0x${res.r}${res.s}${v}`;
        const addressSignedWith = sigUtil.recoverTypedSignature_v4({
          data,
          sig: signature,
        });
        if (
          ethUtil.toChecksumAddress(addressSignedWith) !==
          ethUtil.toChecksumAddress(withAccount)
        ) {
          throw new Error(
            'Ledger: The signature doesnt match the right address',
          );
        }
        return signature;
      } catch (e: any) {
        throw new Error(
          e.toString() || 'Ledger: Unknown error while signing message',
        );
      } finally {
        this.cleanUp();
      }
    });
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
    const res = await this.app!.getAddress(pathBase, false, true);

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
    const res = await this.app!.getAddress(detail.hdPath, false, true);
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
    const { publicKey: currentPublicKey } = await this.app!.getAddress(
      pathBase,
      false,
      true,
    );
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
          const res = await this.app!.getAddress(detail.hdPath, false, true);
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
    if (!this.transport) {
      throw new Error(
        'Ledger transport is not initialized. You must call setTransport first.',
      );
    }

    return this.transport.send(
      0xe0,
      0xd8,
      0x00,
      0x00,
      Buffer.from('Ethereum', 'ascii'),
    );
  };

  quitApp = (): Promise<Buffer> => {
    if (!this.transport) {
      throw new Error(
        'Ledger transport is not initialized. You must call setTransport first.',
      );
    }

    return this.transport.send(0xb0, 0xa7, 0x00, 0x00);
  };

  getAppAndVersion = async (): Promise<{
    appName: string;
    version: string;
  }> => {
    await this.makeApp();

    if (!this.transport) {
      throw new Error(
        'Ledger transport is not initialized. You must call setTransport first.',
      );
    }

    const response = await this.transport.send(0xb0, 0x01, 0x00, 0x00);

    let i = 0;
    // eslint-disable-next-line no-plusplus
    const format = response[i++];

    if (format !== 1) {
      throw new Error('getAppAndVersion: format not supported');
    }

    // eslint-disable-next-line no-plusplus
    const nameLength = response[i++];
    const appName = response.slice(i, (i += nameLength)).toString('ascii');
    // eslint-disable-next-line no-plusplus
    const versionLength = response[i++];
    const version = response.slice(i, (i += versionLength)).toString('ascii');

    return {
      appName,
      version,
    };
  };
}

export default LedgerKeyring;
/* eslint-enable @typescript-eslint/no-non-null-assertion */
