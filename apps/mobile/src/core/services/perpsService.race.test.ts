// Regression test for the vault/preference desync.
//
// unlockAgentWallets reads the vault from a snapshot taken at the START of the
// decrypt await, but reads the preference AFTER the await. If a concurrent
// createAgentWallet rewrites agentPreferences during the decrypt, the old vault
// key would get paired with the new agent's address — handing the SDK a private
// key and address from two different agents ("approve one, sign the other →
// agent does not exist").
//
// The fix derives the agent address from the vault key itself, so the pair can
// never diverge regardless of what agentPreferences holds at read time.

jest.mock('@rabby-wallet/persist-store', () => ({
  __esModule: true,
  default: (config: { template: Record<string, unknown> }) => ({
    ...config.template,
  }),
}));

import { secp256k1 } from 'ethereum-cryptography/secp256k1.js';
import { bytesToHex, publicToAddress, hexToBytes } from '@ethereumjs/util';
import { PerpsService } from './perpsService';

const ADDR = '0xmaster';
// A valid 32-byte private key (the agent's vault).
const A_KEY = `0x${'11'.repeat(32)}`;
const deriveAddr = (vault: string) =>
  bytesToHex(
    publicToAddress(secp256k1.getPublicKey(hexToBytes(vault), false), true),
  ).toLowerCase();
const A_ADDR = deriveAddr(A_KEY); // the address that truly corresponds to A_KEY
const B_ADDR = '0xagentbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'; // a different agent

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>(r => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('perpsService unlockAgentWallets vault/preference pairing', () => {
  it('derives the agent address from the vault key, ignoring a preference desynced during the decrypt await', async () => {
    const decrypt = deferred<{ [k: string]: string }>();
    const keyringCrypto = {
      decryptWithPassword: jest.fn(() => decrypt.promise),
      encryptWithPassword: jest.fn(async (v: unknown) => JSON.stringify(v)),
      isUnlocked: () => true,
    };

    const svc = new PerpsService({
      storageAdapter: {},
      keyringCrypto,
    } as any);

    const store = (svc as any).store;
    // Initially consistent: agent A's vault + A's address.
    store.agentVaults = 'ENCRYPTED_NONEMPTY';
    store.agentPreferences = {
      [ADDR]: { agentAddress: A_ADDR, approveSignatures: [] },
    };

    // unlockAgentWallets begins and AWAITS decryptWithPassword.
    svc.unlockAgentWallets();
    const unlockPromise = (svc as any).memoryState
      .unlockPromise as Promise<void>;

    // --- inside the decrypt await window ---
    // A concurrent createAgentWallet rewrites the preference to a NEW agent B.
    store.agentPreferences = {
      [ADDR]: { agentAddress: B_ADDR, approveSignatures: [] },
    };

    // decrypt resolves with the OLD snapshot (agent A's key).
    decrypt.resolve({ [ADDR]: A_KEY });
    await unlockPromise;

    const mem = (svc as any).memoryState.agentWallets[ADDR];
    // FIX: the address is derived from the vault key, so it matches A (not the
    // race-written B). vault and address stay on the same agent.
    expect(mem.vault).toBe(A_KEY);
    expect(mem.preference.agentAddress).toBe(A_ADDR);
    expect(mem.preference.agentAddress).not.toBe(B_ADDR);

    // getAgentWallet (what getOrCreatePerpsAgentWallet reads) hands the SDK a
    // matched private key + address.
    const res = await svc.getAgentWallet(ADDR);
    expect(res.vault).toBe(A_KEY);
    expect(deriveAddr(res.vault)).toBe(res.preference.agentAddress);
  });
});
