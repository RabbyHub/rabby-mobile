import type { StorageAdapaterOptions } from '@rabby-wallet/persist-store';
import createPersistStore from '@rabby-wallet/persist-store';
import { APP_STORE_NAMES } from '../storage/storeConstant';

import { bytesToHex, publicToAddress } from '@ethereumjs/util';
import { SendApproveParams } from '@rabby-wallet/hyperliquid-sdk';
import { getRandomBytesSync } from 'ethereum-cryptography/random.js';
import { secp256k1 } from 'ethereum-cryptography/secp256k1.js';
import { keyringService } from '@/core/services';
import { Account } from './preference';

export interface AgentWalletInfo {
  vault: string;
  preference: {
    agentAddress: string;
    approveSignatures: ApproveSignatures;
  };
}

interface StoreAccount {
  address: string;
  type: string;
  brandName: string;
  aliasName?: string;
}

export type ApproveSignatures = (SendApproveParams & {
  type: 'approveAgent' | 'approveBuilderFee';
})[];

export interface PerpsServiceStore {
  agentVaults: string; // encrypted JSON string of {[address: string]: string}
  agentPreferences: {
    [address: string]: {
      agentAddress: string;
      approveSignatures: ApproveSignatures;
    };
  };
  currentAccount: StoreAccount | null;
  lastUsedAccount: StoreAccount | null;
  hasDoneNewUserProcess: boolean;
  inviteConfig: {
    [address: string]: {
      lastInvitedAt?: number;
      lastConnectedAt?: number;
    };
  };
  favoriteMarkets: string[];
}
export interface PerpsServiceMemoryState {
  agentWallets: {
    // key is master wallet address
    [address: string]: AgentWalletInfo;
  };
  unlockPromise: Promise<void> | null;
}

export class PerpsService {
  private store?: PerpsServiceStore;
  private memoryState: PerpsServiceMemoryState = {
    agentWallets: {},
    unlockPromise: null,
  };

  constructor(options: StorageAdapaterOptions) {
    this.store = createPersistStore<PerpsServiceStore>(
      {
        name: APP_STORE_NAMES.perps,
        template: {
          agentVaults: '',
          agentPreferences: {},
          currentAccount: null,
          inviteConfig: {},
          // no clear account , just cache for last used
          lastUsedAccount: null,
          hasDoneNewUserProcess: false,
          favoriteMarkets: [],
        },
      },
      {
        storage: options?.storageAdapter,
      },
    );
    this.memoryState.agentWallets = {};
  }

  getFavoriteMarkets = async () => {
    if (!this.store) {
      throw new Error('PerpsService not initialized');
    }
    return this.store.favoriteMarkets || [];
  };

  addFavoriteMarket = async (market: string) => {
    if (!this.store) {
      throw new Error('PerpsService not initialized');
    }
    const normalizedMarket = market.toUpperCase();
    if (this.store.favoriteMarkets.includes(normalizedMarket)) {
      return;
    }
    this.store.favoriteMarkets = [
      ...this.store.favoriteMarkets,
      normalizedMarket,
    ];
  };

  removeFavoriteMarket = async (market: string) => {
    if (!this.store) {
      throw new Error('PerpsService not initialized');
    }
    const normalizedMarket = market.toUpperCase();
    this.store.favoriteMarkets = this.store.favoriteMarkets.filter(
      m => m !== normalizedMarket,
    );
  };

  setHasDoneNewUserProcess = async (hasDone: boolean) => {
    if (!this.store) {
      throw new Error('PerpsService not initialized');
    }
    this.store.hasDoneNewUserProcess = hasDone;
  };

  getHasDoneNewUserProcess = async () => {
    if (!this.store) {
      throw new Error('PerpsService not initialized');
    }
    return this.store.hasDoneNewUserProcess;
  };

  setSendApproveAfterDeposit = async (
    masterAddress: string,
    approveSignatures: ApproveSignatures,
  ) => {
    if (!this.store) {
      throw new Error('PerpsService not initialized');
    }

    if (!masterAddress) {
      console.error('masterAddress is required');
      return;
    }

    const normalizedAddress = masterAddress.toLowerCase();

    // Update store preferences
    const existingPreference = this.store.agentPreferences[
      normalizedAddress
    ] || {
      agentAddress: '',
      approveSignatures: [],
    };

    this.store.agentPreferences[normalizedAddress] = {
      ...existingPreference,
      approveSignatures,
    };

    // Update memory state if wallet exists
    if (this.memoryState.agentWallets[normalizedAddress]) {
      this.memoryState.agentWallets[
        normalizedAddress
      ].preference.approveSignatures = approveSignatures;
    }
  };

  getSendApproveAfterDeposit = async (masterAddress: string) => {
    const normalizedAddress = masterAddress.toLowerCase();
    const agentWallet = this.memoryState.agentWallets[normalizedAddress];

    if (!agentWallet) {
      console.error('agentWallet not found');
      return null;
    }

    return agentWallet.preference.approveSignatures;
  };

  unlockAgentWallets = async () => {
    const unlock = async () => {
      if (!this.store) {
        throw new Error('PerpsService not initialized');
      }
      // Decrypt and load agent vaults
      if (this.store.agentVaults) {
        const vaultsMap: {
          [address: string]: string;
        } = await keyringService.decryptWithPassword(this.store.agentVaults);

        // Format data for memory state
        for (const masterAddress in vaultsMap) {
          const privateKey = vaultsMap[masterAddress];
          const preference = this.store.agentPreferences[masterAddress] || {
            agentAddress: '',
          };
          this.memoryState.agentWallets[masterAddress] = {
            vault: privateKey,
            preference: {
              ...preference,
              approveSignatures: preference.approveSignatures || [],
            },
          };
        }
      }
    };
    this.memoryState.unlockPromise = unlock();
    /**
     *  unlock 是一个耗时比较长的任务，所以如果在解锁时立即尝试获取 agentWallet 可能会碰到解锁没有完成的情况
     *  所以这里把 promise 放到内存里，如果有立即读取的需求需要先读一下 promise 的状态
     * */
    this.memoryState.unlockPromise.finally(() => {
      this.memoryState.unlockPromise = null;
    });
  };

  createAgentWallet = async (masterAddress: string) => {
    if (!this.store) {
      throw new Error('PerpsService not initialized');
    }
    const privateKey = getRandomBytesSync(32);
    const publicKey = secp256k1.getPublicKey(privateKey, false);
    const agentAddress = bytesToHex(
      publicToAddress(publicKey, true),
    ).toLowerCase();
    this.addAgentWallet(masterAddress, bytesToHex(privateKey), {
      agentAddress,
      approveSignatures: [],
    });
    return { agentAddress, vault: bytesToHex(privateKey) };
  };

  addAgentWallet = async (
    masterAddress: string,
    vault: string,
    preference: AgentWalletInfo['preference'],
  ) => {
    if (!this.store) {
      throw new Error('PerpsService not initialized');
    }

    const normalizedAddress = masterAddress.toLowerCase();

    this.memoryState.agentWallets = {
      ...this.memoryState.agentWallets,
      [normalizedAddress]: {
        vault,
        preference,
      },
    };

    let vaultsMap: { [address: string]: string } = {};
    if (this.store.agentVaults) {
      vaultsMap = await keyringService.decryptWithPassword(
        this.store.agentVaults,
      );
    }

    vaultsMap[normalizedAddress] = vault;

    const encryptedVaults = await keyringService.encryptWithPassword(vaultsMap);

    // Update store
    this.store.agentVaults = encryptedVaults;
    this.store.agentPreferences = {
      ...this.store.agentPreferences,
      [normalizedAddress]: {
        agentAddress: preference.agentAddress,
        approveSignatures: preference.approveSignatures,
      },
    };
  };

  getAgentWallet = async (address: string) => {
    if (!this.store) {
      throw new Error('PerpsService not initialized');
    }
    if (this.memoryState.unlockPromise) {
      await this.memoryState.unlockPromise;
    }

    const normalizedAddress = address.toLowerCase();

    return this.memoryState.agentWallets[normalizedAddress];
  };

  updateAgentWalletPreference = async (
    address: string,
    preference: AgentWalletInfo['preference'],
  ) => {
    if (!this.store) {
      throw new Error('PerpsService not initialized');
    }

    const normalizedAddress = address.toLowerCase();
    const existingPreference = this.store.agentPreferences[normalizedAddress];

    if (!existingPreference) {
      throw new Error(`Agent wallet not found for address: ${address}`);
    }

    this.store.agentPreferences = {
      ...this.store.agentPreferences,
      [normalizedAddress]: {
        agentAddress: preference.agentAddress,
        approveSignatures: preference.approveSignatures,
      },
    };

    if (this.memoryState.agentWallets[normalizedAddress]) {
      this.memoryState.agentWallets[normalizedAddress].preference = preference;
    }
  };

  setCurrentAccount = async (account: Account | null) => {
    if (!this.store) {
      throw new Error('PerpsService not initialized');
    }
    if (account) {
      this.store.lastUsedAccount = {
        address: account?.address,
        type: account?.type,
        aliasName: account?.aliasName,
        brandName: account?.brandName,
      };
      this.store.currentAccount = {
        address: account.address,
        type: account.type,
        aliasName: account.aliasName,
        brandName: account.brandName,
      };
    } else {
      this.store.currentAccount = null;
    }
  };

  getLastUsedAccount = async () => {
    if (!this.store) {
      throw new Error('PerpsService not initialized');
    }
    return this.store.lastUsedAccount;
  };

  getCurrentAccount = async () => {
    if (!this.store) {
      throw new Error('PerpsService not initialized');
    }
    return this.store.currentAccount;
  };

  removeAgentWallet = async (address: string) => {
    if (!this.store) {
      throw new Error('PerpsService not initialized');
    }

    const normalizedAddress = address.toLowerCase();

    let vaultsMap: { [address: string]: string } = {};
    if (this.store.agentVaults) {
      vaultsMap = await keyringService.decryptWithPassword(
        this.store.agentVaults,
      );
    }

    delete vaultsMap[normalizedAddress];

    const encryptedVaults = await keyringService.encryptWithPassword(vaultsMap);

    this.store.agentVaults = encryptedVaults;
    const updatedPreferences = { ...this.store.agentPreferences };
    delete updatedPreferences[normalizedAddress];
    this.store.agentPreferences = updatedPreferences;

    const updatedMemoryWallets = { ...this.memoryState.agentWallets };
    delete updatedMemoryWallets[normalizedAddress];
    this.memoryState.agentWallets = updatedMemoryWallets;
  };

  hasAgentWallet = (address: string) => {
    if (!this.store) {
      return false;
    }

    const normalizedAddress = address.toLowerCase();
    return !!this.memoryState.agentWallets[normalizedAddress];
  };

  getAgentWalletPreference = (address: string) => {
    if (!this.store) {
      throw new Error('PerpsService not initialized');
    }

    const normalizedAddress = address.toLowerCase();
    const preference = this.store.agentPreferences[normalizedAddress];

    if (!preference) {
      return null;
    }

    return preference;
  };

  getInviteConfig = (address: string) => {
    if (!this.store) {
      throw new Error('PerpsService not initialized');
    }
    return this.store.inviteConfig[address.toLowerCase()];
  };

  setInviteConfig = (
    address: string,
    config: { lastConnectedAt?: number; lastInvitedAt?: number },
  ) => {
    if (!this.store) {
      throw new Error('PerpsService not initialized');
    }
    this.store.inviteConfig[address.toLowerCase()] = {
      ...this.store.inviteConfig[address.toLowerCase()],
      ...config,
    };
  };

  // only test use
  resetStore = async () => {
    if (!this.store) {
      throw new Error('PerpsService not initialized');
    }
    this.store.agentVaults = '';
    this.store.agentPreferences = {};
    this.store.currentAccount = null;
    this.store.lastUsedAccount = null;
    this.store.hasDoneNewUserProcess = false;
    this.memoryState.agentWallets = {};
  };
}
