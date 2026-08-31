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
export type PerpsViewModePreference = {
  hasVisitedPro: boolean;
  viewMode: PerpsViewMode;
};
export type PerpsProInfoTab = 'account' | 'positions' | 'openOrders';
export type PerpsProInfoTabPreference = {
  activeInfoTab: PerpsProInfoTab;
  hasUserSelectedInfoTab: boolean;
};
export type PerpsProTradeAmountUnit = 'base' | 'quote';
export type PerpsProTradeOrderType = 'conditional' | 'limit' | 'market';
export type PerpsProOpenOrderEditCategory = 'basic' | 'conditional';
export type PerpsProOpeningTpSlMode = 'pnl' | 'price' | 'roi';
export type PerpsProPositionTpSlMode = 'pnl' | 'roi';
export type PerpsProTpSlModeLeg = 'sl' | 'tp';
export type PerpsProTpSlModePreferences = {
  opening: Record<PerpsProTpSlModeLeg, PerpsProOpeningTpSlMode>;
  position: Record<PerpsProTpSlModeLeg, PerpsProPositionTpSlMode>;
};
export type PerpsProTpSlModePreferenceSelection =
  | {
      leg: PerpsProTpSlModeLeg;
      mode: PerpsProOpeningTpSlMode;
      surface: 'opening';
    }
  | {
      leg: PerpsProTpSlModeLeg;
      mode: PerpsProPositionTpSlMode;
      surface: 'position';
    };

export type PerpsProPreferences = {
  version: number;
  viewMode: PerpsViewMode;
  hasVisitedPro: boolean;
  activeInfoTab: PerpsProInfoTab;
  hasUserSelectedInfoTab: boolean;
  skipLimitCloseDoubleConfirmation: boolean;
  skipMarketCloseDoubleConfirmation: boolean;
  skipPositionTpSlDoubleConfirmation: boolean;
  skipOpenOrderEditConfirmationByCategory: Record<
    PerpsProOpenOrderEditCategory,
    boolean
  >;
  tradeAmountUnit: PerpsProTradeAmountUnit;
  tradeOrderType: PerpsProTradeOrderType;
  skipTradeConfirmationByOrderType: Record<PerpsProTradeOrderType, boolean>;
  tpSlModePreferences: PerpsProTpSlModePreferences;
  [key: string]: unknown;
};

const PERPS_PRO_PREFERENCES_VERSION = 12;
const MIN_READABLE_PERPS_PRO_PREFERENCES_VERSION = 1;
const PERPS_PRO_INFO_TAB_SELECTION_VERSION = 11;
const DEFAULT_PERPS_PRO_TP_SL_MODE_PREFERENCES: PerpsProTpSlModePreferences = {
  opening: { sl: 'price', tp: 'price' },
  position: { sl: 'pnl', tp: 'pnl' },
};
const DEFAULT_PERPS_PRO_PREFERENCES: PerpsProPreferences = {
  version: PERPS_PRO_PREFERENCES_VERSION,
  viewMode: 'simple',
  hasVisitedPro: false,
  activeInfoTab: 'account',
  hasUserSelectedInfoTab: false,
  skipLimitCloseDoubleConfirmation: false,
  skipMarketCloseDoubleConfirmation: false,
  skipPositionTpSlDoubleConfirmation: false,
  skipOpenOrderEditConfirmationByCategory: {
    basic: false,
    conditional: false,
  },
  tradeAmountUnit: 'quote',
  tradeOrderType: 'market',
  skipTradeConfirmationByOrderType: {
    conditional: false,
    limit: false,
    market: false,
  },
  tpSlModePreferences: DEFAULT_PERPS_PRO_TP_SL_MODE_PREFERENCES,
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

const normalizeHasVisitedPro = (value: unknown) => {
  if (!hasReadableProPreferences(value)) {
    return false;
  }
  if (typeof value.hasVisitedPro === 'boolean') {
    return value.hasVisitedPro;
  }
  return normalizePerpsViewMode(value) === 'pro';
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

const normalizeHasUserSelectedInfoTab = (value: unknown) =>
  hasReadableProPreferences(value) &&
  value.version >= PERPS_PRO_INFO_TAB_SELECTION_VERSION &&
  value.hasUserSelectedInfoTab === true;

const normalizeSkipLimitCloseDoubleConfirmation = (value: unknown) =>
  hasReadableProPreferences(value) &&
  value.skipLimitCloseDoubleConfirmation === true;

const normalizeSkipMarketCloseDoubleConfirmation = (value: unknown) =>
  hasReadableProPreferences(value) &&
  value.skipMarketCloseDoubleConfirmation === true;

const normalizeSkipPositionTpSlDoubleConfirmation = (value: unknown) =>
  hasReadableProPreferences(value) &&
  value.skipPositionTpSlDoubleConfirmation === true;

const normalizeSkipOpenOrderEditConfirmationByCategory = (
  value: unknown,
): Record<PerpsProOpenOrderEditCategory, boolean> => {
  const source =
    hasReadableProPreferences(value) &&
    isRecord(value.skipOpenOrderEditConfirmationByCategory)
      ? value.skipOpenOrderEditConfirmationByCategory
      : {};
  return {
    basic: source.basic === true,
    conditional: source.conditional === true,
  };
};

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

const normalizePerpsProTpSlModePreferences = (
  value: unknown,
): PerpsProTpSlModePreferences => {
  const source =
    hasReadableProPreferences(value) && isRecord(value.tpSlModePreferences)
      ? value.tpSlModePreferences
      : {};
  const opening = isRecord(source.opening) ? source.opening : {};
  const position = isRecord(source.position) ? source.position : {};
  const openingMode = (mode: unknown): PerpsProOpeningTpSlMode =>
    mode === 'pnl' || mode === 'roi' || mode === 'price' ? mode : 'price';
  const positionMode = (mode: unknown): PerpsProPositionTpSlMode =>
    mode === 'roi' ? 'roi' : 'pnl';
  return {
    opening: {
      sl: openingMode(opening.sl),
      tp: openingMode(opening.tp),
    },
    position: {
      sl: positionMode(position.sl),
      tp: positionMode(position.tp),
    },
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
    hasVisitedPro: normalizeHasVisitedPro(value),
    activeInfoTab: normalizePerpsProInfoTab(value),
    hasUserSelectedInfoTab: normalizeHasUserSelectedInfoTab(value),
    skipLimitCloseDoubleConfirmation:
      normalizeSkipLimitCloseDoubleConfirmation(value),
    skipMarketCloseDoubleConfirmation:
      normalizeSkipMarketCloseDoubleConfirmation(value),
    skipPositionTpSlDoubleConfirmation:
      normalizeSkipPositionTpSlDoubleConfirmation(value),
    skipOpenOrderEditConfirmationByCategory:
      normalizeSkipOpenOrderEditConfirmationByCategory(value),
    tradeAmountUnit: normalizePerpsProTradeAmountUnit(value),
    tradeOrderType: normalizePerpsProTradeOrderType(value),
    skipTradeConfirmationByOrderType:
      normalizeSkipTradeConfirmationByOrderType(value),
    tpSlModePreferences: normalizePerpsProTpSlModePreferences(value),
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
  // Account abstraction mode per (lowercased) master address. It changes only
  // when the user opts into Unified Account / Portfolio Margin, so the cached
  // value is a safe fallback while the network value is in flight or failed.
  userAbstractionByAddress: Record<string, string>;
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

export type PerpsFundingJournalStatus = 'confirmed' | 'failed' | 'pending';

type PerpsFundingJournalEntryCommon = {
  accountAddress: string;
  accountType: string;
  amount: string;
  asset: string;
  createdAt: number;
  direction: 'deposit' | 'withdraw';
  fundingRoute?: 'direct' | 'provider';
  localType: 'deposit' | 'receive' | 'withdraw';
  operationId: string;
  settlementAmount: string;
  sourceChainId?: string;
  sourceTokenId?: string;
  status: PerpsFundingJournalStatus;
  updatedAt: number;
};

type PerpsFundingJournalEntryV1 = PerpsFundingJournalEntryCommon & {
  sourceHash: string;
  version: 1;
};

export type PerpsFundingJournalEntry = PerpsFundingJournalEntryCommon & {
  providerSettlementIdentity?: {
    hash: string;
    kind: 'hyperliquidLedgerHash';
  };
  settlementIdentity?: {
    kind: 'hyperliquidNonce';
    nonce: number;
  };
  sourceIdentity?: {
    hash: string;
    kind: 'evmTransactionHash';
  };
  version: 2;
};

type PerpsFundingJournal = {
  entries: PerpsFundingJournalEntry[];
  version: 2;
};

type PerpsFundingJournalV1 = {
  entries: PerpsFundingJournalEntryV1[];
  version: 1;
};

const PERPS_FUNDING_JOURNAL_LIMIT = 5000;

const isPerpsFundingJournalEntry = (
  value: unknown,
): value is PerpsFundingJournalEntry =>
  isRecord(value) &&
  value.version === 2 &&
  typeof value.operationId === 'string' &&
  value.operationId.length > 0 &&
  typeof value.accountAddress === 'string' &&
  value.accountAddress.length > 0 &&
  typeof value.accountType === 'string' &&
  value.accountType.length > 0 &&
  (value.direction === 'deposit' || value.direction === 'withdraw') &&
  (value.localType === 'deposit' ||
    value.localType === 'receive' ||
    value.localType === 'withdraw') &&
  (value.status === 'confirmed' ||
    value.status === 'failed' ||
    value.status === 'pending') &&
  typeof value.asset === 'string' &&
  value.asset.length > 0 &&
  typeof value.amount === 'string' &&
  value.amount.length > 0 &&
  typeof value.settlementAmount === 'string' &&
  value.settlementAmount.length > 0 &&
  (value.fundingRoute === undefined ||
    value.fundingRoute === 'direct' ||
    value.fundingRoute === 'provider') &&
  (value.providerSettlementIdentity === undefined ||
    (isRecord(value.providerSettlementIdentity) &&
      value.providerSettlementIdentity.kind === 'hyperliquidLedgerHash' &&
      typeof value.providerSettlementIdentity.hash === 'string' &&
      value.providerSettlementIdentity.hash.length > 0)) &&
  (value.sourceIdentity === undefined ||
    (isRecord(value.sourceIdentity) &&
      value.sourceIdentity.kind === 'evmTransactionHash' &&
      typeof value.sourceIdentity.hash === 'string' &&
      value.sourceIdentity.hash.length > 0)) &&
  (value.settlementIdentity === undefined ||
    (isRecord(value.settlementIdentity) &&
      value.settlementIdentity.kind === 'hyperliquidNonce' &&
      typeof value.settlementIdentity.nonce === 'number' &&
      Number.isSafeInteger(value.settlementIdentity.nonce) &&
      value.settlementIdentity.nonce > 0)) &&
  (value.sourceIdentity !== undefined ||
    value.settlementIdentity !== undefined) &&
  (value.sourceChainId === undefined ||
    typeof value.sourceChainId === 'string') &&
  (value.sourceTokenId === undefined ||
    typeof value.sourceTokenId === 'string') &&
  typeof value.createdAt === 'number' &&
  Number.isFinite(value.createdAt) &&
  value.createdAt >= 0 &&
  typeof value.updatedAt === 'number' &&
  Number.isFinite(value.updatedAt) &&
  value.updatedAt >= value.createdAt;

const isPerpsFundingJournal = (value: unknown): value is PerpsFundingJournal =>
  isRecord(value) &&
  value.version === 2 &&
  Array.isArray(value.entries) &&
  value.entries.length <= PERPS_FUNDING_JOURNAL_LIMIT &&
  value.entries.every(isPerpsFundingJournalEntry) &&
  new Set(value.entries.map(entry => entry.operationId)).size ===
    value.entries.length;

const isPerpsFundingJournalEntryV1 = (
  value: unknown,
): value is PerpsFundingJournalEntryV1 =>
  isRecord(value) &&
  value.version === 1 &&
  typeof value.operationId === 'string' &&
  value.operationId.length > 0 &&
  typeof value.accountAddress === 'string' &&
  value.accountAddress.length > 0 &&
  typeof value.accountType === 'string' &&
  value.accountType.length > 0 &&
  (value.direction === 'deposit' || value.direction === 'withdraw') &&
  (value.localType === 'deposit' ||
    value.localType === 'receive' ||
    value.localType === 'withdraw') &&
  (value.status === 'confirmed' ||
    value.status === 'failed' ||
    value.status === 'pending') &&
  typeof value.asset === 'string' &&
  value.asset.length > 0 &&
  typeof value.amount === 'string' &&
  value.amount.length > 0 &&
  typeof value.settlementAmount === 'string' &&
  value.settlementAmount.length > 0 &&
  typeof value.sourceHash === 'string' &&
  value.sourceHash.length > 0 &&
  (value.sourceChainId === undefined ||
    typeof value.sourceChainId === 'string') &&
  (value.sourceTokenId === undefined ||
    typeof value.sourceTokenId === 'string') &&
  typeof value.createdAt === 'number' &&
  Number.isFinite(value.createdAt) &&
  value.createdAt >= 0 &&
  typeof value.updatedAt === 'number' &&
  Number.isFinite(value.updatedAt) &&
  value.updatedAt >= value.createdAt;

const isPerpsFundingJournalV1 = (
  value: unknown,
): value is PerpsFundingJournalV1 =>
  isRecord(value) &&
  value.version === 1 &&
  Array.isArray(value.entries) &&
  value.entries.length <= PERPS_FUNDING_JOURNAL_LIMIT &&
  value.entries.every(isPerpsFundingJournalEntryV1) &&
  new Set(value.entries.map(entry => entry.operationId)).size ===
    value.entries.length;

const migratePerpsFundingJournalEntry = (
  entry: PerpsFundingJournalEntryV1,
): PerpsFundingJournalEntry => {
  const { sourceHash, version: _version, ...common } = entry;
  return {
    ...common,
    sourceIdentity: {
      hash: sourceHash,
      kind: 'evmTransactionHash',
    },
    version: 2,
  };
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

export class PerpsService extends StoreServiceBase<
  PerpsServiceStore,
  APP_STORE_NAMES.perps
> {
  // ~150KB write-once/read-once blob: bypasses createPersistStore (boot-time
  // clone + rewrite) and must own its own key — the perps store proxy
  // rewrites its whole object and would clobber foreign fields.
  private marketCacheStorage?: StorageAdapaterOptions['storageAdapter'];
  private attachedTpSlJournalStorage?: StorageAdapaterOptions['storageAdapter'];
  private fundingJournalStorage?: StorageAdapaterOptions['storageAdapter'];
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
        userAbstractionByAddress: {},
        proPreferences: DEFAULT_PERPS_PRO_PREFERENCES,
      },
      { storageAdapter: options?.storageAdapter },
    );
    this.keyringCrypto = options.keyringCrypto;
    this.marketCacheStorage = options?.storageAdapter;
    this.attachedTpSlJournalStorage = options?.storageAdapter;
    this.fundingJournalStorage = options?.storageAdapter;
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

  getPerpsAttachedTpSlJournal = (): PerpsAttachedTpSlJournalEntry[] => {
    const value = this.attachedTpSlJournalStorage?.getItem(
      APP_STORE_NAMES.perpsAttachedTpSlJournal,
    );
    if (value == null) {
      return [];
    }
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

  getPerpsFundingJournal = (): PerpsFundingJournalEntry[] => {
    const value = this.fundingJournalStorage?.getItem(
      APP_STORE_NAMES.perpsFundingJournal,
    );
    if (value == null) {
      return [];
    }
    if (isPerpsFundingJournal(value)) {
      return value.entries;
    }
    if (isPerpsFundingJournalV1(value)) {
      return value.entries.map(migratePerpsFundingJournalEntry);
    }
    throw new Error('Perps funding journal is invalid');
  };

  upsertPerpsFundingJournalEntry = (entry: PerpsFundingJournalEntry) => {
    if (!isPerpsFundingJournalEntry(entry)) {
      throw new Error('Perps funding journal entry is invalid');
    }
    const entries = [
      ...this.getPerpsFundingJournal().filter(
        item => item.operationId !== entry.operationId,
      ),
      entry,
    ]
      .sort(
        (left, right) =>
          right.updatedAt - left.updatedAt ||
          left.operationId.localeCompare(right.operationId),
      )
      .slice(0, PERPS_FUNDING_JOURNAL_LIMIT);
    this.fundingJournalStorage?.setItem(APP_STORE_NAMES.perpsFundingJournal, {
      entries,
      version: 2,
    } satisfies PerpsFundingJournal);
  };

  removePerpsFundingJournalEntry = (operationId: string) => {
    const entries = this.getPerpsFundingJournal().filter(
      entry => entry.operationId !== operationId,
    );
    if (entries.length === 0) {
      this.fundingJournalStorage?.removeItem(
        APP_STORE_NAMES.perpsFundingJournal,
      );
      return;
    }
    this.fundingJournalStorage?.setItem(APP_STORE_NAMES.perpsFundingJournal, {
      entries,
      version: 2,
    } satisfies PerpsFundingJournal);
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

  getUserAbstractionForAddress = async (address: string) => {
    if (!address) {
      return null;
    }
    return this.store.userAbstractionByAddress?.[address.toLowerCase()] ?? null;
  };

  setUserAbstractionForAddress = async (address: string, value: string) => {
    if (!address || !value) {
      return;
    }
    this.mutateStore(draft => {
      draft.userAbstractionByAddress = {
        ...(draft.userAbstractionByAddress || {}),
        [address.toLowerCase()]: value,
      };
    });
  };

  clearUserAbstractionForAddress = async (address: string) => {
    if (!address) {
      return;
    }
    this.mutateStore(draft => {
      const next = { ...(draft.userAbstractionByAddress || {}) };
      delete next[address.toLowerCase()];
      draft.userAbstractionByAddress = next;
    });
  };

  getPerpsViewMode = async (): Promise<PerpsViewMode> => {
    if (!this.store) {
      throw new Error('PerpsService not initialized');
    }

    return normalizePerpsViewMode(this.store.proPreferences);
  };

  getPerpsViewModePreference = async (): Promise<PerpsViewModePreference> => {
    if (!this.store) {
      throw new Error('PerpsService not initialized');
    }

    return {
      hasVisitedPro: normalizeHasVisitedPro(this.store.proPreferences),
      viewMode: normalizePerpsViewMode(this.store.proPreferences),
    };
  };

  setPerpsViewMode = async (viewMode: PerpsViewMode) => {
    const currentPreferences: unknown = this.store.proPreferences;
    this.mutateStore(draft => {
      draft.proPreferences = {
        ...getWritableProPreferences(currentPreferences),
        ...(viewMode === 'pro' ? { hasVisitedPro: true } : {}),
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

  getPerpsProInfoTabPreference =
    async (): Promise<PerpsProInfoTabPreference> => {
      if (!this.store) {
        throw new Error('PerpsService not initialized');
      }

      return {
        activeInfoTab: normalizePerpsProInfoTab(this.store.proPreferences),
        hasUserSelectedInfoTab: normalizeHasUserSelectedInfoTab(
          this.store.proPreferences,
        ),
      };
    };

  setPerpsProInfoTab = async (activeInfoTab: PerpsProInfoTab) => {
    const currentPreferences: unknown = this.store.proPreferences;
    this.mutateStore(draft => {
      draft.proPreferences = {
        ...getWritableProPreferences(currentPreferences),
        activeInfoTab,
        hasUserSelectedInfoTab: true,
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

  getSkipPerpsProMarketCloseConfirmation = async () => {
    if (!this.store) {
      throw new Error('PerpsService not initialized');
    }
    return normalizeSkipMarketCloseDoubleConfirmation(
      this.store.proPreferences,
    );
  };

  setSkipPerpsProMarketCloseConfirmation = async (value: boolean) => {
    const currentPreferences: unknown = this.store.proPreferences;
    this.mutateStore(draft => {
      draft.proPreferences = {
        ...getWritableProPreferences(currentPreferences),
        skipMarketCloseDoubleConfirmation: value === true,
      };
    });
  };

  getSkipPerpsProPositionTpSlConfirmation = async () => {
    if (!this.store) {
      throw new Error('PerpsService not initialized');
    }
    return normalizeSkipPositionTpSlDoubleConfirmation(
      this.store.proPreferences,
    );
  };

  setSkipPerpsProPositionTpSlConfirmation = async (value: boolean) => {
    const currentPreferences: unknown = this.store.proPreferences;
    this.mutateStore(draft => {
      draft.proPreferences = {
        ...getWritableProPreferences(currentPreferences),
        skipPositionTpSlDoubleConfirmation: value === true,
      };
    });
  };

  getSkipPerpsProOpenOrderEditConfirmation = async (
    category: PerpsProOpenOrderEditCategory,
  ) => {
    if (!this.store) {
      throw new Error('PerpsService not initialized');
    }
    return normalizeSkipOpenOrderEditConfirmationByCategory(
      this.store.proPreferences,
    )[category];
  };

  setSkipPerpsProOpenOrderEditConfirmation = async (
    category: PerpsProOpenOrderEditCategory,
    value: boolean,
  ) => {
    const current = getWritableProPreferences(this.store.proPreferences);
    this.mutateStore(draft => {
      draft.proPreferences = {
        ...current,
        skipOpenOrderEditConfirmationByCategory: {
          ...normalizeSkipOpenOrderEditConfirmationByCategory(current),
          [category]: value === true,
        },
      };
    });
  };

  getPerpsProTradeAmountUnit = async (): Promise<PerpsProTradeAmountUnit> => {
    if (!this.store) {
      throw new Error('PerpsService not initialized');
    }
    return normalizePerpsProTradeAmountUnit(this.store.proPreferences);
  };

  setPerpsProTradeAmountUnit = async (value: PerpsProTradeAmountUnit) => {
    const currentPreferences: unknown = this.store.proPreferences;
    this.mutateStore(draft => {
      draft.proPreferences = {
        ...getWritableProPreferences(currentPreferences),
        tradeAmountUnit: value === 'base' ? 'base' : 'quote',
      };
    });
  };

  getPerpsProTradeOrderType = async (): Promise<PerpsProTradeOrderType> => {
    if (!this.store) {
      throw new Error('PerpsService not initialized');
    }
    return normalizePerpsProTradeOrderType(this.store.proPreferences);
  };

  setPerpsProTradeOrderType = async (value: PerpsProTradeOrderType) => {
    if (value !== 'market' && value !== 'limit' && value !== 'conditional') {
      throw new Error('Invalid Perps Pro trade order type');
    }
    const currentPreferences: unknown = this.store.proPreferences;
    this.mutateStore(draft => {
      draft.proPreferences = {
        ...getWritableProPreferences(currentPreferences),
        tradeOrderType: value,
      };
    });
  };

  getSkipPerpsProTradeConfirmation = async (
    orderType: PerpsProTradeOrderType,
  ) => {
    if (!this.store) {
      throw new Error('PerpsService not initialized');
    }
    return normalizeSkipTradeConfirmationByOrderType(this.store.proPreferences)[
      orderType
    ];
  };

  setSkipPerpsProTradeConfirmation = async (
    orderType: PerpsProTradeOrderType,
    value: boolean,
  ) => {
    const current = getWritableProPreferences(this.store.proPreferences);
    this.mutateStore(draft => {
      draft.proPreferences = {
        ...current,
        skipTradeConfirmationByOrderType: {
          ...normalizeSkipTradeConfirmationByOrderType(current),
          [orderType]: value === true,
        },
      };
    });
  };

  getPerpsProTpSlModePreferences =
    async (): Promise<PerpsProTpSlModePreferences> => {
      if (!this.store) {
        throw new Error('PerpsService not initialized');
      }
      return cloneDeep(
        normalizePerpsProTpSlModePreferences(this.store.proPreferences),
      );
    };

  setPerpsProTpSlModePreference = async (
    selection: PerpsProTpSlModePreferenceSelection,
  ) => {
    const { leg, mode, surface } = selection;
    const validMode =
      surface === 'opening'
        ? mode === 'price' || mode === 'pnl' || mode === 'roi'
        : surface === 'position'
        ? mode === 'pnl' || mode === 'roi'
        : false;
    if (
      (surface !== 'opening' && surface !== 'position') ||
      (leg !== 'tp' && leg !== 'sl') ||
      !validMode
    ) {
      throw new Error('Invalid Perps Pro TP/SL mode preference');
    }
    const current = getWritableProPreferences(this.store.proPreferences);
    const currentModes = normalizePerpsProTpSlModePreferences(current);
    this.mutateStore(draft => {
      draft.proPreferences = {
        ...current,
        tpSlModePreferences: {
          ...currentModes,
          [surface]: {
            ...currentModes[surface],
            [leg]: mode,
          },
        },
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
