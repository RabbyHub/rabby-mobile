import { KeystoneKeyring } from '@rabby-wallet/eth-keyring-keystone';
import { MetaMaskKeyring } from '@keystonehq/metamask-airgapped-keyring';

/**
 * Create a fresh Keystone keyring instance by bypassing MetaMaskKeyring's
 * singleton cache. This allows multiple Keystone devices to coexist.
 */
export function createFreshKeystoneKeyring(): KeystoneKeyring {
  const prevInstance = (MetaMaskKeyring as any).instance;
  (MetaMaskKeyring as any).instance = undefined;
  try {
    return new KeystoneKeyring();
  } finally {
    (MetaMaskKeyring as any).instance = prevInstance;
  }
}
