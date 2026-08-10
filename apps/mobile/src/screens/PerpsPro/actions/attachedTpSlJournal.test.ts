import type { PerpsAttachedTpSlJournalEntry } from '@/core/services/perpsService';

import {
  applyAttachedTpSlBatchToJournalEntry,
  createPreparedAttachedTpSlJournalEntry,
  findAttachedTpSlSubmissionBlock,
} from './attachedTpSlJournal';

const prepared = (): PerpsAttachedTpSlJournalEntry =>
  createPreparedAttachedTpSlJournalEntry({
    accountAddress: '0xabc',
    accountType: 'PrivateKey',
    cloids: { parent: '0x11111111111111111111111111111111' },
    coin: 'BTC',
    commandId: 'command-1',
    createdAt: 1,
    dexId: '',
    marketKey: 'BTC:USDC',
    parentFingerprint: 'parent-1',
    parentSide: 'buy',
  });

const lookup = { ...prepared(), parentFingerprint: 'parent-1' };

describe('attached TP/SL journal policy', () => {
  it('blocks the whole scope for prepared/partial/unknown entries', () => {
    expect(findAttachedTpSlSubmissionBlock([prepared()], lookup)?.kind).toBe(
      'scope',
    );
    expect(
      findAttachedTpSlSubmissionBlock([{ ...prepared(), outcome: 'unknown' }], {
        ...lookup,
        parentFingerprint: 'different-parent',
      })?.kind,
    ).toBe('scope');
  });

  it('blocks only the same parent fingerprint after deterministic child rejection', () => {
    const rejected = { ...prepared(), outcome: 'childRejected' as const };
    expect(findAttachedTpSlSubmissionBlock([rejected], lookup)?.kind).toBe(
      'parentFingerprint',
    );
    expect(
      findAttachedTpSlSubmissionBlock([rejected], {
        ...lookup,
        parentFingerprint: 'parent-2',
      }),
    ).toBeNull();
  });

  it('blocks retrying the same completed command but permits a new command', () => {
    expect(
      findAttachedTpSlSubmissionBlock(
        [{ ...prepared(), outcome: 'fullAccepted' }],
        lookup,
      )?.kind,
    ).toBe('commandIdentity');
    expect(
      findAttachedTpSlSubmissionBlock(
        [{ ...prepared(), outcome: 'fullAccepted' }],
        { ...lookup, commandId: 'command-2' },
      ),
    ).toBeNull();
  });

  it('persists every leg and transport evidence from a partial batch', () => {
    const updated = applyAttachedTpSlBatchToJournalEntry(
      prepared(),
      {
        evidence: {
          error: {
            message: 'timeout',
            requestDispatched: true,
          },
          nonce: 9,
          rawStatuses: [],
          requestLegs: [],
          transportPhase: 'dispatched',
        },
        kind: 'partialOutcome',
        legs: [
          {
            acceptance: 'filled',
            cloid: '0x11111111111111111111111111111111',
            kind: 'accepted',
            oid: 7,
            rawStatus: {},
            role: 'parent',
          },
        ],
      },
      2,
    );

    expect(updated).toMatchObject({
      legs: [{ kind: 'accepted', oid: 7, role: 'parent' }],
      outcome: 'partial',
      transport: { error: 'timeout', nonce: 9, phase: 'dispatched' },
      updatedAt: 2,
    });
  });
});
