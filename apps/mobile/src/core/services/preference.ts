import cloneDeep from 'lodash/cloneDeep';
import { addressUtils } from '@rabby-wallet/base-utils';
import * as Sentry from '@sentry/react-native';

import i18n, { SupportedLang } from '@/utils/i18n';
import dayjs from 'dayjs';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { CHAINS_ENUM } from '@/constant/chains';
import createPersistStore, {
  StorageAdapaterOptions,
} from '@rabby-wallet/persist-store';
import { KeyringAccountWithAlias } from '@/hooks/account';
import { BroadcastEvent } from '@/constant/event';
import KeyringService from '@rabby-wallet/service-keyring';
import { DEFAULT_AUTO_LOCK_MINUTES } from '@/constant/autoLock';
import { appServiceEvents } from './_utils';
import { isNonPublicProductionEnv } from '@/constant';
import { APP_STORE_NAMES } from '@/core/storage/storeConstant';
import { reportActionStats } from '../utils/reportActionStats';
import { REPORT_TIMEOUT_ACTION_KEY } from './type';
import { EvmTotalBalanceResponse } from '@/databases/hooks/balance';
import { matomoRequestEvent } from '@/utils/analytics';
import { BALANCE_HIDE_TYPE } from '@/screens/Home/hooks/useHideBalance';

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
export interface Account extends KeyringAccountWithAlias {
  /**
   * @description property for HDKeyring and hardware keyring to indicate the index of the account
   */
  index?: number | undefined;
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

export type IManageToken = {
  chainId: string;
  tokenId: string;
};

export type IManageNft = {
  id: string;
  chain: string;
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
  foldNfts?: IManageNft[];
  unfoldNfts?: IManageNft[];
  foldDefis?: string[];
  unFoldDefis?: string[];
};

export interface ITokenManageSettingMap {
  [address: string]: {
    /** @deprecated will be migrated to store.pinedQueue */
    pinedQueue?: ITokenSetting['pinedQueue'];
    /** @deprecated will be migrated to store.foldTokens */
    foldTokens?: ITokenSetting['foldTokens'];
    /** @deprecated will be migrated to store.unfoldTokens */
    unfoldTokens?: ITokenSetting['unfoldTokens'];
    /** @deprecated will be migrated to store.includeDefiAndTokens */
    includeDefiAndTokens?: ITokenSetting['includeDefiAndTokens'];
    /** @deprecated will be migrated to store.excludeDefiAndTokens */
    excludeDefiAndTokens?: ITokenSetting['excludeDefiAndTokens'];
  };
}

export interface PreferenceStore {
  currentAccount: Account | undefined | null;
  addressAvatarMap: {
    [address: string]: string;
  };
  balanceMap: {
    [address: string]: EvmTotalBalanceResponse;
  };
  testnetBalanceMap: {
    [address: string]: EvmTotalBalanceResponse;
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
  hasOpenCopyTrading?: boolean;
  customizedToken?: Token[];
  blockedToken?: Token[];
  // manage token
  pinedQueue?: IManageToken[]; // maual always true
  foldTokens?: IManageToken[];
  unfoldTokens?: IManageToken[];
  includeDefiAndTokens?: IDefiOrToken[];
  excludeDefiAndTokens?: IDefiOrToken[];

  foldDefis?: string[];
  unFoldDefis?: string[];
  foldNfts?: IManageNft[];
  unFoldNfts?: IManageNft[];

  reportActionTsSet: Record<REPORT_TIMEOUT_ACTION_KEY, number>;
  currentReportActionStats: REPORT_TIMEOUT_ACTION_KEY;
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
  safeSelfHostConfirm?: Record<string, boolean>;
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
  /** 用户是否跳过了watchlist引导 */
  watchlistSkip?: boolean;

  lastReportTime?: number;

  balanceHideType?: BALANCE_HIDE_TYPE;

  currency?: string;

  hasShowAsterPopup: boolean;
  hasShowAsterReferralMap: Record<string, boolean>;

  hyperliquidInvite?: {
    lastTime?: number;
  };
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

export type SetCurrentAccountOptions = {
  needSyncToSession?: boolean;
};

export class PreferenceService {
  [x: string]: any;
  store!: PreferenceStore;
  keyringService: KeyringService;
  sessionService: import('./session').SessionService;
  // globalSerivceEvents: typeof import('../apis/serviceEvent').globalSerivceEvents;

  private _allowedToNotifyAccountsChanged = false;

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
        name: APP_STORE_NAMES.preference,
        template: {
          currentAccount: undefined,
          balanceMap: {},
          testnetBalanceMap: {},
          locale: defaultLang,
          lastTimeSendToken: {},
          pinAddresses: [],
          foldDefis: [],
          unFoldDefis: [],
          foldNfts: [],
          unFoldNfts: [],
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
          reportActionTsSet: {} as Record<REPORT_TIMEOUT_ACTION_KEY, number>,
          currentReportActionStats: REPORT_TIMEOUT_ACTION_KEY.NONE,
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
          safeSelfHostConfirm: {},
          addressAvatarMap: {},
          hasOpenCopyTrading: false,
          watchlistSkip: false,
          balanceHideType: BALANCE_HIDE_TYPE.SHOW,
          currency: 'USD',
          hasShowAsterReferralMap: {},
          hasShowAsterPopup: false,
          hyperliquidInvite: {
            lastTime: 0,
          },
        },
      },
      {
        storage: options?.storageAdapter,
        beforePersist(obj) {
          if (!obj) {
            const msg = `[preferenceService] preference set as nil value (${obj}), it's unexpected`;
            if (__DEV__) console.error(msg);
            Sentry.captureException(new Error(msg));
          }
        },
      },
    );
    // reset current account if app not closed properly
    if (this.store.tempCurrentAccount) {
      this.store.currentAccount = this.store.tempCurrentAccount;
    }
    if (!this.store.safeSelfHostConfirm) {
      this.store.safeSelfHostConfirm = {};
    }
  }

  setHasOpenCopyTrading = (value: boolean) => {
    this.store.hasOpenCopyTrading = value;
  };

  getHasOpenCopyTrading = () => {
    return this.store.hasOpenCopyTrading;
  };

  addAddressAvatar = (address: string, avatar: string) => {
    const key = address.toLowerCase();
    this.store.addressAvatarMap = {
      ...this.store.addressAvatarMap,
      [key]: avatar,
    };
  };

  removeAddressAvatar = (address: string) => {
    const key = address.toLowerCase();
    if (key in this.store.addressAvatarMap) {
      const map = this.store.addressAvatarMap;
      delete map[key];
      this.store.addressAvatarMap = map;
    }
  };

  getAddressAvatar = (address: string) => {
    const key = address.toLowerCase();
    return this.store.addressAvatarMap[key];
  };

  hasConfirmSafeSelfHost = (networkId: string) => {
    if (this.store.safeSelfHostConfirm?.[networkId]) {
      return true;
    }
    return false;
  };

  setConfirmSafeSelfHost = (networkId: string) => {
    if (!this.store.safeSelfHostConfirm) {
      this.store.safeSelfHostConfirm = {
        [networkId]: true,
      };
    } else {
      this.store.safeSelfHostConfirm[networkId] = true;
    }
  };

  /** @deprecated */
  _dangerouslySetTokenManageSettingMap(input: ITokenManageSettingMap) {
    // only allow use in non-production environment
    if (!isNonPublicProductionEnv) {
      return;
    }

    this.store.tokenManageSettingMap = input;
    console.warn(
      '[preference::_dangerouslySetTokenManageSettingMap] written tokenManageSettingMap',
      input,
    );
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

  setHasShowAsterPopup = (value: boolean) => {
    this.store.hasShowAsterPopup = value;
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

  /**
   * @deprecated use getFallbackAccount instead
   */
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

  getFallbackAccount = (): Account | null => {
    const account = cloneDeep(this.store.currentAccount);
    if (!account) {
      return null;
    }
    return {
      ...account,
      address: account.address.toLowerCase(),
    };
  };

  initCurrentAccount = async () => {
    if (!this.store.currentAccount) {
      return await this.resetCurrentAccount();
    }
  };

  /**
   *  @deprecated
   */
  toggleAllowNotifyAccountsChanged(allowed: boolean = false) {
    this._allowedToNotifyAccountsChanged = allowed;
  }

  private _notifyAccountsChanged(account: Account, doNotify: boolean = true) {
    if (this._allowedToNotifyAccountsChanged && doNotify) {
      this.sessionService.broadcastEvent(BroadcastEvent.accountsChanged, [
        account.address.toLowerCase(),
      ]);
      console.debug(
        '[PreferenceService::_notifyAccountsChanged] notify accountsChanged event',
        account,
      );
    } else if (__DEV__ && doNotify && !this._allowedToNotifyAccountsChanged) {
      console.error(
        "[PreferenceService::_notifyAccountsChanged] You're trying to notify accountsChanged event, but it's not allowed now!",
      );
    }
  }

  setCurrentAccount = (
    account?: Account | null,
    options?: SetCurrentAccountOptions,
  ) => {
    this.store.currentAccount = account ?? null;
    if (account) {
      // this._notifyAccountsChanged(account, !!options?.needSyncToSession);
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

  activateLastUsedAccount = async (options?: SetCurrentAccountOptions) => {
    const prevAccount = this.getCurrentAccount();

    if (prevAccount) {
      this.store.tempCurrentAccount = prevAccount;
    }

    const account = await this.getLastUsedAccount();
    // console.debug('[LastUsedAccount] activate', account);
    this.setCurrentAccount(account, options);
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
    data: EvmTotalBalanceResponse,
  ) => {
    const testnetBalanceMap = this.store.testnetBalanceMap || {};
    this.store.testnetBalanceMap = {
      ...testnetBalanceMap,
      [address.toLowerCase()]: data,
    };
  };

  updateAddressBalance = (address: string, data: EvmTotalBalanceResponse) => {
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

  getAddressBalance = (address: string): EvmTotalBalanceResponse | null => {
    const balanceMap = this.store.balanceMap || {};
    return balanceMap[address.toLowerCase()] || null;
  };

  getTestnetAddressBalance = (
    address: string,
  ): EvmTotalBalanceResponse | null => {
    const balanceMap = this.store.testnetBalanceMap || {};
    return balanceMap[address.toLowerCase()] || null;
  };

  getLocale = () => {
    return this.store.locale;
  };

  setLocale = (locale: string) => {
    this.store.locale = locale;
    i18n.changeLanguage(locale);
  };

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
    return cache ?? null;
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

  getReportActionTs = (key: REPORT_TIMEOUT_ACTION_KEY) => {
    return this.store.reportActionTsSet?.[key] || 0;
  };

  getReportActionTimeout = (
    from: REPORT_TIMEOUT_ACTION_KEY,
    to: REPORT_TIMEOUT_ACTION_KEY,
  ) => {
    if (
      this.store.reportActionTsSet?.[to] &&
      this.store.reportActionTsSet?.[from] &&
      this.store.reportActionTsSet?.[to] > this.store.reportActionTsSet?.[from]
    ) {
      return (
        this.store.reportActionTsSet[to] - this.store.reportActionTsSet[from]
      );
    }

    return 0;
  };

  setReportActionTs = (
    key: REPORT_TIMEOUT_ACTION_KEY,
    reportExtra?: Record<string, string> | undefined,
  ) => {
    try {
      const ts = Date.now();
      this.store.reportActionTsSet = {
        ...this.store.reportActionTsSet,
        [key]: ts,
      };

      const beforeKey = this.store.currentReportActionStats;
      if (key === beforeKey) {
        return;
      }

      // report stats
      reportActionStats(this, key, beforeKey, reportExtra);

      this.store.currentReportActionStats = key;
    } catch (error) {
      console.error('[PreferenceService] setReportActionTs error', error);
    }
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

  setAutoLockExpireTime = (time: number) => {
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

  setWatchlistSkip = (value: boolean) => {
    this.store.watchlistSkip = value;
  };

  getWatchlistSkip = () => {
    return !!this.store.watchlistSkip;
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

  getPinToken = () => {
    return this.store.pinedQueue || [];
  };

  /** =========toggle pinToken start =========== */
  pinToken = (token: IManageToken) => {
    if (!this.store.pinedQueue) {
      this.store.pinedQueue = [token];
    }
    const pinedQueue = this.store.pinedQueue;
    const exist = pinedQueue.find(
      item => item.chainId === token.chainId && item.tokenId === token.tokenId,
    );
    if (!exist) {
      this.store.pinedQueue = [token, ...pinedQueue];
      // this.manualUnFoldToken(token);
      matomoRequestEvent({
        category: 'Watchlist Usage',
        action: 'Watchlist_StarToken',
        label: `${token.chainId}_${token.tokenId}`,
      });
    }
  };
  removePinedToken = (token: IManageToken) => {
    if (this.store.pinedQueue?.length) {
      this.store.pinedQueue = this.store.pinedQueue.filter(
        item =>
          item.chainId !== token.chainId || item.tokenId !== token.tokenId,
      );
    }
  };

  /** =========toggle pinToken end =========== */

  /** =========toggle fold token start =========== */
  manualFoldToken = (token: IManageToken) => {
    const preFoldedTokens = this.store.foldTokens || [];
    const preUnFoldedToken = this.store.unfoldTokens || [];

    const exist = preFoldedTokens.find(
      item => item.chainId === token.chainId && item.tokenId === token.tokenId,
    );
    if (!exist) {
      this.store.foldTokens = [...preFoldedTokens, token];
      this.store.unfoldTokens = preUnFoldedToken.filter(
        item =>
          item.chainId !== token.chainId || item.tokenId !== token.tokenId,
      );
      // this.removePinedToken(token);
    }
  };
  manualUnFoldToken = (token: IManageToken) => {
    const preFoldedTokens = this.store.foldTokens || [];
    const preUnFoldedToken = this.store.unfoldTokens || [];

    const exist = preUnFoldedToken.find(
      item => item.chainId === token.chainId && item.tokenId === token.tokenId,
    );
    if (!exist) {
      this.store.unfoldTokens = [...preUnFoldedToken, token];
      this.store.foldTokens = preFoldedTokens.filter(
        item =>
          item.chainId !== token.chainId || item.tokenId !== token.tokenId,
      );
    }
  };
  /** =========toggle fold token end =========== */

  /** =========toggle include or exclude token start =========== */
  includeBalanceToken = (item: IDefiOrToken) => {
    const preIncludeDefiAndToken = this.store?.includeDefiAndTokens || [];
    const preExcludeDefiAndToken = this.store?.excludeDefiAndTokens || [];

    const exist = preIncludeDefiAndToken.find(
      i =>
        i.chainid === item.chainid && i.id === item.id && i.type === item.type,
    );
    if (!exist) {
      this.store.includeDefiAndTokens = [...preIncludeDefiAndToken, item];
      this.store.excludeDefiAndTokens = preExcludeDefiAndToken.filter(
        i =>
          i.chainid !== item.chainid ||
          i.id !== item.id ||
          i.type !== item.type,
      );
    }
  };
  excludeBalance = (item: IDefiOrToken) => {
    const preIncludeDefiAndToken = this.store?.includeDefiAndTokens || [];
    const preExcludeDefiAndToken = this.store?.excludeDefiAndTokens || [];

    const exist = preExcludeDefiAndToken.find(
      i =>
        i.chainid === item.chainid && i.id === item.id && i.type === item.type,
    );
    if (!exist) {
      this.store.excludeDefiAndTokens = [...preExcludeDefiAndToken, item];
      this.store.includeDefiAndTokens = preIncludeDefiAndToken.filter(
        i =>
          i.chainid !== item.chainid ||
          i.id !== item.id ||
          i.type !== item.type,
      );
    }
  };
  /** =========toggle include or exclude token end =========== */

  manualFoldNft = (nft: IManageNft) => {
    const preFoldedNfts = this.store.foldNfts || [];
    const preUnFoldNfts = this.store.unFoldNfts || [];

    const exist = preFoldedNfts.find(
      item => item.chain === nft.chain && item.id === nft.chain,
    );
    if (!exist) {
      this.store.foldNfts = [...preFoldedNfts, nft];
      this.store.unFoldNfts = preUnFoldNfts.filter(
        item => item.chain !== nft.chain || item.id !== nft.id,
      );
    }
  };
  manualUnFoldNft = (nft: IManageNft) => {
    const preUnFoldNfts = this.store.unFoldNfts || [];
    const preFoldedNfts = this.store.foldNfts || [];

    const exist = preUnFoldNfts.find(
      item => item.chain === nft.chain && item.id === nft.chain,
    );
    if (!exist) {
      this.store.unFoldNfts = [...preUnFoldNfts, nft];
      this.store.foldNfts = preFoldedNfts.filter(
        item => item.chain !== nft.chain || item.id !== nft.id,
      );
    }
  };

  manualFoldDefi = (defiId: string) => {
    const preFoldDefis = this.store.foldDefis || [];
    const preUnFoldDefis = this.store.unFoldDefis || [];
    const exist = preFoldDefis.includes(defiId);
    if (!exist) {
      this.store.foldDefis = [...preFoldDefis, defiId];
      this.store.unFoldDefis = preUnFoldDefis.filter(item => item !== defiId);
    }
  };

  manualUnFoldDefi = (defiId: string) => {
    const preUnFoldDefis = this.store.unFoldDefis || [];
    const preFoldDefis = this.store.foldDefis || [];
    const exist = preUnFoldDefis.includes(defiId);
    if (!exist) {
      this.store.unFoldDefis = [...preUnFoldDefis, defiId];
      this.store.foldDefis = preFoldDefis.filter(item => item !== defiId);
    }
  };

  /** @deprecated use getUserTokenSettingsSync as possible */
  getUserTokenSettings = async () => {
    return this.getUserTokenSettingsSync();
  };

  getUserTokenSettingsSync = () => {
    return {
      foldTokens: [],
      unfoldTokens: [],
      includeDefiAndTokens: [],
      excludeDefiAndTokens: [],
      pinedQueue: this.store.pinedQueue || [],
      foldNfts: this.store.foldNfts || [],
      unfoldNfts: this.store.unFoldNfts || [],
      foldDefis: [],
      // foldDefis: this.store.foldDefis || [],
      unFoldDefis: [],
      // unFoldDefis: this.store.unFoldDefis || [],
    };
  };
}
