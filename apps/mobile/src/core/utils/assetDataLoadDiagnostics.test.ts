import type { AssetDataLoadDiagnosticRecord } from './assetDataLoadDiagnostics';
import { summarizeAssetDataLoadSettlements } from './assetDataLoadDiagnostics';

const record = (
  input: Partial<AssetDataLoadDiagnosticRecord> &
    Pick<
      AssetDataLoadDiagnosticRecord,
      'id' | 'requestId' | 'domain' | 'phase'
    >,
): AssetDataLoadDiagnosticRecord => ({
  address: '0xabc',
  timestamp: input.id,
  elapsedMs: input.id,
  deltaMs: 1,
  ...input,
});

describe('summarizeAssetDataLoadSettlements', () => {
  it('tracks a request reused after the cursor even when it started earlier', () => {
    const records = [
      record({
        id: 1,
        requestId: 10,
        domain: 'multi-address-token',
        phase: 'started',
      }),
      record({
        id: 3,
        requestId: 10,
        domain: 'multi-address-token',
        phase: 'cache-responses-completed',
      }),
      record({
        id: 4,
        requestId: 10,
        domain: 'multi-address-token',
        phase: 'completed',
        details: { path: 'native-remote' },
      }),
    ];

    expect(
      summarizeAssetDataLoadSettlements(records, 2, ['multi-address-token']),
    ).toEqual([
      expect.objectContaining({
        requestIds: [10],
        terminalRequestIds: [10],
        pendingRequestIds: [],
        phase: 'completed',
        paths: ['native-remote'],
      }),
    ]);
  });

  it('waits for every request observed for the same domain', () => {
    const records = [
      record({
        id: 2,
        requestId: 20,
        domain: 'multi-address-nft',
        phase: 'started',
      }),
      record({
        id: 3,
        requestId: 21,
        domain: 'multi-address-nft',
        phase: 'started',
      }),
      record({
        id: 4,
        requestId: 20,
        domain: 'multi-address-nft',
        phase: 'completed',
      }),
    ];

    expect(
      summarizeAssetDataLoadSettlements(records, 1, ['multi-address-nft']),
    ).toEqual([
      expect.objectContaining({
        requestIds: [20, 21],
        terminalRequestIds: [20],
        pendingRequestIds: [21],
        phase: null,
      }),
    ]);
  });

  it('reports a terminal failure after all observed requests settle', () => {
    const records = [
      record({
        id: 2,
        requestId: 30,
        domain: 'multi-address-protocol',
        phase: 'started',
      }),
      record({
        id: 3,
        requestId: 30,
        domain: 'multi-address-protocol',
        phase: 'failed',
      }),
    ];

    expect(
      summarizeAssetDataLoadSettlements(records, 1, ['multi-address-protocol']),
    ).toEqual([
      expect.objectContaining({
        failedRequestIds: [30],
        pendingRequestIds: [],
        phase: 'failed',
      }),
    ]);
  });
});
