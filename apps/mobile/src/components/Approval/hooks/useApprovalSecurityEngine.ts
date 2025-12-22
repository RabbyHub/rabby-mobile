import { apiSecurityEngine } from '@/core/apis';
import {
  Level,
  RuleConfig,
  UserData,
} from '@rabby-wallet/rabby-security-engine/dist/rules';
import React from 'react';
import { zCreate } from '@/core/utils/reexports';
import { UpdaterOrPartials, resolveValFromUpdater } from '@/core/utils/store';

interface State {
  userData: UserData;
  rules: RuleConfig[];
  currentTx: {
    processedRules: string[];
    ruleDrawer: {
      selectRule: {
        ruleConfig: RuleConfig;
        value?: number | string | boolean;
        level?: Level;
        ignored: boolean;
      } | null;
      visible: boolean;
    };
  };
}

const approvalSecurityEngineStore = zCreate<State>()(() => ({
  userData: {
    originWhitelist: [],
    originBlacklist: [],
    contractWhitelist: [],
    contractBlacklist: [],
    addressWhitelist: [],
    addressBlacklist: [],
  },
  rules: [],
  currentTx: {
    processedRules: [],
    ruleDrawer: {
      selectRule: null,
      visible: false,
    },
  },
}));

function setUserData(valOrFunc: UpdaterOrPartials<UserData>) {
  approvalSecurityEngineStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev.userData, valOrFunc);
    return { ...prev, userData: newVal };
  });
}

function setRules(valOrFunc: UpdaterOrPartials<RuleConfig[]>) {
  approvalSecurityEngineStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev.rules, valOrFunc);
    return { ...prev, rules: newVal };
  });
}

function setCurrentTx(valOrFunc: UpdaterOrPartials<State['currentTx']>) {
  approvalSecurityEngineStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev.currentTx, valOrFunc);
    return { ...prev, currentTx: newVal };
  });
}

export const useApprovalSecurityEngine = () => {
  const { userData, rules, currentTx } = approvalSecurityEngineStore();

  const updateCurrentTx = React.useCallback(
    (payload: Partial<State['currentTx']>) => {
      setCurrentTx(prev => {
        return {
          ...prev,
          ...payload,
        };
      });
    },
    [],
  );

  const resetCurrentTx = React.useCallback(() => {
    updateCurrentTx({
      processedRules: [],
      ruleDrawer: {
        selectRule: null,
        visible: false,
      },
    });
  }, [updateCurrentTx]);
  const openRuleDrawer = React.useCallback(
    (rule: {
      ruleConfig: RuleConfig;
      value?: number | string | boolean;
      level?: Level;
      ignored: boolean;
    }) => {
      updateCurrentTx({
        ruleDrawer: {
          selectRule: rule,
          visible: true,
        },
      });
    },
    [updateCurrentTx],
  );
  const closeRuleDrawer = React.useCallback(() => {
    updateCurrentTx({
      ruleDrawer: {
        selectRule: null,
        visible: false,
      },
    });
  }, [updateCurrentTx]);
  const processAllRules = React.useCallback(
    (ids: string[]) => {
      updateCurrentTx({
        processedRules: ids,
      });
    },
    [updateCurrentTx],
  );
  const unProcessRule = React.useCallback((id: string) => {
    setCurrentTx(prev => {
      return {
        ...prev,
        processedRules: prev.processedRules.filter(i => i !== id),
      };
    });
  }, []);
  const processRule = React.useCallback((id: string) => {
    setCurrentTx(prev => {
      return {
        ...prev,
        processedRules: [...prev.processedRules, id],
      };
    });
  }, []);
  const init = React.useCallback(() => {
    setUserData(apiSecurityEngine.getSecurityEngineUserData());
    setRules(apiSecurityEngine.getSecurityEngineRules());
  }, []);

  return {
    userData,
    setUserData,
    rules,
    currentTx,
    resetCurrentTx,
    openRuleDrawer,
    closeRuleDrawer,
    processAllRules,
    unProcessRule,
    processRule,
    init,
  };
};
