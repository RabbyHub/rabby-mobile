/**
 * Non-production only: seed the app with the private keys / mnemonics that the
 * cold-start KPI runs measure against.
 *
 * Driven by the `debug-import-test-accounts` deeplink so a device-automation
 * run can build a realistic account set without driving the import UI:
 *
 *   rabbygo://go.rabby.io/mobile/debug-import-test-accounts?path=<file>
 *
 * The file is read from the device (the runner pushes it), and every line is
 * one entry:
 *
 *   0xabc...def  some note        -> private key (the note is ignored)
 *   word word ... word             -> mnemonic (12/15/18/21/24 words)
 *   # comment / blank line         -> ignored
 *
 * The same data mutations as the import screens are used, in the same order,
 * so the persisted accounts, keyrings and the data the app later fetches match
 * a real import.
 */
import RNFS from '@rabby-wallet/react-native-fs';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { Platform } from 'react-native';

import { requestKeyring } from '@/core/apis/keyring';
import { verifyPasswordOrUnlock } from '@/core/apis/lock';
import { markAutomation } from '@/core/utils/automationMarker';
import { REGRESSION_DEFAULT_PASSWORD } from './regressionScenarios/credentials.nonprod';
import {
  expectedTestAccountsPath,
  isAllowedTestAccountsPath,
} from './testAccountsPath';

const PRIVATE_KEY_PATTERN = /^(0x)?[0-9a-fA-F]{64}$/;
const MNEMONIC_WORD_COUNTS = new Set([12, 15, 18, 21, 24]);

export type TestAccountsEntry =
  | { kind: 'privateKey'; value: string; note: string }
  | { kind: 'mnemonic'; value: string; note: string };

/**
 * The runner can only drop the seed file in the app-owned directory:
 * - iOS Simulator: `<app container>/Documents/kpi-test-accounts.txt`
 * - Android:       `/sdcard/Android/data/<pkg>/files/kpi-test-accounts.txt`
 *
 * Never trust the deeplink path itself: an arbitrary app/page can open the
 * scheme, and this command deletes the file after reading it.
 */
export function resolveTestAccountsPath(candidate?: string): string | null {
  const baseDir =
    Platform.OS === 'ios'
      ? RNFS.DocumentDirectoryPath
      : RNFS.ExternalDirectoryPath;
  if (!baseDir) {
    return null;
  }
  if (!candidate) {
    return expectedTestAccountsPath(baseDir);
  }
  if (!isAllowedTestAccountsPath(candidate, baseDir)) {
    return null;
  }
  return expectedTestAccountsPath(baseDir);
}

export function parseTestAccountsFile(raw: string): {
  entries: TestAccountsEntry[];
  rejected: number;
} {
  const entries: TestAccountsEntry[] = [];
  let rejected = 0;

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const tokens = trimmed.split(/\s+/);
    const head = tokens[0];

    if (PRIVATE_KEY_PATTERN.test(head)) {
      entries.push({
        kind: 'privateKey',
        value: head.replace(/^0x/i, ''),
        note: tokens.slice(1).join(' '),
      });
      continue;
    }

    if (MNEMONIC_WORD_COUNTS.has(tokens.length)) {
      entries.push({
        kind: 'mnemonic',
        value: tokens.join(' '),
        note: '',
      });
      continue;
    }

    rejected += 1;
  }

  return { entries, rejected };
}

export async function runTestAccountsImport(options: { path: string }) {
  const startedAt = Date.now();
  const marker = '[debug-import-test-accounts]';

  const path = resolveTestAccountsPath(options.path);
  if (!path) {
    console.error(`${marker} rejected_path`);
    return;
  }

  // Authenticate before touching the file: a link must not be able to read or
  // delete anything while the wallet is still locked.
  try {
    await verifyPasswordOrUnlock(REGRESSION_DEFAULT_PASSWORD);
  } catch (error) {
    console.error(
      `${marker} unlock_failed error=${(error as Error)?.message || error}`,
    );
    return;
  }

  let raw: string;
  try {
    raw = await RNFS.readFile(path, 'utf8');
  } catch (error) {
    console.error(
      `${marker} read_failed error=${(error as Error)?.message || error}`,
    );
    return;
  }

  // The file carries secrets; drop it as soon as it is in memory.
  try {
    await RNFS.unlink(path);
  } catch {
    // best effort
  }

  const { entries, rejected } = parseTestAccountsFile(raw);
  raw = '';

  const privateKeyEntries = entries.filter(
    entry => entry.kind === 'privateKey',
  );
  const mnemonicEntries = entries.filter(entry => entry.kind === 'mnemonic');

  let imported = 0;
  let failed = 0;

  const { importPrivateKey } = await import('@/core/apis/privateKey');
  const { generateKeyringWithMnemonic, activeAndPersistAccountsByMnemonics } =
    await import('@/core/apis/mnemonic');

  for (const entry of privateKeyEntries) {
    try {
      await importPrivateKey(entry.value);
      imported += 1;
    } catch (error) {
      const reason = (error as Error)?.message || String(error);
      // A duplicate is not a failure for seeding: the account is already there.
      if (/duplicate/i.test(reason)) {
        imported += 1;
      } else {
        failed += 1;
        console.warn(`${marker} private_key_failed note=${entry.note}`);
      }
    }
  }

  for (const entry of mnemonicEntries) {
    try {
      const { keyringId } = await generateKeyringWithMnemonic(
        entry.value,
        '',
        true,
      );
      const firstAddress = await requestKeyring(
        KEYRING_TYPE.HdKeyring,
        'getAddresses',
        keyringId ?? null,
        0,
        1,
      );
      const importedAccounts = await requestKeyring(
        KEYRING_TYPE.HdKeyring,
        'getAccounts',
        keyringId ?? null,
      );
      if (!importedAccounts || importedAccounts.length < 1) {
        await new Promise(resolve => setTimeout(resolve, 1));
        await activeAndPersistAccountsByMnemonics(
          entry.value,
          '',
          firstAddress as any,
          true,
        );
      }
      imported += 1;
    } catch (error) {
      failed += 1;
      console.warn(
        `${marker} mnemonic_failed error=${(error as Error)?.message || error}`,
      );
    }
  }

  try {
    const { default: accountStore } = await import('@/store/account');
    await accountStore.fetchAccounts({ force: true });
  } catch (error) {
    console.warn(
      `${marker} fetch_accounts_failed error=${
        (error as Error)?.message || error
      }`,
    );
  }

  // Single machine-readable line the runner waits for. `console.log` reaches
  // logcat on Android but is dropped by release-like iOS builds, so the same
  // summary is mirrored into the native log as well.
  const summary = `imported=${imported} privateKeys=${
    privateKeyEntries.length
  } mnemonics=${
    mnemonicEntries.length
  } rejected=${rejected} failed=${failed} elapsedMs=${Date.now() - startedAt}`;
  markAutomation('debug-import-test-accounts.done', summary);
  console.log(`${marker} done ${summary}`);
}
