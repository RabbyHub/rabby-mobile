// TODO: move to packages
import {
  defaultRules,
  UserData,
  RuleConfig,
  Threshold,
  ContextActionData,
  ContractAddress,
} from '@rabby-wallet/rabby-security-engine/dist/rules';
import Engine from '@rabby-wallet/rabby-security-engine';
import cloneDeep from 'lodash/cloneDeep';
import {
  StorageAdapaterOptions,
  StoreServiceBase,
} from '@rabby-wallet/persist-store';
import { openapi } from '../request';
import { isSameAddress } from '@rabby-wallet/base-utils/src/isomorphic/address';
import { APP_STORE_NAMES } from '@/core/storage/storeConstant';

export interface SecurityEngineStore {
  userData: UserData;
  rules: UserRuleConfig[];
}

interface UserRuleConfig {
  id: string;
  enable: boolean;
  customThreshold: Threshold;
}

function mergeRules(rules: RuleConfig[], userConfig: UserRuleConfig[]) {
  // Merge default rules with user local config
  return rules.map(rule => {
    const target = userConfig.find(item => item.id === rule.id);
    if (target) {
      return {
        ...rule,
        enable: target.enable,
        customThreshold: target.customThreshold,
      };
    }
    return rule;
  });
}

function getRuleConfigFromRules(rules: RuleConfig[]): UserRuleConfig[] {
  return rules.map(rule => ({
    id: rule.id,
    enable: rule.enable,
    customThreshold: rule.customThreshold,
  }));
}

export class SecurityEngineService extends StoreServiceBase<
  SecurityEngineStore,
  APP_STORE_NAMES.securityEngine
> {
  rules: RuleConfig[] = [];

  engine: Engine | null = null;
  private initPromise: Promise<void> | null = null;
  private storageOptions?: StorageAdapaterOptions;

  constructor(options?: StorageAdapaterOptions) {
    super();
    this.storageOptions = options;
  }

  init = (options: StorageAdapaterOptions = this.storageOptions || {}) => {
    if (this.engine) {
      return Promise.resolve();
    }
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initializePersistStore(
      APP_STORE_NAMES.securityEngine,
      {
        userData: {
          originBlacklist: [],
          originWhitelist: [],
          contractBlacklist: [],
          contractWhitelist: [],
          addressBlacklist: [],
          addressWhitelist: [],
        },
        rules: getRuleConfigFromRules(defaultRules),
      },
      {
        storageAdapter: options.storageAdapter,
      },
    );

    this.initPromise = Promise.resolve()
      .then(() => {
        this.rules = mergeRules(
          defaultRules,
          this.getStoreFieldSnapshot('rules'),
        );
        this.mutateStore(draft => {
          draft.rules = this.rules;
          draft.userData.contractBlacklist ||= [];
          draft.userData.contractWhitelist ||= [];
          draft.userData.addressBlacklist ||= [];
          draft.userData.addressWhitelist ||= [];
        });
        this.engine = new Engine(this.rules, openapi);
      })
      .catch(error => {
        this.initPromise = null;
        throw error;
      });

    return this.initPromise;
  };

  execute = async (actionData: ContextActionData) => {
    if (!this.engine) throw new Error('Security Engine not init');
    const results = await this.engine.run({
      ...actionData,
      userData: this.getStoreFieldSnapshot('userData'),
    });
    return results;
  };

  getRules = () => {
    return cloneDeep(this.rules);
  };

  getUserData = () => {
    return this.getStoreFieldSnapshot('userData');
  };

  updateUserData = (data: UserData) => {
    this.mutateStore(draft => {
      draft.userData = data;
    });
  };

  getOriginWhitelist = () => {
    return cloneDeep(this.store.userData.originWhitelist);
  };

  addOriginWhitelist = (origin: string) => {
    if (this.store.userData.originWhitelist.includes(origin)) return;

    this.mutateStore(draft => {
      draft.userData.originWhitelist.push(origin.toLowerCase());
    });
  };

  removeOriginWhitelist = (origin: string) => {
    if (!this.store.userData.originWhitelist.includes(origin.toLowerCase())) {
      return;
    }

    this.mutateStore(draft => {
      draft.userData.originWhitelist = draft.userData.originWhitelist.filter(
        item => {
          return item.toLowerCase() !== origin.toLowerCase();
        },
      );
    });
  };

  getOriginBlacklist = () => {
    return cloneDeep(this.store.userData.originBlacklist);
  };

  addContractBlacklist = (contract: ContractAddress) => {
    if (
      this.store.userData.contractBlacklist.find(
        item =>
          isSameAddress(contract.address, item.address) &&
          contract.chainId === item.chainId,
      )
    ) {
      return;
    }
    this.mutateStore(draft => {
      draft.userData.contractBlacklist.push({
        ...contract,
        address: contract.address.toLowerCase(),
      });
    });
  };

  addContractWhitelist = (contract: ContractAddress) => {
    if (
      this.store.userData.contractWhitelist.find(
        item =>
          isSameAddress(contract.address, item.address) &&
          contract.chainId === item.chainId,
      )
    ) {
      return;
    }
    this.mutateStore(draft => {
      draft.userData.contractWhitelist.push({
        ...contract,
        address: contract.address.toLowerCase(),
      });
    });
  };

  removeContractWhitelist = (contract: ContractAddress) => {
    if (
      !this.store.userData.contractWhitelist.find(
        item =>
          isSameAddress(contract.address, item.address) &&
          contract.chainId === item.chainId,
      )
    ) {
      return;
    }

    this.mutateStore(draft => {
      draft.userData.contractWhitelist =
        draft.userData.contractWhitelist.filter(item => {
          return !(
            isSameAddress(item.address, contract.address) &&
            item.chainId === contract.chainId
          );
        });
    });
  };

  removeContractBlacklistFromAllChains = (contract: ContractAddress) => {
    if (
      !this.store.userData.contractBlacklist.find(item =>
        isSameAddress(contract.address, item.address),
      )
    ) {
      return;
    }
    this.mutateStore(draft => {
      draft.userData.contractBlacklist =
        draft.userData.contractBlacklist.filter(item => {
          return !isSameAddress(item.address, contract.address);
        });
    });
  };

  removeContractBlacklist = (contract: ContractAddress) => {
    if (
      !this.store.userData.contractBlacklist.find(
        item =>
          isSameAddress(contract.address, item.address) &&
          contract.chainId === item.chainId,
      )
    ) {
      return;
    }

    this.mutateStore(draft => {
      draft.userData.contractBlacklist =
        draft.userData.contractBlacklist.filter(item => {
          return !(
            isSameAddress(item.address, contract.address) &&
            item.chainId === contract.chainId
          );
        });
    });
  };

  addAddressWhitelist = (address: string) => {
    if (this.store.userData.addressWhitelist.includes(address)) return;

    this.mutateStore(draft => {
      draft.userData.addressWhitelist.push(address.toLowerCase());
    });
  };

  removeAddressWhitelist = (address: string) => {
    if (!this.store.userData.addressWhitelist.includes(address.toLowerCase())) {
      return;
    }

    this.mutateStore(draft => {
      draft.userData.addressWhitelist = draft.userData.addressWhitelist.filter(
        item => {
          return item.toLowerCase() !== address.toLowerCase();
        },
      );
    });
  };

  addAddressBlacklist = (address: string) => {
    if (this.store.userData.addressBlacklist.includes(address)) return;

    this.mutateStore(draft => {
      draft.userData.addressBlacklist.push(address.toLowerCase());
    });
  };

  removeAddressBlacklist = (address: string) => {
    if (!this.store.userData.addressBlacklist.includes(address.toLowerCase())) {
      return;
    }

    this.mutateStore(draft => {
      draft.userData.addressBlacklist = draft.userData.addressBlacklist.filter(
        item => {
          return item.toLowerCase() !== address.toLowerCase();
        },
      );
    });
  };

  addOriginBlacklist = (origin: string) => {
    if (this.store.userData.originBlacklist.includes(origin)) return;

    this.mutateStore(draft => {
      draft.userData.originBlacklist.push(origin.toLowerCase());
    });
  };

  removeOriginBlacklist = (origin: string) => {
    if (!this.store.userData.originBlacklist.includes(origin.toLowerCase())) {
      return;
    }

    this.mutateStore(draft => {
      draft.userData.originBlacklist = draft.userData.originBlacklist.filter(
        item => {
          return item.toLowerCase() !== origin.toLowerCase();
        },
      );
    });
  };

  enableRule = (id: string) => {
    this.mutateStore(draft => {
      const rule = draft.rules.find(item => item.id === id);
      if (rule) {
        rule.enable = true;
      }
    });
    this.reloadRules(this.getStoreFieldSnapshot('rules'));
  };

  disableRule = (id: string) => {
    this.mutateStore(draft => {
      const rule = draft.rules.find(item => item.id === id);
      if (rule) {
        rule.enable = false;
      }
    });
    this.reloadRules(this.getStoreFieldSnapshot('rules'));
  };

  reloadRules = (rules: UserRuleConfig[]) => {
    this.rules = mergeRules(defaultRules, rules);
    this.engine?.reloadRules(this.rules);
  };
}
