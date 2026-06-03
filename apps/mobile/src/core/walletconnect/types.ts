import type { ProposalTypes } from '@walletconnect/types';

export type WalletConnectNamespace = {
  chains?: string[];
  accounts?: string[];
  methods?: string[];
  events?: string[];
};

export type WalletConnectNamespaces = Record<string, WalletConnectNamespace>;

export type WalletConnectPairingSource = 'qr' | 'manual' | 'deeplink';

export type WalletConnectClientStatus =
  | 'idle'
  | 'initializing'
  | 'ready'
  | 'error';

export type WalletConnectPairingStatus =
  | 'idle'
  | 'pairing'
  | 'proposal'
  | 'error';

export type WalletConnectLogLevel = 'info' | 'warn' | 'error';

export type WalletConnectDebugLogEntry = {
  id: number;
  ts: number;
  level: WalletConnectLogLevel;
  scope: string;
  message: string;
  data?: string;
};

export type WalletConnectDappMetadata = {
  name: string;
  description?: string;
  url?: string;
  icons?: string[];
  redirectNative?: string;
};

export type WalletConnectProposalViewModel = {
  id: number;
  source: WalletConnectPairingSource;
  receivedAt: number;
  proposer: WalletConnectDappMetadata;
  requiredNamespaces: ProposalTypes.RequiredNamespaces;
  optionalNamespaces: ProposalTypes.OptionalNamespaces;
  requestedChains: string[];
  requestedMethods: string[];
  unsupportedRequiredChains: string[];
  unsupportedRequiredMethods: string[];
  verifyContext?: unknown;
  error?: string;
};

export type WalletConnectSessionViewModel = {
  topic: string;
  peer: WalletConnectDappMetadata;
  chains: string[];
  methods: string[];
  accounts: string[];
  selectedAccount?: {
    address: string;
    type?: string;
    brandName?: string;
  };
};

export type WalletConnectDebugState = {
  projectId: string;
  client: {
    status: WalletConnectClientStatus;
    error?: string;
  };
  pairing: {
    status: WalletConnectPairingStatus;
    source?: WalletConnectPairingSource;
    uri?: string;
    error?: string;
  };
  proposal?: WalletConnectProposalViewModel;
  sessions: WalletConnectSessionViewModel[];
  log: WalletConnectDebugLogEntry[];
};
