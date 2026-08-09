import type { StorageAdapaterOptions } from '@rabby-wallet/persist-store';
import createPersistStore from '@rabby-wallet/persist-store';
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
export type PerpsProTradeAmountUnit = 'base' | 'quote';
export type PerpsProTradeOrderType = 'conditional' | 'limit' | 'market';

export type PerpsProPreferences = {
  version: number;
  viewMode: PerpsViewMode;
  activeInfoTab: PerpsProInfoTab;
  skipLimitCloseDoubleConfirmation: boolean;
  tradeAmountUnit: PerpsProTradeAmountUnit;
  tradeOrderType: PerpsProTradeOrderType;
  skipTradeConfirmationByOrderType: Record<PerpsProTradeOrderType, boolean>;
  [key: string]: unknown;
};

const PERPS_PRO_PREFERENCES_VERSION = 6;
const MIN_READABLE_PERPS_PRO_PREFERENCES_VERSION = 1;
const DEFAULT_PERPS_PRO_PREFERENCES: PerpsProPreferences = {
  version: PERPS_PRO_PREFERENCES_VERSION,
  viewMode: 'simple',
  activeInfoTab: 'account',
  skipLimitCloseDoubleConfirmation: false,
  tradeAmountUnit: 'quote',
  tradeOrderType: 'market',
  skipTradeConfirmationByOrderType: {
    conditional: false,
    limit: false,
    market: false,
  },
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

const normalizePerpsProTradeAmountUnit = (
  value: unknown,
): PerpsProTradeAmountUnit =>
  hasReadableProPreferences(value) && value.tradeAmountUnit === 'base'
    ? 'base'
    : 'quote';

const normalizePerpsProTradeOrderType = (
  value: unknown,
): PerpsProTradeOrderType =>
  hasReadableProPreferences(value) &&
  (value.tradeOrderType === 'market' ||
    value.tradeOrderType === 'limit' ||
    value.tradeOrderType === 'conditional')
    ? value.tradeOrderType
    : 'market';

const normalizeSkipTradeConfirmationByOrderType = (
  value: unknown,
): Record<PerpsProTradeOrderType, boolean> => {
  const source =
    hasReadableProPreferences(value) &&
    isRecord(value.skipTradeConfirmationByOrderType)
      ? value.skipTradeConfirmationByOrderType
      : {};
  return {
    conditional: source.conditional === true,
    limit: source.limit === true,
    market: source.market === true,
  };
};

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
    tradeAmountUnit: normalizePerpsProTradeAmountUnit(value),
    tradeOrderType: normalizePerpsProTradeOrderType(value),
    skipTradeConfirmationByOrderType:
      normalizeSkipTradeConfirmationByOrderType(value),
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

export type PerpsAttachedTpSlJournalOutcome =
  | 'childRejected'
  | 'fullAccepted'
  | 'partial'
  | 'prepared'
  | 'unknown';

export type PerpsAttachedTpSlJournalLeg = {
  acceptance?: 'filled' | 'resting';
  cloid: `0x${string}`;
  error?: string;
  kind: 'accepted' | 'rejected' | 'unresolved';
  oid?: number;
  role: 'parent' | 'stopLoss' | 'takeProfit';
  status?: string;
};

export type PerpsAttachedTpSlJournalEntry = {
  accountAddress: string;
  accountType: string;
  cloids: {
    parent: `0x${string}`;
    stopLoss?: `0x${string}`;
    takeProfit?: `0x${string}`;
  };
  coin: string;
  commandId: string;
  createdAt: number;
  dexId: string;
  legs: PerpsAttachedTpSlJournalLeg[];
  marketKey: string;
  outcome: PerpsAttachedTpSlJournalOutcome;
  parentFingerprint: string;
  parentSide: 'buy' | 'sell';
  transport?: {
    error?: string;
    nonce?: number;
    phase?: 'dispatched' | 'notDispatched' | 'response';
  };
  updatedAt: number;
  version: 1;
};

type PerpsAttachedTpSlJournal = {
  entries: PerpsAttachedTpSlJournalEntry[];
  version: 1;
};

const ATTACHED_TP_SL_CLOID_PATTERN = /^0x[0-9a-f]{32}$/u;

const isAttachedTpSlCloid = (value: unknown): value is `0x${string}` =>
  typeof value === 'string' && ATTACHED_TP_SL_CLOID_PATTERN.test(value);

const isAttachedTpSlJournalLeg = (
  value: unknown,
): value is PerpsAttachedTpSlJournalLeg =>
  isRecord(value) &&
  isAttachedTpSlCloid(value.cloid) &&
  (value.kind === 'accepted' ||
    value.kind === 'rejected' ||
    value.kind === 'unresolved') &&
  (value.role === 'parent' ||
    value.role === 'stopLoss' ||
    value.role === 'takeProfit') &&
  (value.acceptance === undefined ||
    value.acceptance === 'filled' ||
    value.acceptance === 'resting') &&
  (value.error === undefined || typeof value.error === 'string') &&
  (value.oid === undefined ||
    (typeof value.oid === 'number' &&
      Number.isSafeInteger(value.oid) &&
      value.oid >= 0)) &&
  (value.status === undefined || typeof value.status === 'string');

const isPerpsAttachedTpSlJournalEntry = (
  value: unknown,
): value is PerpsAttachedTpSlJournalEntry => {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    typeof value.commandId !== 'string' ||
    value.commandId.length === 0 ||
    typeof value.parentFingerprint !== 'string' ||
    value.parentFingerprint.length === 0 ||
    typeof value.accountAddress !== 'string' ||
    value.accountAddress.length === 0 ||
    typeof value.accountType !== 'string' ||
    value.accountType.length === 0 ||
    typeof value.marketKey !== 'string' ||
    value.marketKey.length === 0 ||
    typeof value.coin !== 'string' ||
    value.coin.length === 0 ||
    typeof value.dexId !== 'string' ||
    !isRecord(value.cloids) ||
    !isAttachedTpSlCloid(value.cloids.parent) ||
    (value.cloids.takeProfit !== undefined &&
      !isAttachedTpSlCloid(value.cloids.takeProfit)) ||
    (value.cloids.stopLoss !== undefined &&
      !isAttachedTpSlCloid(value.cloids.stopLoss)) ||
    (value.cloids.takeProfit === undefined &&
      value.cloids.stopLoss === undefined) ||
    !Array.isArray(value.legs) ||
    !value.legs.every(isAttachedTpSlJournalLeg) ||
    (value.outcome !== 'childRejected' &&
      value.outcome !== 'fullAccepted' &&
      value.outcome !== 'partial' &&
      value.outcome !== 'prepared' &&
      value.outcome !== 'unknown') ||
    (value.parentSide !== 'buy' && value.parentSide !== 'sell') ||
    typeof value.createdAt !== 'number' ||
    !Number.isFinite(value.createdAt) ||
    value.createdAt < 0 ||
    typeof value.updatedAt !== 'number' ||
    !Number.isFinite(value.updatedAt) ||
    value.updatedAt < value.createdAt
  ) {
    return false;
  }
  const roleCloids = {
    parent: value.cloids.parent,
    stopLoss: value.cloids.stopLoss,
    takeProfit: value.cloids.takeProfit,
  };
  const roles = new Set<string>();
  for (const leg of value.legs) {
    if (roles.has(leg.role) || roleCloids[leg.role] !== leg.cloid) {
      return false;
    }
    roles.add(leg.role);
  }
  return (
    value.transport === undefined ||
    (isRecord(value.transport) &&
      (value.transport.error === undefined ||
        typeof value.transport.error === 'string') &&
      (value.transport.nonce === undefined ||
        (typeof value.transport.nonce === 'number' &&
          Number.isSafeInteger(value.transport.nonce) &&
          value.transport.nonce >= 0)) &&
      (value.transport.phase === undefined ||
        value.transport.phase === 'dispatched' ||
        value.transport.phase === 'notDispatched' ||
        value.transport.phase === 'response'))
  );
};

const isPerpsAttachedTpSlJournal = (
  value: unknown,
): value is PerpsAttachedTpSlJournal => {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    !Array.isArray(value.entries) ||
    !value.entries.every(isPerpsAttachedTpSlJournalEntry)
  ) {
    return false;
  }
  return (
    new Set(value.entries.map(entry => entry.commandId)).size ===
    value.entries.length
  );
};

export class PerpsService {
  private store?: PerpsServiceStore;
  // ~150KB write-once/read-once blob: bypasses createPersistStore (boot-time
  // clone + rewrite) and must own its own key — the perps store proxy
  // rewrites its whole object and would clobber foreign fields.
  private marketCacheStorage?: StorageAdapaterOptions['storageAdapter'];
  private attachedTpSlJournalStorage?: StorageAdapaterOptions['storageAdapter'];
  private keyringCrypto: KeyringCrypto;
  private agentWalletUnlockVersion = 0;
  private memoryState: PerpsServiceMemoryState = {
    agentWallets: {},
    unlockPromise: null,
  };

  constructor(
    options: StorageAdapaterOptions & { keyringCrypto: KeyringCrypto },
  ) {
    this.keyringCrypto = options.keyringCrypto;
    this.store = createPersistStore<PerpsServiceStore>(
      {
        name: APP_STORE_NAMES.perps,
        template: {
          agentVaults: '',
          agentPreferences: {},
          currentAccount: null,
          inviteConfig: {},
          // no clear account , just cache for last used
          lastUsedAccount: null,
          hasDoneNewUserProcess: false,
          hasShownPerpsGuidePopup: false,
          hasClosedLearnMoreCard: false,
          favoriteMarkets: [],
          selectedKlineInterval: DEFAULT_PERPS_CANDLE_INTERVAL,
          marginModeByCoin: {},
          proPreferences: DEFAULT_PERPS_PRO_PREFERENCES,
        },
      },
      {
        storage: options?.storageAdapter,
      },
    );
    this.marketCacheStorage = options?.storageAdapter;
    this.attachedTpSlJournalStorage = options?.storageAdapter;
    this.memoryState.agentWallets = {};
    const migratedProPreferences = migrateLegacyProPreferences(
      this.store.proPreferences,
    );
    if (migratedProPreferences) {
      this.store.proPreferences = migratedProPreferences;
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

  getPerpsAttachedTpSlJournal = (): PerpsAttachedTpSlJournalEntry[] => {
    const value = this.attachedTpSlJournalStorage?.getItem(
      APP_STORE_NAMES.perpsAttachedTpSlJournal,
    );
    if (value == null) return [];
    if (!isPerpsAttachedTpSlJournal(value)) {
      throw new Error('Attached TP/SL journal is invalid');
    }
    return value.entries;
  };

  upsertPerpsAttachedTpSlJournalEntry = (
    entry: PerpsAttachedTpSlJournalEntry,
  ) => {
    if (!isPerpsAttachedTpSlJournal({ entries: [entry], version: 1 })) {
      throw new Error('Attached TP/SL journal entry is invalid');
    }
    const entries = this.getPerpsAttachedTpSlJournal();
    this.attachedTpSlJournalStorage?.setItem(
      APP_STORE_NAMES.perpsAttachedTpSlJournal,
      {
        entries: [
          ...entries.filter(item => item.commandId !== entry.commandId),
          entry,
        ],
        version: 1,
      } satisfies PerpsAttachedTpSlJournal,
    );
  };

  removePerpsAttachedTpSlJournalEntry = (commandId: string) => {
    const entries = this.getPerpsAttachedTpSlJournal().filter(
      entry => entry.commandId !== commandId,
    );
    if (entries.length === 0) {
      this.attachedTpSlJournalStorage?.removeItem(
        APP_STORE_NAMES.perpsAttachedTpSlJournal,
      );
      return;
    }
    this.attachedTpSlJournalStorage?.setItem(
      APP_STORE_NAMES.perpsAttachedTpSlJournal,
      { entries, version: 1 } satisfies PerpsAttachedTpSlJournal,
    );
  };

  getFavoriteMarkets = async () => {
    if (!this.store) {
      throw new Error('PerpsService not initialized');
    }
    return this.store.favoriteMarkets || [];
  };

  addFavoriteMarket = async (market: string) => {
    if (!this.store) {
      throw new Error('PerpsService not initialized');
    }
    const normalizedMarket = market.toUpperCase();
    if (this.store.favoriteMarkets.includes(normalizedMarket)) {
      return;
    }
    this.store.favoriteMarkets = [
      ...this.store.favoriteMarkets,
      normalizedMarket,
    ];
  };

  removeFavoriteMarket = async (market: string) => {
    if (!this.store) {
      throw new Error('PerpsService not initialized');
    }
    const normalizedMarket = market.toUpperCase();
    this.store.favoriteMarkets = this.store.favoriteMarkets.filter(
      m => m !== normalizedMarket,
    );
  };

  getMarginModeByCoin = async () => {
    if (!this.store) {
      throw new Error('PerpsService not initialized');
    }
    return this.store.marginModeByCoin || {};
  };

  setMarginModeForCoin = async (coin: string, mode: 'cross' | 'isolated') => {
    if (!this.store) {
      throw new Error('PerpsService not initialized');
    }
    this.store.marginModeByCoin = {
      ...this.store.marginModeByCoin,
      [coin]: mode,
    };
  };

  getPerpsViewMode = async (): Promise<PerpsViewMode> => {
    if (!this.store) {
      throw new Error('PerpsService not initialized');
    }

    return normalizePerpsViewMode(this.store.proPreferences);
  };

  setPerpsViewMode = async (viewMode: PerpsViewMode) => {
    if (!this.store) {
      throw new Error('PerpsService not initialized');
    }

    const currentPreferences: unknown = this.store.proPreferences;

    this.store.proPreferences = {
      ...getWritableProPreferences(currentPreferences),
      viewMode,
    };
  };

  getPerpsProInfoTab = async (): Promise<PerpsProInfoTab> => {
    if (!this.store) {
      throw new Error('PerpsService not initialized');
    }

    return normalizePerpsProInfoTab(this.store.proPreferences);
  };

  setPerpsProInfoTab = async (activeInfoTab: PerpsProInfoTab) => {
    if (!this.store) {
      throw new Error('PerpsService not initialized');
    }

    this.store.proPreferences = {
      ...getWritableProPreferences(this.store.proPreferences),
      activeInfoTab,
    };
  };

  getSkipPerpsProLimitCloseConfirmation = async () => {
    if (!this.store) {
      throw new Error('PerpsService not initialized');
    }
    return normalizeSkipLimitCloseDoubleConfirmation(this.store.proPreferences);
  };

  setSkipPerpsProLimitCloseConfirmation = async (value: boolean) => {
    if (!this.store) {
      throw new Error('PerpsService not initialized');
    }
    this.store.proPreferences = {
      ...getWritableProPreferences(this.store.proPreferences),
      skipLimitCloseDoubleConfirmation: value === true,
    };
  };

  getPerpsProTradeAmountUnit = async (): Promise<PerpsProTradeAmountUnit> => {
    if (!this.store) throw new Error('PerpsService not initialized');
    return normalizePerpsProTradeAmountUnit(this.store.proPreferences);
  };

  setPerpsProTradeAmountUnit = async (value: PerpsProTradeAmountUnit) => {
    if (!this.store) throw new Error('PerpsService not initialized');
    this.store.proPreferences = {
      ...getWritableProPreferences(this.store.proPreferences),
      tradeAmountUnit: value === 'base' ? 'base' : 'quote',
    };
  };

  getPerpsProTradeOrderType = async (): Promise<PerpsProTradeOrderType> => {
    if (!this.store) throw new Error('PerpsService not initialized');
    return normalizePerpsProTradeOrderType(this.store.proPreferences);
  };

  setPerpsProTradeOrderType = async (value: PerpsProTradeOrderType) => {
    if (!this.store) throw new Error('PerpsService not initialized');
    if (value !== 'market' && value !== 'limit' && value !== 'conditional') {
      throw new Error('Invalid Perps Pro trade order type');
    }
    this.store.proPreferences = {
      ...getWritableProPreferences(this.store.proPreferences),
      tradeOrderType: value,
    };
  };

  getSkipPerpsProTradeConfirmation = async (
    orderType: PerpsProTradeOrderType,
  ) => {
    if (!this.store) throw new Error('PerpsService not initialized');
    return normalizeSkipTradeConfirmationByOrderType(this.store.proPreferences)[
      orderType
    ];
  };

  setSkipPerpsProTradeConfirmation = async (
    orderType: PerpsProTradeOrderType,
    value: boolean,
  ) => {
    if (!this.store) throw new Error('PerpsService not initialized');
    const current = getWritableProPreferences(this.store.proPreferences);
    this.store.proPreferences = {
      ...current,
      skipTradeConfirmationByOrderType: {
        ...normalizeSkipTradeConfirmationByOrderType(current),
        [orderType]: value === true,
      },
    };
  };

  setHasDoneNewUserProcess = async (hasDone: boolean) => {
    if (!this.store) {
      throw new Error('PerpsService not initialized');
    }
    this.store.hasDoneNewUserProcess = hasDone;
  };

  getHasDoneNewUserProcess = async () => {
    if (!this.store) {
      throw new Error('PerpsService not initialized');
    }
    return this.store.hasDoneNewUserProcess;
  };

  setHasShownPerpsGuidePopup = async (value: boolean) => {
    if (!this.store) {
      throw new Error('PerpsService not initialized');
    }
    this.store.hasShownPerpsGuidePopup = value;
  };

  getHasShownPerpsGuidePopup = async () => {
    if (!this.store) {
      throw new Error('PerpsService not initialized');
    }
    return this.store.hasShownPerpsGuidePopup;
  };

  setHasClosedLearnMoreCard = async (value: boolean) => {
    if (!this.store) {
      throw new Error('PerpsService not initialized');
    }
    this.store.hasClosedLearnMoreCard = value;
  };

  getHasClosedLearnMoreCard = async () => {
    if (!this.store) {
      throw new Error('PerpsService not initialized');
    }
    return this.store.hasClosedLearnMoreCard;
  };

  setSelectedKlineInterval = async (value: PerpsCandleInterval) => {
    if (!this.store) {
      throw new Error('PerpsService not initialized');
    }
    if (!isPerpsCandleInterval(value)) {
      throw new Error('Invalid Perps candle interval');
    }
    this.store.selectedKlineInterval = value;
  };

  getSelectedKlineInterval = async () => {
    if (!this.store) {
      throw new Error('PerpsService not initialized');
    }
    const storedValue = this.store.selectedKlineInterval as unknown;
    const normalizedValue = normalizePerpsCandleInterval(storedValue);
    if (storedValue !== normalizedValue) {
      this.store.selectedKlineInterval = normalizedValue;
    }
    return normalizedValue;
  };

  setSendApproveAfterDeposit = async (
    masterAddress: string,
    approveSignatures: ApproveSignatures,
  ) => {
    if (!this.store) {
      throw new Error('PerpsService not initialized');
    }

    if (!masterAddress) {
      console.error('masterAddress is required');
      return;
    }

    const normalizedAddress = masterAddress.toLowerCase();

    // Update store preferences
    const existingPreference = this.store.agentPreferences[
      normalizedAddress
    ] || {
      agentAddress: '',
      approveSignatures: [],
    };

    this.store.agentPreferences[normalizedAddress] = {
      ...existingPreference,
      approveSignatures,
    };

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
    if (!this.store?.agentVaults) {
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
      if (this.store) {
        this.store.agentVaults = '';
        this.store.agentPreferences = {};
      }
      return {};
    }
  };

  unlockAgentWallets = async () => {
    const unlockVersion = ++this.agentWalletUnlockVersion;
    const unlock = async () => {
      if (!this.store) {
        throw new Error('PerpsService not initialized');
      }
      const agentWallets: PerpsServiceMemoryState['agentWallets'] = {};

      // Decrypt and load agent vaults
      if (this.store.agentVaults) {
        const vaultsMap = await this.safeDecryptAgentVaults();

        // Format data for memory state
        for (const masterAddress in vaultsMap) {
          const privateKey = vaultsMap[masterAddress] || '';
          const preference = this.store.agentPreferences[masterAddress] || {
            agentAddress: '',
            approveSignatures: [],
          };
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
              approveSignatures: preference.approveSignatures || [],
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
    if (!this.store) {
      throw new Error('PerpsService not initialized');
    }
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
    if (!this.store) {
      throw new Error('PerpsService not initialized');
    }

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
    this.store.agentVaults = encryptedVaults;
    this.store.agentPreferences = {
      ...this.store.agentPreferences,
      [normalizedAddress]: {
        agentAddress: preference.agentAddress,
        approveSignatures: preference.approveSignatures,
      },
    };
  };

  getAgentWallet = async (address: string) => {
    if (!this.store) {
      throw new Error('PerpsService not initialized');
    }
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
    if (!this.store) {
      throw new Error('PerpsService not initialized');
    }

    const normalizedAddress = address.toLowerCase();
    const existingPreference = this.store.agentPreferences[normalizedAddress];

    if (!existingPreference) {
      throw new Error(`Agent wallet not found for address: ${address}`);
    }

    this.store.agentPreferences = {
      ...this.store.agentPreferences,
      [normalizedAddress]: {
        agentAddress: preference.agentAddress,
        approveSignatures: preference.approveSignatures,
      },
    };

    if (this.memoryState.agentWallets[normalizedAddress]) {
      this.memoryState.agentWallets[normalizedAddress].preference = preference;
    }
  };

  setCurrentAccount = async (account: Account | null) => {
    if (!this.store) {
      throw new Error('PerpsService not initialized');
    }
    if (account) {
      this.store.lastUsedAccount = {
        address: account?.address,
        type: account?.type,
        aliasName: account?.aliasName,
        brandName: account?.brandName,
      };
      this.store.currentAccount = {
        address: account.address,
        type: account.type,
        aliasName: account.aliasName,
        brandName: account.brandName,
      };
    } else {
      this.store.currentAccount = null;
    }
  };

  getLastUsedAccount = async () => {
    if (!this.store) {
      throw new Error('PerpsService not initialized');
    }
    return this.store.lastUsedAccount;
  };

  getCurrentAccount = async () => {
    if (!this.store) {
      throw new Error('PerpsService not initialized');
    }
    return this.store.currentAccount;
  };

  removeAgentWallet = async (address: string) => {
    if (!this.store) {
      throw new Error('PerpsService not initialized');
    }

    const normalizedAddress = address.toLowerCase();

    const vaultsMap = await this.safeDecryptAgentVaults();

    delete vaultsMap[normalizedAddress];

    const encryptedVaults = await this.keyringCrypto.encryptWithPassword(
      vaultsMap,
    );

    this.store.agentVaults = encryptedVaults;
    const updatedPreferences = { ...this.store.agentPreferences };
    delete updatedPreferences[normalizedAddress];
    this.store.agentPreferences = updatedPreferences;

    const updatedMemoryWallets = { ...this.memoryState.agentWallets };
    delete updatedMemoryWallets[normalizedAddress];
    this.memoryState.agentWallets = updatedMemoryWallets;
  };

  hasAgentWallet = (address: string) => {
    if (!this.store) {
      return false;
    }

    const normalizedAddress = address.toLowerCase();
    return !!this.memoryState.agentWallets[normalizedAddress];
  };

  getAgentWalletPreference = (address: string) => {
    if (!this.store) {
      throw new Error('PerpsService not initialized');
    }

    const normalizedAddress = address.toLowerCase();
    const preference = this.store.agentPreferences[normalizedAddress];

    if (!preference) {
      return null;
    }

    return preference;
  };

  getInviteConfig = (address: string) => {
    if (!this.store) {
      throw new Error('PerpsService not initialized');
    }
    return this.store.inviteConfig[address.toLowerCase()];
  };

  setInviteConfig = (
    address: string,
    config: { lastConnectedAt?: number; lastInvitedAt?: number },
  ) => {
    if (!this.store) {
      throw new Error('PerpsService not initialized');
    }
    this.store.inviteConfig[address.toLowerCase()] = {
      ...this.store.inviteConfig[address.toLowerCase()],
      ...config,
    };
  };

  // only test use
  resetStore = async () => {
    if (!this.store) {
      throw new Error('PerpsService not initialized');
    }
    this.store.agentVaults = '';
    this.store.agentPreferences = {};
    this.store.currentAccount = null;
    this.store.lastUsedAccount = null;
    this.store.hasShownPerpsGuidePopup = false;
    this.store.hasClosedLearnMoreCard = false;
    this.store.hasDoneNewUserProcess = false;
    this.memoryState.agentWallets = {};
  };
}
