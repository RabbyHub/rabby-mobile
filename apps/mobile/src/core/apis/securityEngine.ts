import {
  ContextActionData,
  ContractAddress,
  UserData,
} from '@rabby-wallet/rabby-security-engine/dist/rules';
import { securityEngineServiceApi } from '@/core/serviceApi';

export const getSecurityEngineRules = () => {
  return securityEngineServiceApi.getRules();
};

export const getSecurityEngineUserData = () => {
  return securityEngineServiceApi.getUserData();
};

export const executeSecurityEngine = (actionData: ContextActionData) => {
  return securityEngineServiceApi.execute(actionData);
};

export const updateUserData = (data: UserData) => {
  return securityEngineServiceApi.updateUserData(data);
};

export const addContractWhitelist = async (contract: ContractAddress) => {
  await securityEngineServiceApi.removeContractBlacklistFromAllChains(contract);
  await securityEngineServiceApi.addContractWhitelist(contract);
};

export const addContractBlacklist = async (contract: ContractAddress) => {
  await securityEngineServiceApi.removeContractWhitelist(contract);
  await securityEngineServiceApi.addContractBlacklist(contract);
};

export const removeContractWhitelist = (contract: ContractAddress) => {
  return securityEngineServiceApi.removeContractWhitelist(contract);
};

export const removeContractBlacklist = (contract: ContractAddress) => {
  return securityEngineServiceApi.removeContractBlacklistFromAllChains(contract);
};

export const addAddressWhitelist = async (address: string) => {
  await securityEngineServiceApi.removeAddressBlacklist(address);
  await securityEngineServiceApi.addAddressWhitelist(address);
};

export const addAddressBlacklist = async (address: string) => {
  await securityEngineServiceApi.removeAddressWhitelist(address);
  await securityEngineServiceApi.addAddressBlacklist(address);
};

export const removeAddressWhitelist = (address: string) => {
  return securityEngineServiceApi.removeAddressWhitelist(address);
};

export const removeAddressBlacklist = (address: string) => {
  return securityEngineServiceApi.removeAddressBlacklist(address);
};

export const addOriginWhitelist = async (origin: string) => {
  await securityEngineServiceApi.removeOriginBlacklist(origin);
  await securityEngineServiceApi.addOriginWhitelist(origin);
};

export const addOriginBlacklist = async (origin: string) => {
  await securityEngineServiceApi.removeOriginWhitelist(origin);
  await securityEngineServiceApi.addOriginBlacklist(origin);
};

export const removeOriginWhitelist = (origin: string) => {
  return securityEngineServiceApi.removeOriginWhitelist(origin);
};

export const removeOriginBlacklist = (origin: string) => {
  return securityEngineServiceApi.removeOriginBlacklist(origin);
};

export const ruleEnableStatusChange = (id: string, value: boolean) => {
  if (value) {
    return securityEngineServiceApi.enableRule(id);
  } else {
    return securityEngineServiceApi.disableRule(id);
  }
};
