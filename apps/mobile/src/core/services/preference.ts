import cloneDeep from 'lodash/cloneDeep';
import { addressUtils } from '@rabby-wallet/base-utils';

import dayjs from 'dayjs';
import {
  TokenItem,
  TotalBalanceResponse,
} from '@rabby-wallet/rabby-api/dist/types';
import { CHAINS_ENUM } from '@/constant/chains';
import createPersistStore, {
  StorageAdapaterOptions,
} from '@rabby-wallet/persist-store';
import { KeyringAccountWithAlias } from '@/hooks/account';
import { BroadcastEvent } from '@/constant/event';
import KeyringService from '@rabby-wallet/service-keyring';
import { DEFAULT_AUTO_LOCK_MINUTES } from '@/constant/autoLock';
import { appServiceEvents } from './_utils';

const { isSameAddress } = addressUtils;

// export interface Account {
//   type: string;
//   address: string;
//   brandName: string;
//   aliasName?: string;
//   displayBrandName?: string;
//   index?: number;
//   balance?: number;
// }
export interface Account extends KeyringAccountWithAlias {}

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

export type IManageToken = {
  chainId: string;
  tokenId: string;
};

export type IDefiOrToken = {
  id: string;
  chainid: string;
  type: 'token' | 'defi';
};

export type ITokenSetting = {
  pinedQueue?: IManageToken[]; // maual always true
  foldTokens?: IManageToken[];
  unfoldTokens?: IManageToken[];
  includeDefiAndTokens?: IDefiOrToken[];
  excludeDefiAndTokens?: IDefiOrToken[];
};

export interface ITokenManageSettingMap {
  [address: string]: ITokenSetting;
}

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
  pinnedChain: string[];

  tokenApprovalChain: Record<string, CHAINS_ENUM>;
  nftApprovalChain: Record<string, CHAINS_ENUM>;
  sendLogTime?: number;
  lastSelectedGasTopUpChain?: Record<string, CHAINS_ENUM>;
  sendEnableTime?: number;
  customizedToken?: Token[];
  blockedToken?: Token[];
  tokenManageSettingMap: ITokenManageSettingMap;
  collectionStarred?: Token[];
  /**
   * auto lock time in minutes
   */
  autoLockTime?: number;
  hiddenBalance?: boolean;
  isShowTestnet?: boolean;
  // themeMode?: DARK_MODE_TYPE;
  addressSortStore: AddressSortStore;
  isInvited?: boolean;
  /**
   *  The unique visitor ID
   */
  extensionId?: string;

  /**
   * For Send, Swap, Bridge, etc， default is first account in the account list
   */
  lastUsedAccount?: Account;

  /**
   * For temporary account switch
   */
  tempCurrentAccount?: Account;
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
  keyringService: KeyringService;
  sessionService: import('./session').SessionService;
  // globalSerivceEvents: typeof import('../apis/serviceEvent').globalSerivceEvents;

  constructor(
    options: StorageAdapaterOptions & {
      keyringService: KeyringService;
      sessionService: import('./session').SessionService;
    },
  ) {
    const defaultLang = 'en';
    this.keyringService = options.keyringService;
    this.sessionService = options.sessionService;
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
          pinnedChain: [],
          tokenApprovalChain: {},
          nftApprovalChain: {},
          sendLogTime: 0,
          sendEnableTime: 0,
          customizedToken: [],
          blockedToken: [],
          collectionStarred: [],
          hiddenBalance: false,
          isShowTestnet: false,
          autoLockTime: DEFAULT_AUTO_LOCK_MINUTES,
          // themeMode: DARK_MODE_TYPE.light,
          addressSortStore: {
            ...defaultAddressSortStore,
          },
          isInvited: false,
          lastUsedAccount: undefined,
          tempCurrentAccount: undefined,
          tokenManageSettingMap: {},
        },
      },
      {
        storage: options?.storageAdapter,
      },
    );

    // reset current account if app not closed properly
    if (this.store.tempCurrentAccount) {
      this.store.currentAccount = this.store.tempCurrentAccount;
    }
  }

  /* eslint-disable no-dupe-class-members */
  getPreference(): PreferenceStore;
  getPreference<T extends keyof PreferenceStore>(key: T): PreferenceStore[T];
  getPreference(key?: keyof PreferenceStore) {
    if (!key || ['search', 'lastCurrent'].includes(key)) {
      this.resetAddressSortStoreExpiredValue();
    }
    return key ? this.store[key as any] : this.store;
  }
  /* enable-enable no-dupe-class-members */

  setPreference = (params: Partial<PreferenceStore>) => {
    Object.assign(this.store, params);
  };

  getTokenApprovalChain = (address: string) => {
    const key = address.toLowerCase();
    return this.store.tokenApprovalChain[key] || CHAINS_ENUM.ETH;
  };

  setTokenApprovalChain = (address: string, chain: CHAINS_ENUM) => {
    const key = address.toLowerCase();
    this.store.tokenApprovalChain = {
      ...this.store.tokenApprovalChain,
      [key]: chain,
    };
  };

  getNFTApprovalChain = (address: string) => {
    const key = address.toLowerCase();
    return this.store.nftApprovalChain[key] || CHAINS_ENUM.ETH;
  };

  setNFTApprovalChain = (address: string, chain: CHAINS_ENUM) => {
    const key = address.toLowerCase();
    this.store.nftApprovalChain = {
      ...this.store.nftApprovalChain,
      [key]: chain,
    };
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
    const [account] = await this.keyringService.getAllVisibleAccountsArray();
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
      this.sessionService.broadcastEvent(BroadcastEvent.accountsChanged, [
        account.address.toLowerCase(),
      ]);
      appServiceEvents.emit('currentAccountChanged', account);
    }
  };

  getLastUsedAccount = async (): Promise<Account> => {
    const account = cloneDeep(this.store.lastUsedAccount);
    if (account) {
      return account;
    }
    // TODO: 排序
    // return the first account in the account list
    const [first] = await this.keyringService.getAllVisibleAccountsArray();

    return first;
  };

  setLastUsedAccount = (account: Account) => {
    this.store.lastUsedAccount = account;
  };

  activateLastUsedAccount = async () => {
    const prevAccount = this.getCurrentAccount();

    if (prevAccount) {
      this.store.tempCurrentAccount = prevAccount;
    }

    const account = await this.getLastUsedAccount();
    // console.debug('[LastUsedAccount] activate', account);
    this.setCurrentAccount(account);
  };

  inactivateLastUsedAccount = () => {
    const tempAccount = this.store.tempCurrentAccount;

    // console.debug('[LastUsedAccount] restore', tempAccount);
    if (tempAccount) {
      this.setCurrentAccount(tempAccount);
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
      return token;
    }
    return null;
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

  /** =========toggle pinToken start =========== */
  pinToken = (_address: string, token: IManageToken) => {
    const address = _address.toLowerCase();
    const preMap = this.store.tokenManageSettingMap;
    const preSetting = preMap[address];
    if (!preSetting) {
      this.store.tokenManageSettingMap = {
        ...preMap,
        [address]: {
          pinedQueue: [token],
        },
      };
      return;
    }
    const pinedQueue = preSetting.pinedQueue || [];
    const exist = pinedQueue.find(
      item => item.chainId === token.chainId && item.tokenId === token.tokenId,
    );
    if (!exist) {
      const nextQueue = [token, ...pinedQueue];
      const nextMap = {
        ...preMap,
        [address]: {
          ...preSetting,
          pinedQueue: nextQueue,
        },
      };
      this.store.tokenManageSettingMap = nextMap;
      this.manualUnFoldToken(address, token, nextMap);
    }
  };
  removePinedToken = (
    _address: string,
    token: IManageToken,
    prePassMap?: ITokenManageSettingMap,
  ) => {
    const address = _address.toLowerCase();
    const preMap = prePassMap || this.store.tokenManageSettingMap;
    const preSetting = preMap[address];
    const pinedQueue = this.store.tokenManageSettingMap[address]?.pinedQueue;
    if (pinedQueue) {
      const exist = pinedQueue.find(
        item =>
          item.chainId === token.chainId && item.tokenId === token.tokenId,
      );
      if (exist) {
        const nextPinQueue = pinedQueue.filter(
          item =>
            item.chainId !== token.chainId || item.tokenId !== token.tokenId,
        );
        this.store.tokenManageSettingMap = {
          ...preMap,
          [address]: {
            ...preSetting,
            pinedQueue: nextPinQueue,
          },
        };
      }
    }
  };

  /** =========toggle pinToken end =========== */

  /** =========toggle fold token start =========== */
  manualFoldToken = (_address: string, token: IManageToken) => {
    const address = _address.toLowerCase();
    const preMap = this.store.tokenManageSettingMap;
    const preSetting = preMap[address];
    if (!preSetting) {
      this.store.tokenManageSettingMap = {
        ...preMap,
        [address]: {
          foldTokens: [token],
        },
      };
      return;
    }
    const preFoldedTokens = preSetting?.foldTokens || [];
    const preUnFoldedToken = preSetting.unfoldTokens || [];

    const exist = preFoldedTokens.find(
      item => item.chainId === token.chainId && item.tokenId === token.tokenId,
    );
    if (!exist) {
      const nextMap = {
        ...preMap,
        [address]: {
          ...preSetting,
          foldTokens: [...preFoldedTokens, token],
          unfoldTokens: preUnFoldedToken.filter(
            item =>
              item.chainId !== token.chainId || item.tokenId !== token.tokenId,
          ),
        },
      };
      this.store.tokenManageSettingMap = nextMap;
      this.removePinedToken(address, token, nextMap);
    }
  };
  manualUnFoldToken = (
    _address: string,
    token: IManageToken,
    prePassMap?: ITokenManageSettingMap,
  ) => {
    const address = _address.toLowerCase();
    const preMap = prePassMap || this.store.tokenManageSettingMap;
    const preSetting = preMap[address];
    if (!preSetting) {
      this.store.tokenManageSettingMap = {
        ...preMap,
        [address]: {
          unfoldTokens: [token],
        },
      };
      return;
    }
    const preFoldedTokens = preSetting?.foldTokens || [];
    const preUnFoldedToken = preSetting.unfoldTokens || [];

    const exist = preUnFoldedToken.find(
      item => item.chainId === token.chainId && item.tokenId === token.tokenId,
    );
    if (!exist) {
      this.store.tokenManageSettingMap = {
        ...preMap,
        [address]: {
          ...preSetting,
          unfoldTokens: [...preUnFoldedToken, token],
          foldTokens: preFoldedTokens.filter(
            item =>
              item.chainId !== token.chainId || item.tokenId !== token.tokenId,
          ),
        },
      };
    }
  };
  /** =========toggle fold token end =========== */

  /** =========toggle include or exclude token start =========== */
  includeBalanceToken = (_address: string, item: IDefiOrToken) => {
    const address = _address.toLowerCase();
    const preMap = this.store.tokenManageSettingMap;
    const preSetting = preMap[address];
    if (!preSetting) {
      this.store.tokenManageSettingMap = {
        ...preMap,
        [address]: {
          includeDefiAndTokens: [item],
        },
      };
      return;
    }
    const preIncludeDefiAndToken = preSetting?.includeDefiAndTokens || [];
    const preExcludeDefiAndToken = preSetting?.excludeDefiAndTokens || [];

    const exist = preIncludeDefiAndToken.find(
      i =>
        i.chainid === item.chainid && i.id === item.id && i.type === item.type,
    );
    if (!exist) {
      this.store.tokenManageSettingMap = {
        ...preMap,
        [address]: {
          ...preSetting,
          includeDefiAndTokens: [...preIncludeDefiAndToken, item],
          excludeDefiAndTokens: preExcludeDefiAndToken.filter(
            i =>
              i.chainid !== item.chainid ||
              i.id !== item.id ||
              i.type !== item.type,
          ),
        },
      };
    }
  };
  excludeBalance = (_address: string, item: IDefiOrToken) => {
    const address = _address.toLowerCase();
    const preMap = this.store.tokenManageSettingMap;
    const preSetting = preMap[address];
    if (!preSetting) {
      this.store.tokenManageSettingMap = {
        ...preMap,
        [address]: {
          excludeDefiAndTokens: [item],
        },
      };
      return;
    }
    const preIncludeDefiAndToken = preSetting?.includeDefiAndTokens || [];
    const preExcludeDefiAndToken = preSetting?.excludeDefiAndTokens || [];

    const exist = preExcludeDefiAndToken.find(
      i =>
        i.chainid === item.chainid && i.id === item.id && i.type === item.type,
    );
    if (!exist) {
      this.store.tokenManageSettingMap = {
        ...preMap,
        [address]: {
          ...preSetting,
          excludeDefiAndTokens: [...preExcludeDefiAndToken, item],
          includeDefiAndTokens: preIncludeDefiAndToken.filter(
            i =>
              i.chainid !== item.chainid ||
              i.id !== item.id ||
              i.type !== item.type,
          ),
        },
      };
    }
  };
  /** =========toggle include or exclude token end =========== */

  getUserTokenSettings = async (address: string) => {
    return this.store.tokenManageSettingMap[address.toLowerCase()];
  };
}
