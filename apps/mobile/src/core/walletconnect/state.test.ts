import {
  clearWalletConnectProposalPairingState,
  getWalletConnectDebugState,
  setWalletConnectDebugState,
} from './state';
import type { WalletConnectDebugState } from './types';

function setPairing(pairing: WalletConnectDebugState['pairing']) {
  setWalletConnectDebugState(prev => ({
    ...prev,
    pairing,
  }));
}

describe('walletconnect state', () => {
  it('only clears pairing state owned by the current proposal', () => {
    setPairing({
      status: 'pairing',
      source: 'manual',
      uri: 'wc:def456@2?relay-protocol=irn&symKey=abcdef',
    });

    clearWalletConnectProposalPairingState();
    expect(getWalletConnectDebugState().pairing).toMatchObject({
      status: 'pairing',
      uri: 'wc:def456@2?relay-protocol=irn&symKey=abcdef',
    });

    setPairing({
      status: 'proposal',
      source: 'qr',
      uri: 'wc:abc123@2?relay-protocol=irn&symKey=012345',
    });

    clearWalletConnectProposalPairingState();
    expect(getWalletConnectDebugState().pairing).toEqual({
      status: 'idle',
    });
  });
});
