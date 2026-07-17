import { addressUtils } from '@rabby-wallet/base-utils';
import { KEYRING_CLASS, KEYRING_TYPE } from '@rabby-wallet/keyring-utils';

import { DEFAULT_AUTO_LOCK_MINUTES } from '@/constant/autoLock';
import { RootNames } from '@/constant/layout';
import { accountEvents } from '@/core/apis/account';
import { apiMnemonic, apisAutoLock, apisLock } from '@/core/apis';
import { addKeyringAndactiveAndPersistAccounts } from '@/core/apis/mnemonic';
import { keyringServiceApi } from '@/core/serviceApi/keyring';
import {
  getPreferenceSnapshot,
  setPreferenceSync,
} from '@/core/serviceApi/preference';
import { setAccountNeedsBackupReminder } from '@/hooks/account';
import {
  completeWalletCreation,
  prepareWalletCreation,
} from '@/hooks/address/useSetupWallet';
import { resetNavigationTo } from '@/hooks/navigation';
import accountStore from '@/store/account';
import { navigationRef } from '@/utils/navigation';

import { REGRESSION_DEFAULT_PASSWORD } from '../credentials.nonprod';
import { consumeRegressionWalletFixture } from '../fixture.nonprod';
import type { RegressionScenarioExecutionContext } from '../scenarioTypes';
import {
  delay,
  ensureScenarioWalletUnlocked,
  getScenarioAccounts,
  resetToHome,
} from './utils';

const AUTO_LOCK_CHECK_GRACE_MS = 30_000;
const AUTO_LOCK_EARLY_TOLERANCE_MS = 7_000;
const MAX_REGRESSION_AUTO_LOCK_MINUTES = 24 * 60;
const MIN_BACKUP_WORD_COUNT = 12;
const ACCOUNT_VISIBILITY_TIMEOUT_MS = 8_000;

function isMnemonicAccount(
  account: Awaited<ReturnType<typeof getScenarioAccounts>>[number],
) {
  return (
    account.type === KEYRING_TYPE.HdKeyring ||
    account.brandName === KEYRING_CLASS.MNEMONIC
  );
}

async function importAdditionalPrivateKey(privateKey: string) {
  const prepared = await prepareWalletCreation({
    mode: 'importPrivateKey',
    secret: privateKey,
  });
  const visibleAccounts = await keyringServiceApi.getAllVisibleAccountsArray();
  if (
    visibleAccounts.some(account =>
      addressUtils.isSameAddress(account.address, prepared.address),
    )
  ) {
    return false;
  }

  const keyring = await keyringServiceApi.importPrivateKey(
    prepared.privateKey!,
  );
  const [address] = await keyring.getAccounts();
  if (!address) {
    throw new Error('Imported keyring did not expose an address');
  }
  accountEvents.emit('ACCOUNT_ADDED', {
    accounts: [
      {
        address,
        brandName: KEYRING_CLASS.PRIVATE_KEY,
        type: KEYRING_TYPE.SimpleKeyring,
      },
    ],
    scene: 'privateKey',
  });
  return true;
}

async function waitForCreatedAccountVisible(address: string) {
  const startedAt = Date.now();
  let runtimeVisible = false;
  let accounts: Awaited<ReturnType<typeof getScenarioAccounts>> = [];

  while (Date.now() - startedAt < ACCOUNT_VISIBILITY_TIMEOUT_MS) {
    const visibleAccounts =
      await keyringServiceApi.getAllVisibleAccountsArray();
    runtimeVisible = visibleAccounts.some(account =>
      addressUtils.isSameAddress(account.address, address),
    );

    try {
      accounts = await getScenarioAccounts({ force: true });
    } catch {
      accounts = [];
    }

    const accountStoreVisible = accounts.some(account =>
      addressUtils.isSameAddress(account.address, address),
    );

    if (runtimeVisible && accountStoreVisible) {
      return {
        accounts,
        runtimeVisible,
        accountStoreVisible,
        elapsedMs: Date.now() - startedAt,
      };
    }

    await delay(150);
  }

  return {
    accounts,
    runtimeVisible,
    accountStoreVisible: accounts.some(account =>
      addressUtils.isSameAddress(account.address, address),
    ),
    elapsedMs: Date.now() - startedAt,
  };
}

async function prepareWalletFixture(
  context: RegressionScenarioExecutionContext,
) {
  const fixtureId = context.command.fixture;
  if (!fixtureId) {
    throw new Error('wallet-onboarding requires an opaque fixture id');
  }

  const fixture = await consumeRegressionWalletFixture(fixtureId);
  context.report('fixture-loaded', {
    privateKeyCount: fixture.privateKeys.length,
    seedPhraseCount: fixture.seedPhrases.length,
  });
  context.report('fixture-removed');

  let visibleAccounts = await keyringServiceApi.getAllVisibleAccountsArray();
  let importedCount = 0;
  const secrets: Array<
    | { mode: 'importPrivateKey'; secret: string }
    | { mode: 'importSeedPhrase'; secret: string }
  > = [
    ...fixture.privateKeys.map(secret => ({
      mode: 'importPrivateKey' as const,
      secret,
    })),
    ...fixture.seedPhrases.map(secret => ({
      mode: 'importSeedPhrase' as const,
      secret,
    })),
  ];

  for (const secret of secrets) {
    if (!visibleAccounts.length) {
      const prepared = await prepareWalletCreation(secret);
      await completeWalletCreation(prepared, {
        password: REGRESSION_DEFAULT_PASSWORD,
        confirmPassword: REGRESSION_DEFAULT_PASSWORD,
        checked: true,
        enableBiometrics: false,
      });
      importedCount += 1;
    } else if (secret.mode === 'importPrivateKey') {
      if (await importAdditionalPrivateKey(secret.secret)) {
        importedCount += 1;
      }
    } else {
      const prepared = await prepareWalletCreation(secret);
      await completeWalletCreation(prepared, {
        password: REGRESSION_DEFAULT_PASSWORD,
        confirmPassword: REGRESSION_DEFAULT_PASSWORD,
        checked: true,
        enableBiometrics: false,
      });
      importedCount += 1;
    }
    visibleAccounts = await keyringServiceApi.getAllVisibleAccountsArray();
  }

  await accountStore.fetchAccounts({ force: true });
  context.report('assertion', {
    assertion: 'wallet-imported',
    passed: visibleAccounts.length > 0,
    visibleAccountCount: visibleAccounts.length,
    importedCount,
  });
}

async function runWalletCreate(context: RegressionScenarioExecutionContext) {
  await context.waitForNavigation();
  if (!apisLock.isUnlocked()) {
    try {
      await ensureScenarioWalletUnlocked();
    } catch {
      // Fresh installs have no wallet password yet; creation below sets it.
    }
  }

  const beforeAccounts = await keyringServiceApi.getAllVisibleAccountsArray();
  const prepared = await prepareWalletCreation({ mode: 'create' });
  if (beforeAccounts.length === 0) {
    await completeWalletCreation(prepared, {
      password: REGRESSION_DEFAULT_PASSWORD,
      confirmPassword: REGRESSION_DEFAULT_PASSWORD,
      checked: true,
      enableBiometrics: false,
    });
  } else {
    await addKeyringAndactiveAndPersistAccounts(
      prepared.seedPhrase!,
      '',
      (prepared.accountsToCreate || []).map(account => ({
        address: account.address,
        aliasName: '',
        index: account.index,
      })),
      false,
    );
    await keyringServiceApi.removePreMnemonics();
    await setAccountNeedsBackupReminder(
      {
        address: prepared.address,
        type: KEYRING_TYPE.HdKeyring,
        brandName: KEYRING_CLASS.MNEMONIC,
      },
      true,
    );
    accountEvents.emit('ACCOUNT_ADDED', {
      accounts: [
        {
          address: prepared.address,
          brandName: KEYRING_CLASS.MNEMONIC,
          type: KEYRING_TYPE.HdKeyring,
        },
      ],
      scene: 'memonics',
      needsBackupReminder: true,
    });
  }

  resetToHome();
  await context.waitForRoute(RootNames.Home);
  const visibility = await waitForCreatedAccountVisible(prepared.address);
  context.report('assertion', {
    assertion: 'mnemonic-wallet-created',
    passed: visibility.runtimeVisible && visibility.accountStoreVisible,
    beforeAccountCount: beforeAccounts.length,
    afterAccountCount: visibility.accounts.length,
    address: prepared.address
      ? `${prepared.address.slice(0, 6)}...${prepared.address.slice(-4)}`
      : null,
    runtimeVisible: visibility.runtimeVisible,
    accountStoreVisible: visibility.accountStoreVisible,
    elapsedMs: visibility.elapsedMs,
  });

  if (!visibility.runtimeVisible || !visibility.accountStoreVisible) {
    throw new Error('Created mnemonic wallet is not visible');
  }
}

async function runWalletBackup(context: RegressionScenarioExecutionContext) {
  await context.waitForNavigation();
  await ensureScenarioWalletUnlocked();

  let accounts = await getScenarioAccounts({ force: true });
  let account = accounts.find(isMnemonicAccount);
  let createdForBackup = false;

  if (!account && context.command.params.createIfMissing !== 'false') {
    await runWalletCreate(context);
    createdForBackup = true;
    accounts = await getScenarioAccounts({ force: true });
    account = accounts.find(isMnemonicAccount);
  }

  if (!account) {
    throw new Error('Mnemonic backup scenario requires an HdKeyring account');
  }

  const seedPhrase = await apiMnemonic.getMnemonics(
    REGRESSION_DEFAULT_PASSWORD,
    account.address,
  );
  const wordCount = seedPhrase.trim().split(/\s+/).filter(Boolean).length;
  const passed = wordCount >= MIN_BACKUP_WORD_COUNT;
  context.report('assertion', {
    assertion: 'mnemonic-backup-readable',
    passed,
    wordCount,
    createdForBackup,
    account: `${account.address.slice(0, 6)}...${account.address.slice(-4)}`,
  });

  if (!passed) {
    throw new Error('Mnemonic backup material is empty or malformed');
  }
}

async function runLockUnlock(context: RegressionScenarioExecutionContext) {
  await context.waitForNavigation();
  await ensureScenarioWalletUnlocked();

  if (context.command.action !== 'observe') {
    await apisLock.lockWallet();
    resetNavigationTo(navigationRef.current!, 'Unlock');
    await context.waitForRoute(RootNames.Unlock);
  }

  if (context.command.params.autoUnlock === 'true') {
    throw new Error(
      'Use autoSubmit=true so the Unlock screen owns password submission',
    );
  }

  if (context.command.params.autoSubmit === 'true') {
    await context.waitForRoute(RootNames.Home, 30_000);
  }

  const requestedAutoLockMinutes = Number(
    context.command.params.autoLockMinutes || 0,
  );
  if (requestedAutoLockMinutes) {
    if (
      !Number.isInteger(requestedAutoLockMinutes) ||
      requestedAutoLockMinutes < 1 ||
      requestedAutoLockMinutes > MAX_REGRESSION_AUTO_LOCK_MINUTES
    ) {
      throw new Error(
        `autoLockMinutes must be an integer between 1 and ${MAX_REGRESSION_AUTO_LOCK_MINUTES}`,
      );
    }
    if (navigationRef.getCurrentRoute()?.name !== RootNames.Home) {
      throw new Error(
        'Timed auto-lock requires autoSubmit=true and a visible Home route',
      );
    }

    await verifyTimedAutoLock(context, requestedAutoLockMinutes);
  }

  context.report('assertion', {
    assertion: 'lock-unlock-route',
    passed: [RootNames.Unlock, RootNames.Home].includes(
      navigationRef.getCurrentRoute()?.name as any,
    ),
    route: navigationRef.getCurrentRoute()?.name || null,
  });
}

async function verifyTimedAutoLock(
  context: RegressionScenarioExecutionContext,
  autoLockMinutes: number,
) {
  const originalAutoLockMinutes =
    getPreferenceSnapshot('autoLockTime') ?? DEFAULT_AUTO_LOCK_MINUTES;
  const durationMs = autoLockMinutes * 60 * 1000;
  const armedAt = Date.now();
  const expectedAt = armedAt + durationMs;
  let lockedAt: number | null = null;
  let unlockRouteAt: number | null = null;

  try {
    setPreferenceSync({ autoLockTime: autoLockMinutes });
    apisAutoLock.refreshAutolockTimeout();
    context.report('auto-lock-armed', {
      configuredMinutes: autoLockMinutes,
      armedAt,
      expectedAt,
    });

    const observationDeadline = expectedAt + AUTO_LOCK_CHECK_GRACE_MS;
    while (Date.now() <= observationDeadline) {
      const now = Date.now();
      if (!lockedAt && !apisLock.isUnlocked()) {
        lockedAt = now;
      }
      if (
        !unlockRouteAt &&
        navigationRef.getCurrentRoute()?.name === RootNames.Unlock
      ) {
        unlockRouteAt = now;
      }
      if (lockedAt && unlockRouteAt) {
        break;
      }
      await delay(250);
    }

    const observedAt = Math.max(lockedAt || 0, unlockRouteAt || 0) || null;
    context.report('auto-lock-observed', {
      configuredMinutes: autoLockMinutes,
      armedAt,
      expectedAt,
      lockedAt,
      unlockRouteAt,
      observedAt,
      observedElapsedMs: observedAt ? observedAt - armedAt : null,
    });

    const remainingMs = expectedAt - Date.now();
    if (remainingMs > 0) {
      await delay(remainingMs);
    }

    const verifiedAt = Date.now();
    const route = navigationRef.getCurrentRoute()?.name || null;
    const isLocked = !apisLock.isUnlocked();
    const isUnlockRoute = route === RootNames.Unlock;
    const wasNotMateriallyEarly =
      lockedAt !== null &&
      lockedAt - armedAt >= durationMs - AUTO_LOCK_EARLY_TOLERANCE_MS;
    const passed =
      isLocked &&
      isUnlockRoute &&
      wasNotMateriallyEarly &&
      verifiedAt >= expectedAt;

    context.report('auto-lock-verified', {
      configuredMinutes: autoLockMinutes,
      armedAt,
      expectedAt,
      verifiedAt,
      elapsedMs: verifiedAt - armedAt,
      lockedAt,
      unlockRouteAt,
      route,
      isLocked,
      wasNotMateriallyEarly,
      passed,
    });
    context.report('assertion', {
      assertion: 'timed-auto-lock',
      passed,
      configuredMinutes: autoLockMinutes,
      elapsedMs: verifiedAt - armedAt,
      observedElapsedMs: lockedAt ? lockedAt - armedAt : null,
      route,
      isLocked,
      wasNotMateriallyEarly,
    });

    if (!passed) {
      throw new Error(
        `Timed auto-lock failed after ${verifiedAt - armedAt}ms: ` +
          `locked=${isLocked}, route=${String(route)}, lockedAt=${String(
            lockedAt,
          )}`,
      );
    }
  } finally {
    setPreferenceSync({ autoLockTime: originalAutoLockMinutes });
    if (apisLock.isUnlocked()) {
      apisAutoLock.refreshAutolockTimeout();
    }
    context.report('assertion', {
      assertion: 'auto-lock-setting-restored',
      passed: getPreferenceSnapshot('autoLockTime') === originalAutoLockMinutes,
      restoredMinutes: originalAutoLockMinutes,
    });
  }
}

export async function executeRegressionScenario(
  context: RegressionScenarioExecutionContext,
) {
  if (context.command.scenario === 'wallet-onboarding') {
    if (
      context.command.action === 'prepare' ||
      context.command.action === 'start'
    ) {
      await prepareWalletFixture(context);
    }
    await context.waitForNavigation();
    resetToHome();
    await context.waitForRoute(RootNames.Home);
    const accounts = await getScenarioAccounts({ force: true });
    context.report('assertion', {
      assertion: 'home-has-visible-accounts',
      passed: accounts.length > 0,
      visibleAccountCount: accounts.length,
    });
    return;
  }

  if (context.command.scenario === 'wallet-create') {
    await runWalletCreate(context);
    return;
  }

  if (context.command.scenario === 'wallet-backup') {
    await runWalletBackup(context);
    return;
  }

  if (context.command.scenario === 'lock-unlock') {
    await runLockUnlock(context);
    return;
  }

  throw new Error(`Unsupported wallet scenario: ${context.command.scenario}`);
}
