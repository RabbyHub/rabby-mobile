import cloneDeep from 'lodash/cloneDeep';
import { addressUtils } from '@rabby-wallet/base-utils';

import i18n, { SupportedLang } from '@/utils/i18n';
import dayjs from 'dayjs';
import type { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { CHAINS_ENUM } from '@/constant/chains';
import {
  StorageAdapaterOptions,
  StoreServiceBase,
} from '@rabby-wallet/persist-store';
import type { Account, IPinAddress } from '@/types/account';
import { DEFAULT_AUTO_LOCK_MINUTES } from '@/constant/autoLock';
import { appServiceEvents } from '@/core/events/appServiceEvents';
import { isNonPublicProductionEnv } from '@/constant';
import { APP_STORE_NAMES } from '@/core/storage/storeConstant';
import { REPORT_TIMEOUT_ACTION_KEY } from '@/core/utils/reportTimeoutAction';
import { BALANCE_HIDE_TYPE } from '@/constant/balanceHide';
import {
  resolveDefaultUserBehaviorTrackingOptOut,
  setUserBehaviorTrackingOptOutCache,
  USER_BEHAVIOR_TRACKING_OPT_OUT_KEY,
} from '@/utils/trackingOptOut';
import type {
  IDefiOrToken,
  IManageNft,
  IManageToken,
  ITokenManageSettingMap,
  Token,
  TokenDisplayMode,
} from '@/types/assets';

export type { Account, IPinAddress } from '@/types/account';
export type {
  IDefiOrToken,
  IManageNft,
  IManageToken,
  ITokenManageSettingMap,
  ITokenSetting,
  Token,
  TokenDisplayMode,
} from '@/types/assets';

const { isSameAddress } = addressUtils;

function capturePreferenceException(error: Error) {
  void import('@sentry/react-native')
    .then(Sentry => {
      Sentry.captureException(error);
    })
    .catch(() => undefined);
}

function syncUserBehaviorTrackingSdkOptOut() {
  void import('@/utils/analytics')
    .then(({ syncFirebaseAnalyticsCollectionWithOptOut }) =>
      syncFirebaseAnalyticsCollectionWithOptOut(),
    )
    .catch(error => {
      if (__DEV__) {
        console.error(
          '[PreferenceService] syncFirebaseAnalyticsCollectionWithOptOut error',
          error,
        );
      }
    });

  void import('@/core/sentry')
    .then(({ syncSentryUserBehaviorTrackingEnabled }) =>
      syncSentryUserBehaviorTrackingEnabled(),
    )
    .catch(error => {
      if (__DEV__) {
        console.error(
          '[PreferenceService] syncSentryUserBehaviorTrackingEnabled error',
          error,
        );
      }
    });
}

function reportMatomoWatchlistStarToken(token: IManageToken) {
  void import('@/utils/analytics')
    .then(({ matomoRequestEvent }) => {
      matomoRequestEvent({
        category: 'Watchlist Usage',
        action: 'Watchlist_StarToken',
        label: `${token.chainId}_${token.tokenId}`,
      });
    })
    .catch(error => {
      if (__DEV__) {
        console.error('[PreferenceService] matomoRequestEvent error', error);
      }
    });
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

export interface PreferenceStore {
  /** Legacy fields removed during hydration. */
  balanceMap?: unknown;
  testnetBalanceMap?: unknown;
  currentAccount: Account | undefined | null;
  addressAvatarMap: {
    [address: string]: string;
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
  /**
   * Last successful wallet unlock/authentication timestamp.
   */
  lastUnlockTime?: number;
  /**
   * Expire timestamp for the current unlock session. -1 means never expire.
   */
  unlockSessionExpireTime?: number;
  /**
   * Disable post-unlock session reuse on app launch. Existing full-unlock
   * behavior remains unchanged.
   */
  appLaunchLock?: boolean;
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
   * When true, user behavior tracking is disabled for festats, GA, Matomo,
   * and Sentry.
   */
  [USER_BEHAVIOR_TRACKING_OPT_OUT_KEY]: boolean;

  /**
   * For Send, Swap, Bridge, etc， default is first account in the account list
   */
  lastUsedAccount?: Account;

  /**
   * For temporary account switch
   */
  tempCurrentAccount?: Account;
  /** 用户是否跳过了watchlist引导 */
  watchlistSkipV2?: boolean;

  lastReportTime?: number;

  balanceHideType?: BALANCE_HIDE_TYPE;

  currency?: string;
  tokenDisplayMode?: TokenDisplayMode;

  hasShowAsterPopup: boolean;
  hasShowAsterReferralMap: Record<string, boolean>;

  hyperliquidInvite?: {
    lastTime?: number;
  };

  enabledTransactionNofification?: boolean;

  /**
   * Whether the wallet password was auto-generated during biometric-only onboarding.
   * When true, the user has no manually-set password and needs one if biometrics is disabled.
   */
  passwordIsAutoGenerated?: boolean;

  /**
   * Map of basePublicKey to backup reminder state
   * Stores seed phrases that need backup reminder (created via "Create New Wallet")
   * All addresses from the same seed phrase share the same basePublicKey,
   * so backing up one address marks all addresses from that seed phrase as backed up.
   */
  needsBackupReminderMap: Record<string, boolean>;
}

export type PreferenceTokenSettingsMigration = Partial<
  Pick<
    PreferenceStore,
    | 'pinedQueue'
    | 'foldTokens'
    | 'unfoldTokens'
    | 'includeDefiAndTokens'
    | 'excludeDefiAndTokens'
    | 'tokenManageSettingMap'
  >
>;

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

type PreferenceServiceOptions = StorageAdapaterOptions & {
  getAllVisibleAccountsArray?: () => Promise<Account[]>;
};

export class PreferenceService extends StoreServiceBase<
  PreferenceStore,
  APP_STORE_NAMES.preference
> {
  private _allowedToNotifyAccountsChanged = false;

  private getAllVisibleAccountsArray: () => Promise<Account[]>;

  constructor(options: PreferenceServiceOptions) {
    const defaultLang = 'en';
    const storedPreference = options.storageAdapter?.getItem(
      APP_STORE_NAMES.preference,
    ) as Partial<PreferenceStore> | null | undefined;
    const userBehaviorTrackingOptOut =
      resolveDefaultUserBehaviorTrackingOptOut(storedPreference);

    super(
      APP_STORE_NAMES.preference,
      {
        currentAccount: undefined,
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
        lastUnlockTime: 0,
        unlockSessionExpireTime: 0,
        appLaunchLock: false,
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
        watchlistSkipV2: false,
        balanceHideType: BALANCE_HIDE_TYPE.SHOW,
        currency: 'USD',
        tokenDisplayMode: 'byAddress',
        hasShowAsterReferralMap: {},
        hasShowAsterPopup: false,
        hyperliquidInvite: {
          lastTime: 0,
        },
        enabledTransactionNofification: false,
        passwordIsAutoGenerated: false,
        needsBackupReminderMap: {},
        userBehaviorTrackingOptOut,
      },
      {
        storageAdapter: options?.storageAdapter,
        beforePersist(obj) {
          if (!obj) {
            const msg = `[preferenceService] preference set as nil value (${obj}), it's unexpected`;
            if (__DEV__) console.error(msg);
            capturePreferenceException(new Error(msg));
          }
        },
      },
    );

    this.getAllVisibleAccountsArray =
      options.getAllVisibleAccountsArray || (() => Promise.resolve([]));

    this.mutateStore(draft => {
      delete draft.balanceMap;
      delete draft.testnetBalanceMap;
      // Reset current account if the app did not close cleanly.
      if (draft.tempCurrentAccount) {
        draft.currentAccount = draft.tempCurrentAccount;
      }
      draft.safeSelfHostConfirm ||= {};
    });
    this._syncUserBehaviorTrackingOptOut(this.store.userBehaviorTrackingOptOut);
  }

  private _syncUserBehaviorTrackingOptOut(value: boolean) {
    setUserBehaviorTrackingOptOutCache(value);
    syncUserBehaviorTrackingSdkOptOut();
  }

  getPreferenceByKey<T extends keyof PreferenceStore>(
    key: T,
  ): PreferenceStore[T] {
    return cloneDeep(this.store[key]) as PreferenceStore[T];
  }

  setPreferenceByKey<T extends keyof PreferenceStore>(
    key: T,
    value: PreferenceStore[T],
  ) {
    if (key === USER_BEHAVIOR_TRACKING_OPT_OUT_KEY) {
      this._syncUserBehaviorTrackingOptOut(value !== false);
    }
    this.mutateStore(draft => {
      draft[key] = value;
    });
  }

  setHasOpenCopyTrading = (value: boolean) => {
    this.mutateStore(draft => {
      draft.hasOpenCopyTrading = value;
    });
  };

  getHasOpenCopyTrading = () => {
    return this.store.hasOpenCopyTrading;
  };

  getTokenDisplayMode = (): TokenDisplayMode => {
    return this.store.tokenDisplayMode || 'byAddress';
  };

  setTokenDisplayMode = (mode: TokenDisplayMode) => {
    this.mutateStore(draft => {
      draft.tokenDisplayMode = mode;
    });
  };

  addAddressAvatar = (address: string, avatar: string) => {
    const key = address.toLowerCase();
    this.mutateStore(draft => {
      draft.addressAvatarMap[key] = avatar;
    });
  };

  removeAddressAvatar = (address: string) => {
    const key = address.toLowerCase();
    if (key in this.store.addressAvatarMap) {
      this.mutateStore(draft => {
        delete draft.addressAvatarMap[key];
      });
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
    this.mutateStore(draft => {
      draft.safeSelfHostConfirm ||= {};
      draft.safeSelfHostConfirm[networkId] = true;
    });
  };

  /**
   * Check if a seed phrase needs backup reminder
   * @param basePublicKey - The keyring's base public key (unique per seed phrase)
   */
  getNeedsBackupReminder = (basePublicKey: string): boolean => {
    return this.store.needsBackupReminderMap[basePublicKey] ?? false;
  };

  /**
   * Set backup reminder state for a seed phrase
   * @param basePublicKey - The keyring's base public key
   * @param needsReminder - Whether the seed phrase needs backup reminder
   */
  setNeedsBackupReminder = (basePublicKey: string, needsReminder: boolean) => {
    this.mutateStore(draft => {
      draft.needsBackupReminderMap[basePublicKey] = needsReminder;
    });
    appServiceEvents.emit('backupReminderChanged', basePublicKey);
  };

  /**
   * Clear backup reminder for a seed phrase (e.g., after successful backup)
   * This clears the reminder for all addresses from the same seed phrase.
   * @param basePublicKey - The keyring's base public key
   */
  clearNeedsBackupReminder = (basePublicKey: string) => {
    if (basePublicKey in this.store.needsBackupReminderMap) {
      this.mutateStore(draft => {
        delete draft.needsBackupReminderMap[basePublicKey];
      });
      appServiceEvents.emit('backupReminderChanged', basePublicKey);
    }
  };

  /** @deprecated */
  _dangerouslySetTokenManageSettingMap(input: ITokenManageSettingMap) {
    // only allow use in non-production environment
    if (!isNonPublicProductionEnv) {
      return;
    }

    this.mutateStore(draft => {
      draft.tokenManageSettingMap = input;
    });
    console.warn(
      '[preference::_dangerouslySetTokenManageSettingMap] written tokenManageSettingMap',
      input,
    );
  }

  applyTokenSettingsMigration(settings: PreferenceTokenSettingsMigration) {
    this.mutateStore(draft => {
      Object.assign(draft, settings);
    });
  }

  /* eslint-disable no-dupe-class-members */
  getPreference(): PreferenceStore;
  getPreference<T extends keyof PreferenceStore>(key: T): PreferenceStore[T];
  getPreference(key?: keyof PreferenceStore) {
    if (!key || ['search', 'lastCurrent'].includes(key)) {
      this.resetAddressSortStoreExpiredValue();
    }
    return key ? cloneDeep(this.store[key]) : cloneDeep(this.store);
  }
  /* enable-enable no-dupe-class-members */

  setPreference = (params: Partial<PreferenceStore>) => {
    this.mutateStore(draft => {
      Object.assign(draft, params);
    });
    if (typeof params.userBehaviorTrackingOptOut === 'boolean') {
      this._syncUserBehaviorTrackingOptOut(params.userBehaviorTrackingOptOut);
    }
  };

  getUserBehaviorTrackingOptOut = () => {
    return this.store.userBehaviorTrackingOptOut;
  };

  setUserBehaviorTrackingOptOut = (value: boolean) => {
    this._syncUserBehaviorTrackingOptOut(value);
    this.mutateStore(draft => {
      draft.userBehaviorTrackingOptOut = value;
    });
  };

  getTokenApprovalChain = (address: string) => {
    const key = address.toLowerCase();
    return this.store.tokenApprovalChain[key] || CHAINS_ENUM.ETH;
  };

  setHasShowAsterPopup = (value: boolean) => {
    this.mutateStore(draft => {
      draft.hasShowAsterPopup = value;
    });
  };

  setTokenApprovalChain = (address: string, chain: CHAINS_ENUM) => {
    const key = address.toLowerCase();
    this.mutateStore(draft => {
      draft.tokenApprovalChain[key] = chain;
    });
  };

  getNFTApprovalChain = (address: string) => {
    const key = address.toLowerCase();
    return this.store.nftApprovalChain[key] || CHAINS_ENUM.ETH;
  };

  setNFTApprovalChain = (address: string, chain: CHAINS_ENUM) => {
    const key = address.toLowerCase();
    this.mutateStore(draft => {
      draft.nftApprovalChain[key] = chain;
    });
  };

  getLastTimeSendToken = (address: string) => {
    const key = address.toLowerCase();
    return this.getStoreFieldSnapshot('lastTimeSendToken')[key];
  };

  setLastTimeSendToken = (address: string, token: TokenItem) => {
    const key = address.toLowerCase();
    this.mutateStore(draft => {
      draft.lastTimeSendToken[key] = token;
    });
  };

  getLastSelectedGasTopUpChain = (address: string) => {
    const key = address.toLowerCase();
    return this.store?.lastSelectedGasTopUpChain?.[key];
  };

  setLastSelectedGasTopUpChain = (address: string, chain: CHAINS_ENUM) => {
    const key = address.toLowerCase();
    this.mutateStore(draft => {
      draft.lastSelectedGasTopUpChain ||= {};
      draft.lastSelectedGasTopUpChain[key] = chain;
    });
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
    const [account] = await this.getAllVisibleAccountsArray();
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
    this.mutateStore(draft => {
      draft.currentAccount = account ?? null;
    });
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
    const [first] = await this.getAllVisibleAccountsArray();

    return first!;
  };

  setLastUsedAccount = (account: Account) => {
    this.mutateStore(draft => {
      draft.lastUsedAccount = account;
    });
  };

  activateLastUsedAccount = async (options?: SetCurrentAccountOptions) => {
    const prevAccount = this.getCurrentAccount();

    if (prevAccount) {
      this.mutateStore(draft => {
        draft.tempCurrentAccount = prevAccount;
      });
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

  getLocale = () => {
    return this.store.locale;
  };

  setLocale = (locale: string) => {
    this.mutateStore(draft => {
      draft.locale = locale;
    });
    i18n.changeLanguage(locale);
  };

  // getThemeMode = () => {
  //   return this.store.themeMode;
  // };

  // setThemeMode = (themeMode: DARK_MODE_TYPE) => {
  //   this.store.themeMode = themeMode;
  // };

  getPinAddresses = () => {
    return cloneDeep(
      (this.store.pinAddresses || []).filter(
        item => !!item.brandName && !!item.address,
      ),
    );
  };
  updatePinAddresses = (list: IPinAddress[]) => {
    this.mutateStore(draft => {
      draft.pinAddresses = list;
    });
  };

  removePinAddress = (item: IPinAddress) => {
    this.mutateStore(draft => {
      draft.pinAddresses = draft.pinAddresses.filter(
        highlighted =>
          !(
            isSameAddress(highlighted.address, item.address) &&
            highlighted.brandName === item.brandName
          ),
      );
    });
  };

  getLastTimeGasSelection = (chainId: keyof GasCache): ChainGas | null => {
    const cache = this.store.gasCache[chainId];
    return cache ?? null;
  };

  updateLastTimeGasSelection = (chainId: keyof GasCache, gas: ChainGas) => {
    this.mutateStore(draft => {
      if (gas.lastTimeSelect === 'gasPrice') {
        draft.gasCache[chainId] = {
          ...draft.gasCache[chainId],
          ...gas,
          expireAt: Date.now() + 3600000, // custom gasPrice will expire at 1h later
        };
      } else {
        draft.gasCache[chainId] = {
          ...draft.gasCache[chainId],
          ...gas,
        };
      }
    });
  };

  getCustomizedToken = () => {
    return cloneDeep(this.store.customizedToken || []);
  };
  addCustomizedToken = (token: Token) => {
    if (
      !this.store.customizedToken?.find(
        item =>
          isSameAddress(item.address, token.address) &&
          item.chain === token.chain,
      )
    ) {
      this.mutateStore(draft => {
        draft.customizedToken ||= [];
        draft.customizedToken.push(token);
      });
      return token;
    }
    return null;
  };
  removeCustomizedToken = (token: Token) => {
    this.mutateStore(draft => {
      draft.customizedToken = draft.customizedToken?.filter(
        item =>
          !(
            isSameAddress(item.address, token.address) &&
            item.chain === token.chain
          ),
      );
    });
  };
  getBlockedToken = () => {
    return cloneDeep(this.store.blockedToken || []);
  };
  addBlockedToken = (token: Token) => {
    if (
      !this.store.blockedToken?.find(
        item =>
          isSameAddress(item.address, token.address) &&
          item.chain === token.chain,
      )
    ) {
      this.mutateStore(draft => {
        draft.blockedToken ||= [];
        draft.blockedToken.push(token);
      });
    }
  };
  removeBlockedToken = (token: Token) => {
    this.mutateStore(draft => {
      draft.blockedToken = draft.blockedToken?.filter(
        item =>
          !(
            isSameAddress(item.address, token.address) &&
            item.chain === token.chain
          ),
      );
    });
  };
  getCollectionStarred = () => {
    return cloneDeep(this.store.collectionStarred || []);
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
      const beforeKey = this.store.currentReportActionStats;
      this.mutateStore(draft => {
        draft.reportActionTsSet[key] = ts;
        if (key !== beforeKey) {
          draft.currentReportActionStats = key;
        }
      });
      if (key === beforeKey) {
        return;
      }

      // report stats
      void import('../utils/reportActionStats')
        .then(({ reportActionStats }) => {
          reportActionStats(this, key, beforeKey, reportExtra);
        })
        .catch(error => {
          if (__DEV__) {
            console.error('[PreferenceService] reportActionStats error', error);
          }
        });
    } catch (error) {
      console.error('[PreferenceService] setReportActionTs error', error);
    }
  };

  setPasswordIsAutoGenerated = (value: boolean) => {
    this.mutateStore(draft => {
      draft.passwordIsAutoGenerated = value;
    });
  };

  addCollectionStarred = (token: Token) => {
    if (
      !this.store.collectionStarred?.find(
        item =>
          isSameAddress(item.address, token.address) &&
          item.chain === token.chain,
      )
    ) {
      this.mutateStore(draft => {
        draft.collectionStarred ||= [];
        draft.collectionStarred.push(token);
      });
    }
  };
  removeCollectionStarred = (token: Token) => {
    this.mutateStore(draft => {
      draft.collectionStarred = draft.collectionStarred?.filter(
        item =>
          !(
            isSameAddress(item.address, token.address) &&
            item.chain === token.chain
          ),
      );
    });
  };

  getSendLogTime = () => {
    return this.store.sendLogTime || 0;
  };
  updateSendLogTime = (time: number) => {
    this.mutateStore(draft => {
      draft.sendLogTime = time;
    });
  };
  getSendEnableTime = () => {
    return this.store.sendEnableTime || 0;
  };
  updateSendEnableTime = (time: number) => {
    this.mutateStore(draft => {
      draft.sendEnableTime = time;
    });
  };

  setAutoLockExpireTime = (time: number) => {
    this.mutateStore(draft => {
      draft.autoLockTime = time;
    });
  };
  setHiddenBalance = (value: boolean) => {
    this.mutateStore(draft => {
      draft.hiddenBalance = value;
    });
  };
  getIsShowTestnet = () => {
    return this.store.isShowTestnet;
  };
  setIsShowTestnet = (value: boolean) => {
    this.mutateStore(draft => {
      draft.isShowTestnet = value;
    });
  };

  setWatchlistSkip = (value: boolean) => {
    this.mutateStore(draft => {
      draft.watchlistSkipV2 = value;
    });
  };

  getWatchlistSkip = () => {
    return !!this.store.watchlistSkipV2;
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
      this.mutateStore(draft => {
        draft.addressSortStore.search = '';
        draft.addressSortStore.lastScrollOffset = undefined;
        draft.addressSortStore.lastCurrentRecordTime = undefined;
      });
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
    this.mutateStore(draft => {
      if (['search', 'lastCurrent'].includes(key)) {
        draft.addressSortStore.lastCurrentRecordTime = dayjs().unix();
      }
      draft.addressSortStore[key] = value;
    });
  };

  getPinToken = () => {
    return this.getStoreFieldSnapshot('pinedQueue') || [];
  };

  /** =========toggle pinToken start =========== */
  pinToken = (token: IManageToken) => {
    const pinedQueue = this.store.pinedQueue || [];
    const exist = pinedQueue.find(
      item => item.chainId === token.chainId && item.tokenId === token.tokenId,
    );
    if (!exist) {
      this.mutateStore(draft => {
        draft.pinedQueue = [token, ...(draft.pinedQueue || [])];
      });
      // this.manualUnFoldToken(token);
      reportMatomoWatchlistStarToken(token);
    }
  };
  removePinedToken = (token: IManageToken) => {
    if (this.store.pinedQueue?.length) {
      this.mutateStore(draft => {
        draft.pinedQueue = draft.pinedQueue?.filter(
          item =>
            item.chainId !== token.chainId || item.tokenId !== token.tokenId,
        );
      });
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
      this.mutateStore(draft => {
        draft.foldTokens = [...(draft.foldTokens || []), token];
        draft.unfoldTokens = (draft.unfoldTokens || []).filter(
          item =>
            item.chainId !== token.chainId || item.tokenId !== token.tokenId,
        );
      });
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
      this.mutateStore(draft => {
        draft.unfoldTokens = [...(draft.unfoldTokens || []), token];
        draft.foldTokens = (draft.foldTokens || []).filter(
          item =>
            item.chainId !== token.chainId || item.tokenId !== token.tokenId,
        );
      });
    }
  };
  /** =========toggle fold token end =========== */

  /** =========toggle include or exclude token start =========== */
  includeBalanceToken = (item: IDefiOrToken) => {
    const preIncludeDefiAndToken = this.store?.includeDefiAndTokens || [];

    const exist = preIncludeDefiAndToken.find(
      i =>
        i.chainid === item.chainid && i.id === item.id && i.type === item.type,
    );
    if (!exist) {
      this.mutateStore(draft => {
        draft.includeDefiAndTokens = [
          ...(draft.includeDefiAndTokens || []),
          item,
        ];
        draft.excludeDefiAndTokens = (draft.excludeDefiAndTokens || []).filter(
          i =>
            i.chainid !== item.chainid ||
            i.id !== item.id ||
            i.type !== item.type,
        );
      });
    }
  };
  excludeBalance = (item: IDefiOrToken) => {
    const preExcludeDefiAndToken = this.store?.excludeDefiAndTokens || [];

    const exist = preExcludeDefiAndToken.find(
      i =>
        i.chainid === item.chainid && i.id === item.id && i.type === item.type,
    );
    if (!exist) {
      this.mutateStore(draft => {
        draft.excludeDefiAndTokens = [
          ...(draft.excludeDefiAndTokens || []),
          item,
        ];
        draft.includeDefiAndTokens = (draft.includeDefiAndTokens || []).filter(
          i =>
            i.chainid !== item.chainid ||
            i.id !== item.id ||
            i.type !== item.type,
        );
      });
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
      this.mutateStore(draft => {
        draft.foldNfts = [...(draft.foldNfts || []), nft];
        draft.unFoldNfts = (draft.unFoldNfts || []).filter(
          item => item.chain !== nft.chain || item.id !== nft.id,
        );
      });
    }
  };
  manualUnFoldNft = (nft: IManageNft) => {
    const preUnFoldNfts = this.store.unFoldNfts || [];
    const preFoldedNfts = this.store.foldNfts || [];

    const exist = preUnFoldNfts.find(
      item => item.chain === nft.chain && item.id === nft.chain,
    );
    if (!exist) {
      this.mutateStore(draft => {
        draft.unFoldNfts = [...(draft.unFoldNfts || []), nft];
        draft.foldNfts = (draft.foldNfts || []).filter(
          item => item.chain !== nft.chain || item.id !== nft.id,
        );
      });
    }
  };

  manualFoldDefi = (defiId: string) => {
    const preFoldDefis = this.store.foldDefis || [];
    const preUnFoldDefis = this.store.unFoldDefis || [];
    const exist = preFoldDefis.includes(defiId);
    if (!exist) {
      this.mutateStore(draft => {
        draft.foldDefis = [...(draft.foldDefis || []), defiId];
        draft.unFoldDefis = (draft.unFoldDefis || []).filter(
          item => item !== defiId,
        );
      });
    }
  };

  manualUnFoldDefi = (defiId: string) => {
    const preUnFoldDefis = this.store.unFoldDefis || [];
    const preFoldDefis = this.store.foldDefis || [];
    const exist = preUnFoldDefis.includes(defiId);
    if (!exist) {
      this.mutateStore(draft => {
        draft.unFoldDefis = [...(draft.unFoldDefis || []), defiId];
        draft.foldDefis = (draft.foldDefis || []).filter(
          item => item !== defiId,
        );
      });
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
      pinedQueue: this.getStoreFieldSnapshot('pinedQueue') || [],
      foldNfts: [],
      unfoldNfts: [],
      foldDefis: [],
      // foldDefis: this.store.foldDefis || [],
      unFoldDefis: [],
      // unFoldDefis: this.store.unFoldDefis || [],
    };
  };
}
