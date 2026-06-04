import type { WalletConnectProposalViewModel } from './types';

export type WalletConnectUiEvent =
  | {
      type: 'pairingStarted';
    }
  | {
      type: 'pairingError';
      message: string;
    }
  | {
      type: 'proposalReceived';
      proposal: WalletConnectProposalViewModel;
    }
  | {
      type: 'proposalCleared';
    };

type WalletConnectUiEventListener = (event: WalletConnectUiEvent) => void;

const listeners = new Set<WalletConnectUiEventListener>();

export function emitWalletConnectUiEvent(event: WalletConnectUiEvent) {
  listeners.forEach(listener => listener(event));
}

export function subscribeWalletConnectUiEvents(
  listener: WalletConnectUiEventListener,
) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
