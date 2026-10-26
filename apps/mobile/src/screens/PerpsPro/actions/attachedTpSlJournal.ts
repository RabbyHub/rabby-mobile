import type {
  NormalTpslBatchEvidence,
  NormalTpslBatchResult,
  NormalTpslCloids,
  NormalTpslLegResult,
} from '@rabby-wallet/hyperliquid-sdk';

import type {
  PerpsAttachedTpSlJournalEntry,
  PerpsAttachedTpSlJournalLeg,
} from '@/core/services/perpsService';
import { perpsServiceApi } from '@/core/serviceApi/perps';

export type AttachedTpSlSubmissionBlock =
  | { kind: 'commandIdentity'; entry: PerpsAttachedTpSlJournalEntry }
  | { kind: 'parentFingerprint'; entry: PerpsAttachedTpSlJournalEntry }
  | { kind: 'scope'; entry: PerpsAttachedTpSlJournalEntry };

const sameScope = (
  entry: PerpsAttachedTpSlJournalEntry,
  input: {
    accountAddress: string;
    accountType: string;
    dexId: string;
    marketKey: string;
  },
) =>
  entry.accountAddress.toLowerCase() === input.accountAddress.toLowerCase() &&
  entry.accountType === input.accountType &&
  entry.dexId === input.dexId &&
  entry.marketKey === input.marketKey;

export const findAttachedTpSlSubmissionBlock = (
  entries: readonly PerpsAttachedTpSlJournalEntry[],
  input: {
    accountAddress: string;
    accountType: string;
    dexId: string;
    marketKey: string;
    parentFingerprint: string;
    commandId: string;
  },
): AttachedTpSlSubmissionBlock | null => {
  for (const entry of entries) {
    if (!sameScope(entry, input)) continue;
    if (
      entry.outcome === 'fullAccepted' &&
      entry.commandId === input.commandId
    ) {
      return { entry, kind: 'commandIdentity' };
    }
    if (entry.outcome === 'childRejected') {
      if (entry.parentFingerprint === input.parentFingerprint) {
        return { entry, kind: 'parentFingerprint' };
      }
      continue;
    }
    if (entry.outcome !== 'fullAccepted') {
      return { entry, kind: 'scope' };
    }
  }
  return null;
};

const normalizeLeg = (leg: NormalTpslLegResult): PerpsAttachedTpSlJournalLeg =>
  leg.kind === 'accepted'
    ? {
        acceptance: leg.acceptance,
        cloid: leg.cloid,
        kind: leg.kind,
        oid: leg.oid,
        role: leg.role,
      }
    : leg.kind === 'rejected'
    ? {
        cloid: leg.cloid,
        error: leg.error,
        kind: leg.kind,
        role: leg.role,
      }
    : {
        cloid: leg.cloid,
        error: leg.reason,
        kind: leg.kind,
        role: leg.role,
      };

const normalizeTransport = (evidence?: NormalTpslBatchEvidence) =>
  evidence
    ? {
        error: evidence.error?.message,
        nonce: evidence.nonce,
        phase: evidence.transportPhase,
      }
    : undefined;

export const createPreparedAttachedTpSlJournalEntry = (input: {
  accountAddress: string;
  accountType: string;
  cloids: NormalTpslCloids;
  coin: string;
  commandId: string;
  createdAt: number;
  dexId: string;
  marketKey: string;
  parentFingerprint: string;
  parentSide: 'buy' | 'sell';
}): PerpsAttachedTpSlJournalEntry => ({
  ...input,
  legs: [],
  outcome: 'prepared',
  updatedAt: input.createdAt,
  version: 1,
});

export const applyAttachedTpSlBatchToJournalEntry = (
  entry: PerpsAttachedTpSlJournalEntry,
  batch: Extract<
    NormalTpslBatchResult,
    {
      kind:
        | 'childRejected'
        | 'fullAccepted'
        | 'partialOutcome'
        | 'unknownOutcome';
    }
  >,
  updatedAt: number,
): PerpsAttachedTpSlJournalEntry => ({
  ...entry,
  legs: batch.legs.map(normalizeLeg),
  outcome:
    batch.kind === 'partialOutcome'
      ? 'partial'
      : batch.kind === 'unknownOutcome'
      ? 'unknown'
      : batch.kind,
  transport: normalizeTransport(batch.evidence),
  updatedAt,
});

export interface AttachedTpSlJournalDependencies {
  getEntries: () =>
    | PerpsAttachedTpSlJournalEntry[]
    | Promise<PerpsAttachedTpSlJournalEntry[]>;
  remove: (commandId: string) => void | Promise<void>;
  upsert: (entry: PerpsAttachedTpSlJournalEntry) => void | Promise<void>;
}

export const defaultAttachedTpSlJournalDependencies: AttachedTpSlJournalDependencies =
  {
    getEntries: () => perpsServiceApi.getPerpsAttachedTpSlJournal(),
    remove: commandId =>
      perpsServiceApi.removePerpsAttachedTpSlJournalEntry(commandId),
    upsert: entry => perpsServiceApi.upsertPerpsAttachedTpSlJournalEntry(entry),
  };
