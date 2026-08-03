import { filterSyncExtensionTransferMetadata } from './syncExtensionTransferMetadata';
import { MAX_SYNC_METADATA_ENTRIES } from './syncExtensionTransfer';

const TRANSFERRED = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const TRANSFERRED_MIXED_CASE = '0xAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAa';
const EXISTING_ONLY = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

describe('filterSyncExtensionTransferMetadata', () => {
  it('only accepts metadata belonging to accounts proven by the decrypted vault', () => {
    expect(
      filterSyncExtensionTransferMetadata({
        transferredAccounts: [
          {
            address: TRANSFERRED,
            brandName: 'Watch Address',
            type: 'Watch Address',
          },
        ],
        whitelist: [
          TRANSFERRED,
          TRANSFERRED_MIXED_CASE,
          EXISTING_ONLY,
          'invalid',
        ],
        highligtedAddresses: [
          { address: TRANSFERRED, brandName: 'Watch Address' },
          {
            address: TRANSFERRED_MIXED_CASE,
            brandName: 'Watch Address',
          },
          { address: TRANSFERRED, brandName: 'Forged Brand' },
          { address: EXISTING_ONLY, brandName: 'Watch Address' },
        ],
        alianNames: [
          { address: TRANSFERRED, name: 'Transferred' },
          { address: TRANSFERRED_MIXED_CASE, name: 'Duplicate' },
          { address: EXISTING_ONLY, name: 'Tampered existing wallet' },
          { address: TRANSFERRED, name: 'x'.repeat(257) },
        ],
      }),
    ).toStrictEqual({
      whitelist: [TRANSFERRED],
      highligtedAddresses: [
        { address: TRANSFERRED, brandName: 'Watch Address' },
      ],
      alianNames: [{ address: TRANSFERRED, name: 'Transferred' }],
    });
  });

  it('rejects metadata entry counts that bypass the payload parser', () => {
    expect(() =>
      filterSyncExtensionTransferMetadata({
        transferredAccounts: [],
        whitelist: Array(MAX_SYNC_METADATA_ENTRIES + 1).fill(TRANSFERRED),
        highligtedAddresses: [],
        alianNames: [],
      }),
    ).toThrow('Invalid wallet transfer metadata');
  });
});
