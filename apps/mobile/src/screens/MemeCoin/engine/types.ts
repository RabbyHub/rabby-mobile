/** Chain server id, e.g. 'eth' | 'bsc' | 'base' */
export type ChainServerId = string;

export type TokenRef = {
  id: string;
  chain: ChainServerId;
  symbol: string;
};

export type MemeTarget = TokenRef & {
  marketCap: number;
};

export type PaymentAsset = TokenRef & {
  usdValue: number;
  price: number;
  isNative: boolean;
};

export type ChainGasInfo = {
  /** USD reserved for one leg sent from this chain (Swap "Max" gasLimit × normal gas price) */
  perLegGasUsd: number;
  /** USD value of the chain's native token held by the account, selected or not */
  nativeBalanceUsd: number;
  /** Rabby Bridge supports this chain as a source chain */
  bridgeSupported: boolean;
};

/** how the buy amount is split across the memes */
export type AllocationMode = 'marketCap' | 'equal';

export type PlanInput = {
  amountUsd: number;
  memes: MemeTarget[];
  allocationMode: AllocationMode;
  sources: PaymentAsset[];
  chainGas: Record<ChainServerId, ChainGasInfo>;
  /** Gas Deposit balance in USD, shared by all chains */
  gasAccountBalanceUsd: number;
};

export type GasPayer = 'native' | 'gasAccount' | 'risk';

export type LegKind = 'swap' | 'bridge';

export type PlannedLeg = {
  key: string;
  kind: LegKind;
  pay: TokenRef;
  receive: TokenRef;
  amountUsd: number;
  gasPayer: GasPayer;
};

export type PlanResult = {
  /** sorted by amountUsd desc (D16) */
  legs: PlannedLeg[];
  /** tokenKey(pay) -> USD */
  paymentBySource: Record<string, number>;
  spendableTotalUsd: number;
  /** amountUsd minus what could actually be allocated */
  shortfallUsd: number;
};

export type ExecLeg = {
  key: string;
  kind: LegKind;
  pay: TokenRef;
  receive: TokenRef;
  /** buy: planned USD; sell: holding value (display only) */
  amountUsd: number;
  /** sell: spend the whole balance instead of amountUsd */
  payAll: boolean;
};

export type FailReason =
  | 'noQuote'
  | 'priceImpact'
  | 'gasNotEnough'
  | 'gasTooHigh'
  | 'simulationFailed'
  | 'insufficientBalance'
  /** bridge only: the source tx is mined, so the funds may still be on the way */
  | 'arrivalFailed'
  | 'failed';

export type LegPhase =
  | 'idle'
  | 'queued'
  | 'preparing'
  | 'confirming'
  | 'arriving'
  | 'success'
  | 'failed'
  | 'cancelled';

export type LegState = {
  phase: LegPhase;
  failReason?: FailReason;
  txHash?: string;
};

export type DisplayStatus =
  | 'pending'
  | 'pendingPrevious'
  | 'executing'
  | 'success'
  | 'failed'
  | 'hidden';
