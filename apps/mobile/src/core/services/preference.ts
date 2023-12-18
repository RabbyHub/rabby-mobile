import cloneDeep from 'lodash/cloneDeep';
import { addressUtils } from '@rabby-wallet/base-utils';

import dayjs from 'dayjs';
// import {
//   TokenItem,
//   TotalBalanceResponse,
// } from '@rabby-wallet/rabby-api/dist/types';
import { CHAINS_ENUM } from '@debank/common';
import createPersistStore, {
  StorageAdapaterOptions,
} from '@rabby-wallet/persist-store';
import { keyringService } from '.';
import { KeyringAccount } from '@rabby-wallet/keyring-utils';

const { isSameAddress } = addressUtils;

const version = process.env.release || '0';

//FIXME
type TokenItem = any;
type TotalBalanceResponse = any;

export interface Account {
  type: string;
  address: string;
  brandName: string;
  aliasName?: string;
  displayBrandName?: string;
  index?: number;
  balance?: number;
}

export interface ChainGas {
  gasPrice?: number | null; // custom cached gas price
  gasLevel?: string | null; // cached gasLevel
  lastTimeSelect?: 'gasLevel' | 'gasPrice'; // last time selection, 'gasLevel' | 'gasPrice'
  expireAt?: number;
}

export interface GasCache {
  [chainId: string | number]: ChainGas;
}

export interface addedToken {
  [address: string]: string[];
}

export interface Token {
  address: string;
  chain: string;
}

export type IPinAddress = {
  brandName: Account['brandName'];
  address: Account['address'];
};
export interface PreferenceStore {
  currentAccount: Account | undefined | null;
  balanceMap: {
    [address: string]: TotalBalanceResponse;
  };
  testnetBalanceMap: {
    [address: string]: TotalBalanceResponse;
  };
  locale: string;
  lastTimeSendToken: Record<string, TokenItem>;
  pinAddresses: IPinAddress[];
  gasCache: GasCache;
  currentVersion: string;

  sendLogTime?: number;
  lastSelectedGasTopUpChain?: Record<string, CHAINS_ENUM>;
  sendEnableTime?: number;
  customizedToken?: Token[];
  blockedToken?: Token[];
  collectionStarred?: Token[];
  /**
   * auto lock time in minutes
   */
  autoLockTime?: number;
  hiddenBalance?: boolean;
  isShowTestnet?: boolean;
  // themeMode?: DARK_MODE_TYPE;
  addressSortStore: AddressSortStore;
}

export interface AddressSortStore {
  search: string;
  sortType: 'usd' | 'addressType' | 'alphabet';
  lastScrollOffset?: number;
  lastCurrentRecordTime?: number;
}

const defaultAddressSortStore: AddressSortStore = {
  search: '',
  sortType: 'usd',
};

export class PreferenceService {
  store!: PreferenceStore;

  constructor(options?: StorageAdapaterOptions) {
    const defaultLang = 'en';
    this.store = createPersistStore<PreferenceStore>(
      {
        name: 'preference',
        template: {
          currentAccount: undefined,
          balanceMap: {},
          testnetBalanceMap: {},
          locale: defaultLang,
          lastTimeSendToken: {},
          pinAddresses: [],
          gasCache: {},
          currentVersion: '0',
          sendLogTime: 0,
          sendEnableTime: 0,
          customizedToken: [],
          blockedToken: [],
          collectionStarred: [],
          hiddenBalance: false,
          isShowTestnet: false,
          autoLockTime: 0,
          // themeMode: DARK_MODE_TYPE.light,
          addressSortStore: {
            ...defaultAddressSortStore,
          },
        },
      },
      {
        storage: options?.storageAdapter,
      },
    );
  }

  getPreference = (key?: keyof PreferenceStore) => {
    if (!key || ['search', 'lastCurrent'].includes(key)) {
      this.resetAddressSortStoreExpiredValue();
    }
    return key ? this.store[key] : this.store;
  };

  getLastTimeSendToken = (address: string) => {
    const key = address.toLowerCase();
    return this.store.lastTimeSendToken[key];
  };

  setLastTimeSendToken = (address: string, token: TokenItem) => {
    const key = address.toLowerCase();
    this.store.lastTimeSendToken = {
      ...this.store.lastTimeSendToken,
      [key]: token,
    };
  };

  getLastSelectedGasTopUpChain = (address: string) => {
    const key = address.toLowerCase();
    return this.store?.lastSelectedGasTopUpChain?.[key];
  };

  setLastSelectedGasTopUpChain = (address: string, chain: CHAINS_ENUM) => {
    const key = address.toLowerCase();
    this.store.lastSelectedGasTopUpChain = {
      ...this.store?.lastSelectedGasTopUpChain,
      [key]: chain,
    };
  };

  // getAcceptLanguages = async () => {
  //   let langs = await browser.i18n.getAcceptLanguages();
  //   if (!langs) langs = [];
  //   return langs
  //     .map(lang => lang.replace(/-/g, '_'))
  //     .filter(lang => LANGS.find(item => item.code === lang));
  // };

  /**
   * If current account be hidden or deleted
   * call this function to reset current account
   * to the first address in address list
   */
  resetCurrentAccount = async () => {
    const [account] = await keyringService.getAllVisibleAccountsArray();
    this.setCurrentAccount(account);
  };

  getCurrentAccount = (): Account | undefined | null => {
    const account = cloneDeep(this.store.currentAccount);
    if (!account) {
      return account;
    }
    return {
      ...account,
      address: account.address.toLowerCase(),
    };
  };

  setCurrentAccount = (account: Account | null) => {
    this.store.currentAccount = account;
    if (account) {
      // sessionService.broadcastEvent('accountsChanged', [
      //   account.address.toLowerCase(),
      // ]);
      // syncStateToUI(BROADCAST_TO_UI_EVENTS.accountsChanged, account);
    }
  };

  updateTestnetAddressBalance = (
    address: string,
    data: TotalBalanceResponse,
  ) => {
    const testnetBalanceMap = this.store.testnetBalanceMap || {};
    this.store.testnetBalanceMap = {
      ...testnetBalanceMap,
      [address.toLowerCase()]: data,
    };
  };

  updateAddressBalance = (address: string, data: TotalBalanceResponse) => {
    const balanceMap = this.store.balanceMap || {};
    this.store.balanceMap = {
      ...balanceMap,
      [address.toLowerCase()]: data,
    };
  };

  removeTestnetAddressBalance = (address: string) => {
    const key = address.toLowerCase();
    if (key in this.store.testnetBalanceMap) {
      const map = this.store.testnetBalanceMap;
      delete map[key];
      this.store.testnetBalanceMap = map;
    }
  };

  removeAddressBalance = (address: string) => {
    const key = address.toLowerCase();
    if (key in this.store.balanceMap) {
      const map = this.store.balanceMap;
      delete map[key];
      this.store.balanceMap = map;
    }
  };

  getAddressBalance = (address: string): TotalBalanceResponse | null => {
    const balanceMap = this.store.balanceMap || {};
    return balanceMap[address.toLowerCase()] || null;
  };

  getTestnetAddressBalance = (address: string): TotalBalanceResponse | null => {
    const balanceMap = this.store.testnetBalanceMap || {};
    return balanceMap[address.toLowerCase()] || null;
  };

  // getLocale = () => {
  //   return this.store.locale;
  // };

  // setLocale = (locale: string) => {
  //   this.store.locale = locale;
  //   i18n.changeLanguage(locale);
  // };

  // getThemeMode = () => {
  //   return this.store.themeMode;
  // };

  // setThemeMode = (themeMode: DARK_MODE_TYPE) => {
  //   this.store.themeMode = themeMode;
  // };

  getPinAddresses = () => {
    return (this.store.pinAddresses || []).filter(
      item => !!item.brandName && !!item.address,
    );
  };
  updatePinAddresses = (list: IPinAddress[]) => {
    this.store.pinAddresses = list;
  };

  removePinAddress = (item: IPinAddress) => {
    this.store.pinAddresses = this.store.pinAddresses.filter(
      highlighted =>
        !(
          isSameAddress(highlighted.address, item.address) &&
          highlighted.brandName === item.brandName
        ),
    );
  };

  getLastTimeGasSelection = (chainId: keyof GasCache): ChainGas | null => {
    const cache = this.store.gasCache[chainId];
    if (cache && cache.lastTimeSelect === 'gasPrice') {
      if (Date.now() <= (cache.expireAt || 0)) {
        return cache;
      } else if (cache.gasLevel) {
        return {
          lastTimeSelect: 'gasLevel',
          gasLevel: cache.gasLevel,
        };
      } else {
        return null;
      }
    } else {
      return cache;
    }
  };

  updateLastTimeGasSelection = (chainId: keyof GasCache, gas: ChainGas) => {
    if (gas.lastTimeSelect === 'gasPrice') {
      this.store.gasCache = {
        ...this.store.gasCache,
        [chainId]: {
          ...this.store.gasCache[chainId],
          ...gas,
          expireAt: Date.now() + 3600000, // custom gasPrice will expire at 1h later
        },
      };
    } else {
      this.store.gasCache = {
        ...this.store.gasCache,
        [chainId]: {
          ...this.store.gasCache[chainId],
          ...gas,
        },
      };
    }
  };

  getCustomizedToken = () => {
    return this.store.customizedToken || [];
  };
  addCustomizedToken = (token: Token) => {
    if (
      !this.store.customizedToken?.find(
        item =>
          isSameAddress(item.address, token.address) &&
          item.chain === token.chain,
      )
    ) {
      this.store.customizedToken = [
        ...(this.store.customizedToken || []),
        token,
      ];
    }
  };
  removeCustomizedToken = (token: Token) => {
    this.store.customizedToken = this.store.customizedToken?.filter(
      item =>
        !(
          isSameAddress(item.address, token.address) &&
          item.chain === token.chain
        ),
    );
  };
  getBlockedToken = () => {
    return this.store.blockedToken || [];
  };
  addBlockedToken = (token: Token) => {
    if (
      !this.store.blockedToken?.find(
        item =>
          isSameAddress(item.address, token.address) &&
          item.chain === token.chain,
      )
    ) {
      this.store.blockedToken = [...(this.store.blockedToken || []), token];
    }
  };
  removeBlockedToken = (token: Token) => {
    this.store.blockedToken = this.store.blockedToken?.filter(
      item =>
        !(
          isSameAddress(item.address, token.address) &&
          item.chain === token.chain
        ),
    );
  };
  getCollectionStarred = () => {
    return this.store.collectionStarred || [];
  };
  addCollectionStarred = (token: Token) => {
    if (
      !this.store.collectionStarred?.find(
        item =>
          isSameAddress(item.address, token.address) &&
          item.chain === token.chain,
      )
    ) {
      this.store.collectionStarred = [
        ...(this.store.collectionStarred || []),
        token,
      ];
    }
  };
  removeCollectionStarred = (token: Token) => {
    this.store.collectionStarred = this.store.collectionStarred?.filter(
      item =>
        !(
          isSameAddress(item.address, token.address) &&
          item.chain === token.chain
        ),
    );
  };

  getSendLogTime = () => {
    return this.store.sendLogTime || 0;
  };
  updateSendLogTime = (time: number) => {
    this.store.sendLogTime = time;
  };
  getSendEnableTime = () => {
    return this.store.sendEnableTime || 0;
  };
  updateSendEnableTime = (time: number) => {
    this.store.sendEnableTime = time;
  };

  setAutoLockTime = (time: number) => {
    this.store.autoLockTime = time;
  };
  setHiddenBalance = (value: boolean) => {
    this.store.hiddenBalance = value;
  };
  getIsShowTestnet = () => {
    return this.store.isShowTestnet;
  };
  setIsShowTestnet = (value: boolean) => {
    this.store.isShowTestnet = value;
  };

  resetAddressSortStoreExpiredValue = () => {
    if (
      !this.store.addressSortStore.lastCurrentRecordTime ||
      (this.store.addressSortStore.lastCurrentRecordTime &&
        dayjs().isAfter(
          dayjs
            .unix(this.store.addressSortStore.lastCurrentRecordTime)
            .add(15, 'minute'),
        ))
    ) {
      this.store.addressSortStore = {
        ...this.store.addressSortStore,
        search: '',
        lastScrollOffset: undefined,
        lastCurrentRecordTime: undefined,
      };
    }
  };

  getAddressSortStoreValue = (key: keyof AddressSortStore) => {
    if (['search', 'lastScrollOffset'].includes(key)) {
      this.resetAddressSortStoreExpiredValue();
    }
    return this.store.addressSortStore[key];
  };

  setAddressSortStoreValue = <K extends keyof AddressSortStore>(
    key: K,
    value: AddressSortStore[K],
  ) => {
    if (['search', 'lastCurrent'].includes(key)) {
      this.store.addressSortStore = {
        ...this.store.addressSortStore,
        lastCurrentRecordTime: dayjs().unix(),
      };
    }
    this.store.addressSortStore = {
      ...this.store.addressSortStore,
      [key]: value,
    };
  };
}
