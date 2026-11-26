import { CHAINS_ENUM } from '@debank/common';
import {
  CONFIG_INTEGRITY_KEYCHAIN_SERVICE,
  createConfigIntegrityKeychain,
} from '@/core/apis/keychain';
import { getCurrentKeychainVersion } from '@/core/apis/keychainVersion';
import { rawKeychain } from '@/core/apis/keychainV9_0_0';
import {
  armConfigIntegrityProbe,
  failNextConfigIntegrityMetadataWrite,
  getConfigIntegrityProbeDiagnostics,
} from '@/core/configIntegrity/probe.nonprod';
import {
  CONFIG_INTEGRITY_KEY,
  isHexDigest,
  parseKeyRecord,
  registry,
} from '@/core/configIntegrity/schema';
import { configIntegrity } from '@/core/configIntegrity/storage';
import { contactServiceApi } from '@/core/serviceApi/contact';
import { customRPCServiceApi } from '@/core/serviceApi/customRPC';
import { securityEngineServiceApi } from '@/core/serviceApi/securityEngine';
import { whitelistServiceApi } from '@/core/serviceApi/whitelist';
import { appStorage } from '@/core/storage/mmkv';
import { APP_STORE_NAMES } from '@/core/storage/storeConstant';
import {
  claimRegressionScenarioAction,
  getRegressionScenarioRuntimeControlSnapshot,
} from '../runtimeStore';
import type { RegressionScenarioExecutionContext } from '../scenarioTypes';

const ADDRESSES = Array.from(
  { length: 6 },
  (_, index) => `0x${(index + 1).toString(16).padStart(40, '0')}`,
);
const FIXTURE_ADDRESS = ADDRESSES[0];
const FIXTURE_RPC = 'https://rpc.example.invalid';
const FIXTURE_ORIGIN = 'https://integrity.example.invalid';
const ALIAS = 'Integrity fixture';
const EDITED_ALIAS = 'Integrity fixture edited';

type Metadata = { stores?: Record<string, Record<string, unknown>> };

async function editFixture() {
  await contactServiceApi.addContact({ address: FIXTURE_ADDRESS, name: ALIAS });
  await contactServiceApi.updateAlias({
    address: FIXTURE_ADDRESS,
    name: ALIAS,
  });
  await customRPCServiceApi.setRPC(CHAINS_ENUM.ETH, FIXTURE_RPC);
  await whitelistServiceApi.enableWhitelist();
  await whitelistServiceApi.setWhitelist(ADDRESSES);
  await whitelistServiceApi.updateWhitelistOrder([...ADDRESSES].reverse());
  await securityEngineServiceApi.addOriginBlacklist(FIXTURE_ORIGIN);
  await securityEngineServiceApi.addAddressWhitelist(FIXTURE_ADDRESS);
  const [rule] = await securityEngineServiceApi.getRules();
  if (rule) {
    if (rule.enable) {
      await securityEngineServiceApi.disableRule(rule.id);
    } else {
      await securityEngineServiceApi.enableRule(rule.id);
    }
  }
}

function readStore<T>(key: string): T | null {
  return appStorage.getItem(key) ?? null;
}

function readConfig() {
  const contact = readStore<{
    contacts?: Record<string, unknown>;
    aliases?: Record<string, { alias?: string }>;
  }>(APP_STORE_NAMES.contactBook);
  const rpc = readStore<{
    customRPC?: Record<string, { url?: string }>;
  }>(APP_STORE_NAMES.rpc);
  const whitelist = readStore<{
    enabled?: boolean;
    whitelists?: unknown[];
  }>(APP_STORE_NAMES.whitelist);
  const security = readStore<{
    userData?: { originBlacklist?: string[] };
    rules?: unknown[];
  }>(APP_STORE_NAMES.securityEngine);
  const alias = contact?.aliases?.[FIXTURE_ADDRESS]?.alias;
  return {
    fixtureAlias: alias === ALIAS || alias === EDITED_ALIAS,
    fixtureEdited: alias === EDITED_ALIAS,
    fixtureContact: !!contact?.contacts?.[FIXTURE_ADDRESS],
    fixtureRpc: rpc?.customRPC?.[CHAINS_ENUM.ETH]?.url === FIXTURE_RPC,
    whitelistEnabled: whitelist?.enabled === true,
    whitelistCount: whitelist?.whitelists?.length ?? 0,
    legacyWhitelistCount:
      whitelist?.whitelists?.filter(item => typeof item === 'string').length ??
      0,
    fixtureSecurity:
      security?.userData?.originBlacklist?.includes(FIXTURE_ORIGIN) === true,
    ruleCount: security?.rules?.length ?? 0,
  };
}

async function inspect(context: RegressionScenarioExecutionContext) {
  const scan = configIntegrity.getScan();
  await scan;
  const metadata = readStore<Metadata>(CONFIG_INTEGRITY_KEY);
  const digests = Object.fromEntries(
    Object.entries(registry.stores).map(([store, fields]) => [
      store,
      Object.keys(fields).filter(field =>
        isHexDigest(metadata?.stores?.[store]?.[field]),
      ).length,
    ]),
  );
  let baselineRegistryVersion: number | null = null;
  try {
    const key = await createConfigIntegrityKeychain().read();
    if (key !== null) {
      baselineRegistryVersion = parseKeyRecord(key).baselineRegistryVersion;
    }
  } catch {
    // The probe reports only whether a valid native record could be read.
  }
  context.report('postcondition-ready', {
    scanStarted: !!scan,
    baselineRegistryVersion,
    digests,
    diagnostics: getConfigIntegrityProbeDiagnostics(),
    ...readConfig(),
  });
}

export async function executeRegressionScenario(
  context: RegressionScenarioExecutionContext,
) {
  const { command } = context;
  const { operation } = command.params;
  if (
    !getRegressionScenarioRuntimeControlSnapshot().enabled ||
    command.expiresAt <= Date.now() ||
    !claimRegressionScenarioAction(command.runId, 'config-integrity')
  ) {
    return;
  }

  if (operation === 'inspect') {
    await inspect(context);
    return;
  }
  if (operation === 'arm') {
    armConfigIntegrityProbe(command.params.fault ?? 'none', command.expiresAt);
    return;
  }
  if (operation === 'seed') {
    await editFixture();
  } else {
    // Only operate on records on which the caller has installed the fixture.
    if (!readConfig().fixtureAlias) {
      throw new Error('Configuration integrity fixture is required');
    }
    switch (operation) {
      case 'fail-signature':
      case 'edit-alias':
        if (operation === 'fail-signature') {
          failNextConfigIntegrityMetadataWrite();
        }
        await contactServiceApi.updateAlias({
          address: FIXTURE_ADDRESS,
          name: EDITED_ALIAS,
        });
        break;
      case 'drop-metadata':
        appStorage.removeItem(CONFIG_INTEGRITY_KEY);
        break;
      case 'drop-store': {
        const metadata = readStore<Metadata>(CONFIG_INTEGRITY_KEY);
        if (!metadata?.stores) {
          throw new Error('Configuration integrity metadata is required');
        }
        delete metadata.stores[APP_STORE_NAMES.contactBook];
        appStorage.setItem(CONFIG_INTEGRITY_KEY, metadata);
        break;
      }
      case 'drop-key':
        if (getCurrentKeychainVersion() !== '9.0.0') {
          throw new Error('Configuration integrity probe requires Keychain v9');
        }
        if (
          !(await rawKeychain.resetGenericPassword({
            service: CONFIG_INTEGRITY_KEYCHAIN_SERVICE,
          }))
        ) {
          throw new Error(
            'Unable to remove the configuration integrity fixture key',
          );
        }
        break;
      case 'clear-config-mmkv':
        for (const store of Object.keys(registry.stores)) {
          appStorage.removeItem(store);
        }
        appStorage.removeItem(CONFIG_INTEGRITY_KEY);
        break;
      default:
        throw new Error('Unknown configuration integrity probe operation');
    }
  }

  await inspect(context);
}
