import { useEffect, useState } from 'react';
import {
  UserData,
  ContextActionData,
  RuleConfig,
} from '@rabby-wallet/rabby-security-engine/dist/rules';
import { apiSecurityEngine } from '@/core/apis';

export const useSecurityEngine = (nonce = 0) => {
  const [userData, setUserData] = useState<UserData>({
    originBlacklist: [],
    originWhitelist: [],
    addressBlacklist: [],
    addressWhitelist: [],
    contractBlacklist: [],
    contractWhitelist: [],
  });
  const [rules, setRules] = useState<RuleConfig[]>([]);

  const fetch = async () => {
    const data = await apiSecurityEngine.getSecurityEngineUserData();
    const r = await apiSecurityEngine.getSecurityEngineRules();
    setUserData(data);
    setRules(r);
  };

  const executeEngine = (actionData: ContextActionData) => {
    return apiSecurityEngine.executeSecurityEngine(actionData);
  };

  const updateUserData = async (data: UserData) => {
    await apiSecurityEngine.updateUserData(data);
    fetch();
  };

  useEffect(() => {
    fetch();
  }, [nonce]);

  return {
    rules,
    userData,
    executeEngine,
    updateUserData,
  };
};
