import {
  ContextActionData,
  ContractAddress,
  UserData,
} from '@rabby-wallet/rabby-security-engine/dist/rules';
import { securityEngineService } from '../services';

export const getSecurityEngineRules = () => {
  return securityEngineService.getRules();
};

export const getSecurityEngineUserData = () => {
  return securityEngineService.getUserData();
};

export const executeSecurityEngine = (actionData: ContextActionData) => {
  return securityEngineService.execute(actionData);
};

export const updateUserData = (data: UserData) => {
  securityEngineService.updateUserData(data);
};

export const addContractWhitelist = (contract: ContractAddress) => {
  securityEngineService.removeContractBlacklistFromAllChains(contract);
  securityEngineService.addContractWhitelist(contract);
};

export const addContractBlacklist = (contract: ContractAddress) => {
  securityEngineService.removeContractWhitelist(contract);
  securityEngineService.addContractBlacklist(contract);
};

export const removeContractWhitelist = (contract: ContractAddress) => {
  securityEngineService.removeContractWhitelist(contract);
};

export const removeContractBlacklist = (contract: ContractAddress) => {
  securityEngineService.removeContractBlacklistFromAllChains(contract);
};

export const addAddressWhitelist = (address: string) => {
  securityEngineService.removeAddressBlacklist(address);
  securityEngineService.addAddressWhitelist(address);
};

export const addAddressBlacklist = (address: string) => {
  securityEngineService.removeAddressWhitelist(address);
  securityEngineService.addAddressBlacklist(address);
};

export const removeAddressWhitelist = (address: string) => {
  securityEngineService.removeAddressWhitelist(address);
};

export const removeAddressBlacklist = (address: string) => {
  securityEngineService.removeAddressBlacklist(address);
};

export const addOriginWhitelist = (origin: string) => {
  securityEngineService.removeOriginBlacklist(origin);
  securityEngineService.addOriginWhitelist(origin);
};

export const addOriginBlacklist = (origin: string) => {
  securityEngineService.removeOriginWhitelist(origin);
  securityEngineService.addOriginBlacklist(origin);
};

export const removeOriginWhitelist = (origin: string) => {
  securityEngineService.removeOriginWhitelist(origin);
};

export const removeOriginBlacklist = (origin: string) => {
  securityEngineService.removeOriginBlacklist(origin);
};

export const ruleEnableStatusChange = (id: string, value: boolean) => {
  if (value) {
    securityEngineService.enableRule(id);
  } else {
    securityEngineService.disableRule(id);
  }
};
