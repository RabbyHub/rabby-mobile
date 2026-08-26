import {
  ASSET_SYNC_WORKER_SCHEMA_VERSION,
  type TokenAddressSyncReceipt,
  type TokenAssetSyncReceipt,
} from './protocol';
import { buildTokenAssetSyncRetryPlan } from './tokenRetryPlan';

const makeAddressReceipt = (
  overrides: Partial<TokenAddressSyncReceipt> = {},
): TokenAddressSyncReceipt => ({
  schemaVersion: ASSET_SYNC_WORKER_SCHEMA_VERSION,
  requestId: 'request-1',
  kind: 'token',
  success: true,
  address: '0xa',
  outcome: 'complete',
  generation: 1,
  committedAt: 1,
  replacementScope: 'address',
  chainIds: ['eth'],
  failedChainIds: [],
  committedRowCount: 1,
  superseded: false,
  stage: 'committed',
  errorCode: '',
  ...overrides,
});

const makeReceipt = (
  addresses: TokenAddressSyncReceipt[],
): TokenAssetSyncReceipt => ({
  schemaVersion: ASSET_SYNC_WORKER_SCHEMA_VERSION,
  requestId: 'request-1',
  kind: 'token',
  outcome: 'partial',
  startedAt: 1,
  finishedAt: 2,
  addresses,
});

describe('token asset sync retry plan', () => {
  it('uses a full fallback when the worker produced no receipt', () => {
    expect(buildTokenAssetSyncRetryPlan(['0xA', '0xB'], null)).toEqual([
      { address: '0xa', chainIds: null },
      { address: '0xb', chainIds: null },
    ]);
  });

  it('skips complete addresses and retries only failed partial chains', () => {
    const receipt = makeReceipt([
      makeAddressReceipt({ address: '0xa' }),
      makeAddressReceipt({
        address: '0xb',
        outcome: 'partial',
        replacementScope: 'chains',
        chainIds: ['eth'],
        failedChainIds: ['arb', 'op'],
        errorCode: 'asset_sync_partial_chain_failure',
      }),
    ]);

    expect(buildTokenAssetSyncRetryPlan(['0xA', '0xB'], receipt)).toEqual([
      { address: '0xb', chainIds: ['arb', 'op'] },
    ]);
  });

  it('fully retries failed, missing, or superseded address completions', () => {
    const receipt = makeReceipt([
      makeAddressReceipt({
        address: '0xa',
        success: false,
        outcome: 'failed',
        committedAt: 0,
        chainIds: [],
        committedRowCount: 0,
        stage: 'used-chain-list',
        errorCode: 'network',
      }),
      makeAddressReceipt({ address: '0xb', superseded: true }),
    ]);

    expect(
      buildTokenAssetSyncRetryPlan(['0xA', '0xB', '0xC'], receipt),
    ).toEqual([
      { address: '0xa', chainIds: null },
      { address: '0xb', chainIds: null },
      { address: '0xc', chainIds: null },
    ]);
  });
});
