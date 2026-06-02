import { isNonPublicProductionEnv } from '@/constant';
import { RABBY_MOBILE_WALLETCONNECT_PROJECT_ID } from '@/constant/env';
import { WALLETCONNECT_LOG_LIMIT } from './constants';
import type {
  WalletConnectDebugLogEntry,
  WalletConnectDebugState,
} from './types';

type Listener = () => void;
type StateUpdater =
  | Partial<WalletConnectDebugState>
  | ((prev: WalletConnectDebugState) => WalletConnectDebugState);

const initialState: WalletConnectDebugState = {
  enabled: isNonPublicProductionEnv,
  projectId: RABBY_MOBILE_WALLETCONNECT_PROJECT_ID,
  projectIdConfigured: !!RABBY_MOBILE_WALLETCONNECT_PROJECT_ID,
  client: {
    status: isNonPublicProductionEnv ? 'idle' : 'disabled',
  },
  pairing: {
    status: 'idle',
  },
  sessions: [],
  pendingRequests: [],
  log: [],
};

let state = initialState;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach(listener => listener());
}

export function getWalletConnectDebugState() {
  return state;
}

export function subscribeWalletConnectDebugState(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setWalletConnectDebugState(updater: StateUpdater) {
  state =
    typeof updater === 'function'
      ? updater(state)
      : {
          ...state,
          ...updater,
        };
  emit();
}

export function appendWalletConnectLog(entry: WalletConnectDebugLogEntry) {
  setWalletConnectDebugState(prev => ({
    ...prev,
    log: [entry, ...prev.log].slice(0, WALLETCONNECT_LOG_LIMIT),
  }));
}

export function setWalletConnectClientStatus(
  status: WalletConnectDebugState['client']['status'],
  error?: string,
) {
  setWalletConnectDebugState(prev => ({
    ...prev,
    client: {
      status,
      error,
    },
  }));
}
