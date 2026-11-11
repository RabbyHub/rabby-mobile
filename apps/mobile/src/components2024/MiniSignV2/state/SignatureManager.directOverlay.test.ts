import type { SignerCtx } from '../domain/ctx';
import { signatureService } from '../services/SignatureService';
import { getDirectOverlayPhase } from './directOverlay';
import { MINI_SIGN_ERROR, SignatureManager } from './SignatureManager';
import type { SignatureRequest } from './types';

// Only process boundaries are replaced: the signing service (network and
// keyring), hardware transports and the transaction history store.
jest.mock('../services/SignatureService', () => ({
  signatureService: {
    fingerprint: (txs: unknown) => JSON.stringify(txs),
    prepare: jest.fn(),
    send: jest.fn(),
  },
}));
jest.mock('@/core/apis', () => ({ apiLedger: {}, apiOneKey: {} }));
jest.mock('@/hooks/ledger/useLedgerStatus', () => ({
  callConnectLedgerModal: jest.fn(),
  setLedgerStatus: jest.fn(),
}));
jest.mock('@/hooks/onekey/useOneKeyStatus', () => ({
  callConnectOneKeyModal: jest.fn(),
  setOneKeyStatus: jest.fn(),
}));
jest.mock('@/core/serviceApi/transactionHistory', () => ({
  transactionHistoryServiceApi: {
    removeSigningTx: jest.fn(() => Promise.resolve()),
  },
}));
jest.mock('./MiniSignGasPanelController', () => ({
  getMiniSignGasPanelController: () => ({ reset: jest.fn() }),
}));
jest.mock('./blockedAddressDialog', () => ({
  showBlockedAddressDialog: jest.fn(),
}));
jest.mock('@/utils/chain', () => ({ findChain: jest.fn() }));

const prepare = signatureService.prepare as jest.Mock;
const send = signatureService.send as jest.Mock;

const request = {
  txs: [{ chainId: 56, from: '0x1', to: '0x2' }],
  config: { account: { type: 'SimpleKeyring', address: '0x1' } },
} as unknown as SignatureRequest;

const preparedCtx = {
  mode: 'ui',
  txs: request.txs,
  chainId: 56,
  txsCalc: [{ preExecResult: { pre_exec: { success: true } } }],
  gasMethod: 'native',
  checkErrors: [],
} as unknown as SignerCtx;

beforeEach(() => {
  prepare.mockReset();
  send.mockReset();
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('SignatureManager direct overlay', () => {
  it('drops the overlay when a prefetch fails after direct signing started', async () => {
    let failPrepare: (error: Error) => void = () => undefined;
    prepare.mockReturnValue(
      new Promise((_, reject) => {
        failPrepare = reject;
      }),
    );
    const manager = new SignatureManager();

    manager.prefetch(request).catch(() => undefined);
    const result = manager.openDirect(request);
    // The user tapped Confirm while the prefetch was still running.
    expect(getDirectOverlayPhase(manager.getState())).toBe('prefetching');

    failPrepare(new Error('rpc down'));
    await expect(result).rejects.toThrow(MINI_SIGN_ERROR.PREFETCH_FAILURE);

    expect(manager.getState().status).toBe('prefetch_failure');
    expect(getDirectOverlayPhase(manager.getState())).toBeNull();
  });

  it('drops the overlay when sending fails with the error UI hidden', async () => {
    prepare.mockResolvedValue(preparedCtx);
    let failSend: (value: unknown) => void = () => undefined;
    send.mockReturnValue(
      new Promise(resolve => {
        failSend = resolve;
      }),
    );
    const manager = new SignatureManager();

    await manager.prefetch(request);
    const result = manager.openDirect(request, { isHideErrorUI: true });
    await Promise.resolve();
    await Promise.resolve();
    expect(getDirectOverlayPhase(manager.getState())).toBe('signing');

    failSend({ error: { description: 'user rejected' } });
    await expect(result).rejects.toBe('user rejected');

    expect(manager.getState().status).toBe('ready');
    expect(getDirectOverlayPhase(manager.getState())).toBeNull();
  });

  it('keeps the overlay for the whole of a successful direct signing', async () => {
    prepare.mockResolvedValue(preparedCtx);
    let finishSend: (value: unknown) => void = () => undefined;
    send.mockReturnValue(
      new Promise(resolve => {
        finishSend = resolve;
      }),
    );
    const manager = new SignatureManager();

    await manager.prefetch(request);
    const result = manager.openDirect(request);
    await Promise.resolve();
    await Promise.resolve();
    expect(getDirectOverlayPhase(manager.getState())).toBe('signing');

    finishSend([{ txHash: '0xabc' }]);
    await expect(result).resolves.toEqual(['0xabc']);

    expect(manager.getState().status).toBe('idle');
  });
});
