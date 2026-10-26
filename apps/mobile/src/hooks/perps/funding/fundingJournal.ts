import type { Account } from '@/core/startupServices/preference';
import { perpsServiceApi } from '@/core/serviceApi/perps';
import type {
  PerpsFundingJournalEntry,
  PerpsFundingJournalStatus,
} from '@/core/services/perpsService';
import type { PerpsFundingConfirmation } from './types';

export const getPerpsPendingFundingCount = (
  items: readonly { status: string; type: string }[],
) =>
  items.reduce(
    (count, item) =>
      item.status === 'pending' &&
      (item.type === 'deposit' ||
        item.type === 'receive' ||
        item.type === 'withdraw')
        ? count + 1
        : count,
    0,
  );

export const getPerpsFundingAccountIdentity = (
  account: Pick<Account, 'address' | 'type'>,
) => `${account.address.toLowerCase()}::${account.type}`;

export const persistPerpsFundingJournalEntry = async (
  entry: PerpsFundingJournalEntry,
) => {
  try {
    await perpsServiceApi.upsertPerpsFundingJournalEntry(entry);
  } catch (error) {
    console.error('[perpsFunding] failed to persist operation', error);
  }
};

export const readPerpsFundingJournal = async () => {
  try {
    return await perpsServiceApi.getPerpsFundingJournal();
  } catch (error) {
    console.error('[perpsFunding] failed to read operation journal', error);
    return [];
  }
};

export const updatePerpsFundingJournalStatus = async (
  operationId: string,
  status: PerpsFundingJournalStatus,
  updatedAt = Date.now(),
) => {
  const entries = await readPerpsFundingJournal();
  const entry = entries.find(item => item.operationId === operationId);
  if (!entry || entry.status === status) {
    return;
  }
  await persistPerpsFundingJournalEntry({ ...entry, status, updatedAt });
};

export const applyPerpsFundingConfirmationToJournalEntry = (
  entry: PerpsFundingJournalEntry,
  confirmation: PerpsFundingConfirmation,
  updatedAt = Date.now(),
): PerpsFundingJournalEntry => ({
  ...entry,
  providerSettlementIdentity:
    confirmation.providerSettlementIdentity ?? entry.providerSettlementIdentity,
  status: 'confirmed',
  updatedAt,
});

export const confirmPerpsFundingJournalEntry = async (
  confirmation: PerpsFundingConfirmation,
  updatedAt = Date.now(),
) => {
  const entries = await readPerpsFundingJournal();
  const entry = entries.find(
    item => item.operationId === confirmation.operationId,
  );
  if (!entry) {
    return;
  }
  const providerSettlementIdentity =
    confirmation.providerSettlementIdentity ?? entry.providerSettlementIdentity;
  if (
    entry.status === 'confirmed' &&
    entry.providerSettlementIdentity?.hash === providerSettlementIdentity?.hash
  ) {
    return;
  }
  await persistPerpsFundingJournalEntry(
    applyPerpsFundingConfirmationToJournalEntry(entry, confirmation, updatedAt),
  );
};

export const isPerpsFundingJournalEntryForAccount = (
  entry: PerpsFundingJournalEntry,
  account: Pick<Account, 'address' | 'type'>,
) =>
  entry.accountAddress.toLowerCase() === account.address.toLowerCase() &&
  entry.accountType === account.type;
