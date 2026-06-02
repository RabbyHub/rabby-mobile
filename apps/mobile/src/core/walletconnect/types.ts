import type { Account } from '@/types/account';

export type WalletConnectPairingSource = 'qr' | 'manual' | 'deeplink';

export type WalletConnectClientStatus =
  | 'idle'
  | 'initializing'
  | 'ready'
  | 'disabled'
  | 'error';

export type WalletConnectPairingStatus =
  | 'idle'
  | 'validating'
  | 'pairing'
  | 'paired'
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
  requiredNamespaces: Record<string, any>;
  optionalNamespaces: Record<string, any>;
  requestedChains: string[];
  requestedMethods: string[];
  unsupportedChains: string[];
  unsupportedMethods: string[];
  verifyContext?: unknown;
  error?: string;
};

export type WalletConnectSessionViewModel = {
  topic: string;
  peer: WalletConnectDappMetadata;
  source: WalletConnectPairingSource;
  chains: string[];
  methods: string[];
  accounts: string[];
  selectedAccount?: {
    address: string;
    type?: string;
    brandName?: string;
  };
};

export type WalletConnectPendingRequestViewModel = {
  id: number;
  topic: string;
  chainId: string;
  method: string;
  receivedAt: number;
  peer?: WalletConnectDappMetadata;
};

export type WalletConnectDebugState = {
  enabled: boolean;
  projectId: string;
  projectIdConfigured: boolean;
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
  pendingRequests: WalletConnectPendingRequestViewModel[];
  log: WalletConnectDebugLogEntry[];
};

export type WalletConnectStoredSessionAccount = Pick<
  Account,
  'address' | 'type' | 'brandName'
>;
