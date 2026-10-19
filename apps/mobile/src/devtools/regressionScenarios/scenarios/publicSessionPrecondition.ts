import {
  isKeyringRuntimeReady,
  isUnlocked,
  isUnlockSessionValid,
} from '@/core/apis/lock';
import {
  getPublicAccountSnapshotAccounts,
  hasKeyringPublicAccountSnapshot,
} from '@/core/serviceApi/keyring';

type PublicSessionScenario = 'home-assets' | 'token-detail';

// These two scenarios only browse public assets. A valid post-unlock session
// permits the same browsing as Home without decrypting the private keyrings.
// Do not use this precondition for account mutation, signing or authentication.
export function assertPublicSessionScenarioReady(
  scenario: PublicSessionScenario,
) {
  if (scenario !== 'home-assets' && scenario !== 'token-detail') {
    throw new Error('Scenario does not support public-session navigation');
  }

  const walletUnlocked = isUnlocked();
  const unlockSessionValid = isUnlockSessionValid();
  if (!walletUnlocked && !unlockSessionValid) {
    throw new Error(
      'Public navigation requires an authenticated wallet session',
    );
  }
  const publicAccountCount = hasKeyringPublicAccountSnapshot()
    ? getPublicAccountSnapshotAccounts().length
    : 0;
  if (!publicAccountCount) {
    throw new Error(
      'Public navigation requires a ready public account snapshot',
    );
  }

  return {
    walletUnlocked,
    unlockSessionValid,
    keyringRuntimeReady: isKeyringRuntimeReady(),
    publicAccountCount,
  };
}
