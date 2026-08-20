import { DEFAULT_HOME_ASSET_TOP_N } from '@/constant/homeAssetSelection';
import { isNonPublicProductionEnv } from '@/constant';
import { addWatchAddress } from '@/core/apis/address';
import {
  getHomeAssetSelectionSettings,
  setHomeAssetTopN,
  setIncludeWatchAddressesInHomeAssetSelection,
} from '@/hooks/appSettings';
import accountStore from '@/store/account';
import type { KeyringAccountWithAlias } from '@/types/account';
import { normalizeRegressionWatchAddresses } from './regressionScenarios/watchAddressFixturePayload.nonprod';

type ImportProgress = {
  completedCount: number;
  totalCount: number;
};

export type HighCardinalityWatchAddressImportResult = {
  accounts: KeyringAccountWithAlias[];
  fixtureAddressCount: number;
  existingCount: number;
  importedCount: number;
  failedCount: number;
  missingCount: number;
};

export async function importHighCardinalityWatchAddresses(
  addresses: string[],
  options: {
    onProgress?: (progress: ImportProgress) => void;
  } = {},
): Promise<HighCardinalityWatchAddressImportResult> {
  if (!isNonPublicProductionEnv) {
    throw new Error('High-cardinality address import is non-production only');
  }

  const normalizedAddresses = normalizeRegressionWatchAddresses(addresses);
  const previousSettings = getHomeAssetSelectionSettings();

  // Keep fixture setup out of Home's measured selection lifecycle. Restoring
  // the prior policy once at the end starts at most one new asset selection.
  setHomeAssetTopN(DEFAULT_HOME_ASSET_TOP_N);
  setIncludeWatchAddressesInHomeAssetSelection(false);

  try {
    const beforeAccounts = await accountStore.fetchAccounts({ force: true });
    const existingAddresses = new Set(
      beforeAccounts.map(account => account.address.toLowerCase()),
    );
    const existingCount = normalizedAddresses.filter(address =>
      existingAddresses.has(address),
    ).length;
    let importedCount = 0;
    let failedCount = 0;
    let completedCount = 0;

    for (const address of normalizedAddresses) {
      if (!existingAddresses.has(address)) {
        try {
          await addWatchAddress(address);
          existingAddresses.add(address);
          importedCount += 1;
        } catch {
          failedCount += 1;
        }
      }
      completedCount += 1;
      options.onProgress?.({
        completedCount,
        totalCount: normalizedAddresses.length,
      });
    }

    const accounts = await accountStore.fetchAccounts({ force: true });
    const visibleAddresses = new Set(
      accounts.map(account => account.address.toLowerCase()),
    );
    const fixtureAddressCount = normalizedAddresses.filter(address =>
      visibleAddresses.has(address),
    ).length;

    return {
      accounts,
      fixtureAddressCount,
      existingCount,
      importedCount,
      failedCount,
      missingCount: normalizedAddresses.length - fixtureAddressCount,
    };
  } finally {
    setHomeAssetTopN(previousSettings.topN);
    setIncludeWatchAddressesInHomeAssetSelection(
      previousSettings.includeWatchAddresses,
    );
  }
}
