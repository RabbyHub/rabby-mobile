import cloneDeep from 'lodash/cloneDeep';
import {
  StoreServiceBase,
  type StorageAdapaterOptions,
} from '@rabby-wallet/persist-store';
import { APP_STORE_NAMES } from '../storage/storeConstant';

import { bytesToHex, publicToAddress, hexToBytes } from '@ethereumjs/util';
import { SendApproveParams } from '@rabby-wallet/hyperliquid-sdk';
import { getRandomBytesSync } from 'ethereum-cryptography/random.js';
import { secp256k1 } from 'ethereum-cryptography/secp256k1.js';
import {
  DEFAULT_PERPS_CANDLE_INTERVAL,
  isPerpsCandleInterval,
  normalizePerpsCandleInterval,
  type PerpsCandleInterval,
} from '@/constant/perps';
import type { Account } from '@/types/account';

type KeyringCrypto = {
  decryptWithPassword: <T>(value: string) => Promise<T>;
  encryptWithPassword: <T>(value: T) => Promise<string>;
  isUnlocked: () => boolean;
};

export interface AgentWalletInfo {
  vault: string;
  preference: {
    agentAddress: string;
    approveSignatures: ApproveSignatures;
  };
}

interface StoreAccount {
  address: string;
  type: string;
  brandName: string;
  aliasName?: string;
}

export type ApproveSignatures = (SendApproveParams & {
  type: 'approveAgent' | 'approveBuilderFee';
})[];

export type PerpsViewMode = 'simple' | 'pro';
export type PerpsProInfoTab = 'account' | 'positions' | 'openOrders';

export type PerpsProPreferences = {
  version: number;
  viewMode: PerpsViewMode;
  activeInfoTab: PerpsProInfoTab;
  skipLimitCloseDoubleConfirmation: boolean;
  [key: string]: unknown;
};

const PERPS_PRO_PREFERENCES_VERSION = 5;
const MIN_READABLE_PERPS_PRO_PREFERENCES_VERSION = 1;
const DEFAULT_PERPS_PRO_PREFERENCES: PerpsProPreferences = {
  version: PERPS_PRO_PREFERENCES_VERSION,
  viewMode: 'simple',
  activeInfoTab: 'account',
  skipLimitCloseDoubleConfirmation: false,
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

type ReadableProPreferences = Record<string, unknown> & {
  version: number;
};

const hasReadableProPreferences = (
  value: unknown,
): value is ReadableProPreferences =>
  isRecord(value) &&
  typeof value.version === 'number' &&
  Number.isFinite(value.version) &&
  value.version >= MIN_READABLE_PERPS_PRO_PREFERENCES_VERSION;

const normalizePerpsViewMode = (value: unknown): PerpsViewMode => {
  if (!hasReadableProPreferences(value)) {
    return 'simple';
  }
  return value.viewMode === 'simple' || value.viewMode === 'pro'
    ? value.viewMode
    : 'simple';
};

const normalizePerpsProInfoTab = (value: unknown): PerpsProInfoTab => {
  if (!hasReadableProPreferences(value)) {
    return 'account';
  }
  return value.activeInfoTab === 'account' ||
    value.activeInfoTab === 'positions' ||
    value.activeInfoTab === 'openOrders'
    ? value.activeInfoTab
    : 'account';
};

const normalizeSkipLimitCloseDoubleConfirmation = (value: unknown) =>
  hasReadableProPreferences(value) &&
  value.skipLimitCloseDoubleConfirmation === true;

const removeLegacyBookPrecision = (value: ReadableProPreferences) => {
  const nextValue = { ...value };
  delete nextValue.bookPrecisionByMarket;
  return nextValue;
};

const getWritableProPreferences = (
  value: unknown,
): PerpsProPreferences & Record<string, unknown> => {
  if (!hasReadableProPreferences(value)) {
    return { ...DEFAULT_PERPS_PRO_PREFERENCES };
  }
  const writableValue =
    value.version < PERPS_PRO_PREFERENCES_VERSION
      ? removeLegacyBookPrecision(value)
      : value;
  return {
    ...writableValue,
    version: Math.max(value.version, PERPS_PRO_PREFERENCES_VERSION),
    viewMode: normalizePerpsViewMode(value),
    activeInfoTab: normalizePerpsProInfoTab(value),
    skipLimitCloseDoubleConfirmation:
      normalizeSkipLimitCloseDoubleConfirmation(value),
  } as PerpsProPreferences & Record<string, unknown>;
};

const migrateLegacyProPreferences = (
  value: unknown,
): PerpsProPreferences | null =>
  hasReadableProPreferences(value) &&
  value.version < PERPS_PRO_PREFERENCES_VERSION
    ? getWritableProPreferences(value)
    : null;

export interface PerpsServiceStore {
  agentVaults: string; // encrypted JSON string of {[address: string]: string}
  agentPreferences: {
    [address: string]: {
      agentAddress: string;
      approveSignatures: ApproveSignatures;
    };
  };
  currentAccount: StoreAccount | null;
  lastUsedAccount: StoreAccount | null;
  hasDoneNewUserProcess: boolean;
  hasShownPerpsGuidePopup: boolean;
  hasClosedLearnMoreCard: boolean;
  inviteConfig: {
    [address: string]: {
      lastInvitedAt?: number;
      lastConnectedAt?: number;
    };
  };
  favoriteMarkets: string[];
  selectedKlineInterval: PerpsCandleInterval;
  marginModeByCoin: Record<string, 'cross' | 'isolated'>;
  proPreferences: PerpsProPreferences;
}
export interface PerpsServiceMemoryState {
  agentWallets: {
    // key is master wallet address
    [address: string]: AgentWalletInfo;
  };
  unlockPromise: Promise<void> | null;
}

// Generic item type — importing MarketData here would create a hooks <-> core cycle.
export interface PerpsMarketDataCache<TItem = unknown> {
  v: number;
  updatedAt: number;
  list: TItem[];
}

export class PerpsService extends StoreServiceBase<
  PerpsServiceStore,
  APP_STORE_NAMES.perps
> {
  // ~150KB write-once/read-once blob: bypasses createPersistStore (boot-time
  // clone + rewrite) and must own its own key — the perps store proxy
  // rewrites its whole object and would clobber foreign fields.
  private marketCacheStorage?: StorageAdapaterOptions['storageAdapter'];
  private keyringCrypto: KeyringCrypto;
  private agentWalletUnlockVersion = 0;
  private memoryState: PerpsServiceMemoryState = {
    agentWallets: {},
    unlockPromise: null,
  };

  constructor(
    options: StorageAdapaterOptions & { keyringCrypto: KeyringCrypto },
  ) {
    super(
      APP_STORE_NAMES.perps,
      {
        agentVaults: '',
        agentPreferences: {},
        currentAccount: null,
        inviteConfig: {},
        // no clear account, just cache for last used
        lastUsedAccount: null,
        hasDoneNewUserProcess: false,
        hasShownPerpsGuidePopup: false,
        hasClosedLearnMoreCard: false,
        favoriteMarkets: [],
        selectedKlineInterval: DEFAULT_PERPS_CANDLE_INTERVAL,
        marginModeByCoin: {},
        proPreferences: DEFAULT_PERPS_PRO_PREFERENCES,
      },
      { storageAdapter: options?.storageAdapter },
    );
    this.keyringCrypto = options.keyringCrypto;
    this.marketCacheStorage = options?.storageAdapter;
    this.memoryState.agentWallets = {};
    const migratedProPreferences = migrateLegacyProPreferences(
      this.store.proPreferences,
    );
    if (migratedProPreferences) {
      this.mutateStore(draft => {
        draft.proPreferences = migratedProPreferences;
      });
    }
  }

  getMarketDataCache = <TItem = unknown>() => {
    try {
      return (this.marketCacheStorage?.getItem(
        APP_STORE_NAMES.perpsMarketCache,
      ) ?? null) as PerpsMarketDataCache<TItem> | null;
    } catch (error) {
      console.error('Failed to read perps market cache:', error);
      return null;
    }
  };

  setMarketDataCache = (cache: PerpsMarketDataCache) => {
    try {
      this.marketCacheStorage?.setItem(APP_STORE_NAMES.perpsMarketCache, cache);
    } catch (error) {
      console.error('Failed to write perps market cache:', error);
    }
  };

  getFavoriteMarkets = async () => {
    return this.getStoreFieldSnapshot('favoriteMarkets') || [];
  };

  addFavoriteMarket = async (market: string) => {
    const normalizedMarket = market.toUpperCase();
    if (this.store.favoriteMarkets.includes(normalizedMarket)) {
      return;
    }
    this.mutateStore(draft => {
      draft.favoriteMarkets.push(normalizedMarket);
    });
  };

  removeFavoriteMarket = async (market: string) => {
    const normalizedMarket = market.toUpperCase();
    this.mutateStore(draft => {
      draft.favoriteMarkets = draft.favoriteMarkets.filter(
        item => item !== normalizedMarket,
      );
    });
  };

  getMarginModeByCoin = async () => {
    return cloneDeep(this.store.marginModeByCoin || {});
  };

  setMarginModeForCoin = async (coin: string, mode: 'cross' | 'isolated') => {
    this.mutateStore(draft => {
      draft.marginModeByCoin[coin] = mode;
    });
  };

  getPerpsViewMode = async (): Promise<PerpsViewMode> => {
    if (!this.store) {
      throw new Error('PerpsService not initialized');
    }

    return normalizePerpsViewMode(this.store.proPreferences);
  };

  setPerpsViewMode = async (viewMode: PerpsViewMode) => {
    const currentPreferences: unknown = this.store.proPreferences;
    this.mutateStore(draft => {
      draft.proPreferences = {
        ...getWritableProPreferences(currentPreferences),
        viewMode,
      };
    });
  };

  getPerpsProInfoTab = async (): Promise<PerpsProInfoTab> => {
    if (!this.store) {
      throw new Error('PerpsService not initialized');
    }

    return normalizePerpsProInfoTab(this.store.proPreferences);
  };

  setPerpsProInfoTab = async (activeInfoTab: PerpsProInfoTab) => {
    const currentPreferences: unknown = this.store.proPreferences;
    this.mutateStore(draft => {
      draft.proPreferences = {
        ...getWritableProPreferences(currentPreferences),
        activeInfoTab,
      };
    });
  };

  getSkipPerpsProLimitCloseConfirmation = async () => {
    if (!this.store) {
      throw new Error('PerpsService not initialized');
    }
    return normalizeSkipLimitCloseDoubleConfirmation(this.store.proPreferences);
  };

  setSkipPerpsProLimitCloseConfirmation = async (value: boolean) => {
    const currentPreferences: unknown = this.store.proPreferences;
    this.mutateStore(draft => {
      draft.proPreferences = {
        ...getWritableProPreferences(currentPreferences),
        skipLimitCloseDoubleConfirmation: value === true,
      };
    });
  };

  setHasDoneNewUserProcess = async (hasDone: boolean) => {
    this.mutateStore(draft => {
      draft.hasDoneNewUserProcess = hasDone;
    });
  };

  getHasDoneNewUserProcess = async () => {
    return this.store.hasDoneNewUserProcess;
  };

  setHasShownPerpsGuidePopup = async (value: boolean) => {
    this.mutateStore(draft => {
      draft.hasShownPerpsGuidePopup = value;
    });
  };

  getHasShownPerpsGuidePopup = async () => {
    return this.store.hasShownPerpsGuidePopup;
  };

  setHasClosedLearnMoreCard = async (value: boolean) => {
    this.mutateStore(draft => {
      draft.hasClosedLearnMoreCard = value;
    });
  };

  getHasClosedLearnMoreCard = async () => {
    return this.store.hasClosedLearnMoreCard;
  };

  setSelectedKlineInterval = async (value: PerpsCandleInterval) => {
    if (!isPerpsCandleInterval(value)) {
      throw new Error('Invalid Perps candle interval');
    }
    this.mutateStore(draft => {
      draft.selectedKlineInterval = value;
    });
  };

  getSelectedKlineInterval = async () => {
    const storedValue = this.store.selectedKlineInterval;
    const normalizedValue = normalizePerpsCandleInterval(storedValue);
    if (storedValue !== normalizedValue) {
      this.mutateStore(draft => {
        draft.selectedKlineInterval = normalizedValue;
      });
    }
    return normalizedValue;
  };

  setSendApproveAfterDeposit = async (
    masterAddress: string,
    approveSignatures: ApproveSignatures,
  ) => {
    if (!masterAddress) {
      console.error('masterAddress is required');
      return;
    }

    const normalizedAddress = masterAddress.toLowerCase();

    // Update store preferences
    this.mutateStore(draft => {
      const existingPreference = draft.agentPreferences[normalizedAddress] || {
        agentAddress: '',
        approveSignatures: [],
      };
      draft.agentPreferences[normalizedAddress] = {
        ...existingPreference,
        approveSignatures,
      };
    });

    // Update memory state if wallet exists
    if (this.memoryState.agentWallets[normalizedAddress]) {
      this.memoryState.agentWallets[
        normalizedAddress
      ].preference.approveSignatures = approveSignatures;
    }
  };

  getSendApproveAfterDeposit = async (masterAddress: string) => {
    const normalizedAddress = masterAddress.toLowerCase();
    const agentWallet = this.memoryState.agentWallets[normalizedAddress];

    if (!agentWallet) {
      console.error('agentWallet not found');
      return null;
    }

    return agentWallet.preference.approveSignatures;
  };

  /**
   * Agent vaults are encrypted with the keyring password, and changing the
   * password doesn't re-encrypt them — so the ciphertext can stop decrypting
   * ("Incorrect password"). An agent is a re-creatable signing proxy, so on a
   * genuine key mismatch (unlocked but decrypt still fails) we drop the stale
   * data and let the caller recreate it instead of surfacing a password error.
   */
  private safeDecryptAgentVaults = async (): Promise<{
    [address: string]: string;
  }> => {
    if (!this.store.agentVaults) {
      return {};
    }
    try {
      return await this.keyringCrypto.decryptWithPassword(
        this.store.agentVaults,
      );
    } catch (error) {
      // not unlocked yet → password not ready, not a real key mismatch
      if (!this.keyringCrypto.isUnlocked()) {
        throw error;
      }
      // browser-passworder reports a genuine key mismatch as "Incorrect
      // password"; anything else (corrupted blob, transient native crypto
      // failure) must propagate instead of irreversibly wiping every
      // account's agent data and pending approve signatures.
      const message = error instanceof Error ? error.message : String(error);
      if (!/incorrect password/i.test(message)) {
        throw error;
      }
      console.warn(
        '[perpsService] failed to decrypt agentVaults while unlocked, resetting stale agent data',
        message,
      );
      this.mutateStore(draft => {
        draft.agentVaults = '';
        draft.agentPreferences = {};
      });
      return {};
    }
  };

  unlockAgentWallets = async () => {
    const unlockVersion = ++this.agentWalletUnlockVersion;
    const unlock = async () => {
      const agentWallets: PerpsServiceMemoryState['agentWallets'] = {};

      // Decrypt and load agent vaults
      if (this.store.agentVaults) {
        const vaultsMap = await this.safeDecryptAgentVaults();

        // Format data for memory state
        for (const masterAddress in vaultsMap) {
          const privateKey = vaultsMap[masterAddress] || '';
          const preference = cloneDeep(
            this.store.agentPreferences[masterAddress] || {
              agentAddress: '',
              approveSignatures: [],
            },
          );
          agentWallets[masterAddress] = {
            vault: privateKey,
            preference: {
              ...preference,
              // Derive the agent address from the vault key — never trust the
              // stored preference.agentAddress here. A concurrent
              // createAgentWallet can rewrite agentPreferences during the decrypt
              // await above, so pairing this vault snapshot with the current
              // preference would hand the SDK a private key and address from two
              // different agents (→ approve one, sign with the other →
              // "agent does not exist").
              agentAddress: this.deriveAgentAddress(privateKey),
              approveSignatures: [...(preference.approveSignatures || [])],
            },
          };
        }
      }

      if (this.agentWalletUnlockVersion === unlockVersion) {
        this.memoryState.agentWallets = agentWallets;
      }
    };
    this.memoryState.unlockPromise = unlock();
    /**
     *  unlock 是一个耗时比较长的任务，所以如果在解锁时立即尝试获取 agentWallet 可能会碰到解锁没有完成的情况
     *  所以这里把 promise 放到内存里，如果有立即读取的需求需要先读一下 promise 的状态
     * */
    this.memoryState.unlockPromise.finally(() => {
      if (this.agentWalletUnlockVersion === unlockVersion) {
        this.memoryState.unlockPromise = null;
      }
    });
  };

  lockAgentWallets = () => {
    this.agentWalletUnlockVersion += 1;
    this.memoryState.agentWallets = {};
    this.memoryState.unlockPromise = null;
  };

  // The agent address is fully determined by its vault private key, so we derive
  // it from the key rather than trusting a stored preference.agentAddress — that
  // stored value can be desynced from the vault by a concurrent createAgentWallet
  // across the decrypt await in unlockAgentWallets (the vault is snapshotted
  // before the await, the preference is read after). Deriving from the key keeps
  // agentPrivateKey and agentPublicKey on the SAME agent.
  private deriveAgentAddress = (vault: string): string => {
    const privateKey = hexToBytes(
      vault.startsWith('0x') ? vault : `0x${vault}`,
    );
    const publicKey = secp256k1.getPublicKey(privateKey, false);
    return bytesToHex(publicToAddress(publicKey, true)).toLowerCase();
  };

  createAgentWallet = async (masterAddress: string) => {
    const vault = bytesToHex(getRandomBytesSync(32));
    const agentAddress = this.deriveAgentAddress(vault);
    await this.addAgentWallet(masterAddress, vault, {
      agentAddress,
      approveSignatures: [],
    });
    return { agentAddress, vault };
  };

  addAgentWallet = async (
    masterAddress: string,
    vault: string,
    preference: AgentWalletInfo['preference'],
  ) => {
    const normalizedAddress = masterAddress.toLowerCase();

    this.memoryState.agentWallets = {
      ...this.memoryState.agentWallets,
      [normalizedAddress]: {
        vault,
        preference,
      },
    };

    const vaultsMap = await this.safeDecryptAgentVaults();

    vaultsMap[normalizedAddress] = vault;

    const encryptedVaults = await this.keyringCrypto.encryptWithPassword(
      vaultsMap,
    );

    // Update store
    this.mutateStore(draft => {
      draft.agentVaults = encryptedVaults;
      draft.agentPreferences[normalizedAddress] = {
        agentAddress: preference.agentAddress,
        approveSignatures: preference.approveSignatures,
      };
    });
  };

  getAgentWallet = async (address: string) => {
    if (this.memoryState.unlockPromise) {
      await this.memoryState.unlockPromise;
    }

    const normalizedAddress = address.toLowerCase();

    return this.memoryState.agentWallets[normalizedAddress];
  };

  updateAgentWalletPreference = async (
    address: string,
    preference: AgentWalletInfo['preference'],
  ) => {
    const normalizedAddress = address.toLowerCase();
    const existingPreference = this.store.agentPreferences[normalizedAddress];

    if (!existingPreference) {
      throw new Error(`Agent wallet not found for address: ${address}`);
    }

    this.mutateStore(draft => {
      draft.agentPreferences[normalizedAddress] = {
        agentAddress: preference.agentAddress,
        approveSignatures: preference.approveSignatures,
      };
    });

    if (this.memoryState.agentWallets[normalizedAddress]) {
      this.memoryState.agentWallets[normalizedAddress].preference = preference;
    }
  };

  setCurrentAccount = async (account: Account | null) => {
    this.mutateStore(draft => {
      if (account) {
        const storeAccount = {
          address: account.address,
          type: account.type,
          aliasName: account.aliasName,
          brandName: account.brandName,
        };
        draft.lastUsedAccount = { ...storeAccount };
        draft.currentAccount = { ...storeAccount };
      } else {
        draft.currentAccount = null;
      }
    });
  };

  getLastUsedAccount = async () => {
    return cloneDeep(this.store.lastUsedAccount);
  };

  getCurrentAccount = async () => {
    return cloneDeep(this.store.currentAccount);
  };

  removeAgentWallet = async (address: string) => {
    const normalizedAddress = address.toLowerCase();

    const vaultsMap = await this.safeDecryptAgentVaults();

    delete vaultsMap[normalizedAddress];

    const encryptedVaults = await this.keyringCrypto.encryptWithPassword(
      vaultsMap,
    );

    this.mutateStore(draft => {
      draft.agentVaults = encryptedVaults;
      delete draft.agentPreferences[normalizedAddress];
    });

    const updatedMemoryWallets = { ...this.memoryState.agentWallets };
    delete updatedMemoryWallets[normalizedAddress];
    this.memoryState.agentWallets = updatedMemoryWallets;
  };

  hasAgentWallet = (address: string) => {
    const normalizedAddress = address.toLowerCase();
    return !!this.memoryState.agentWallets[normalizedAddress];
  };

  getAgentWalletPreference = (address: string) => {
    const normalizedAddress = address.toLowerCase();
    const preference = this.store.agentPreferences[normalizedAddress];

    if (!preference) {
      return null;
    }

    return cloneDeep(preference);
  };

  getInviteConfig = (address: string) => {
    return cloneDeep(this.store.inviteConfig[address.toLowerCase()]);
  };

  setInviteConfig = (
    address: string,
    config: { lastConnectedAt?: number; lastInvitedAt?: number },
  ) => {
    this.mutateStore(draft => {
      const key = address.toLowerCase();
      draft.inviteConfig[key] = {
        ...draft.inviteConfig[key],
        ...config,
      };
    });
  };

  // only test use
  resetStore = async () => {
    this.mutateStore(draft => {
      draft.agentVaults = '';
      draft.agentPreferences = {};
      draft.currentAccount = null;
      draft.lastUsedAccount = null;
      draft.hasShownPerpsGuidePopup = false;
      draft.hasClosedLearnMoreCard = false;
      draft.hasDoneNewUserProcess = false;
    });
    this.memoryState.agentWallets = {};
  };
}
