import { apiSecurityEngine } from '@/core/apis';
import {
  Level,
  RuleConfig,
  UserData,
} from '@rabby-wallet/rabby-security-engine/dist/rules';
import { atom, useAtom } from 'jotai';
import React from 'react';

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

const userDataAtom = atom<State['userData']>({
  originWhitelist: [],
  originBlacklist: [],
  contractWhitelist: [],
  contractBlacklist: [],
  addressWhitelist: [],
  addressBlacklist: [],
});
const rulesAtom = atom<State['rules']>([]);
const currentTxAtom = atom<State['currentTx']>({
  processedRules: [],
  ruleDrawer: {
    selectRule: null,
    visible: false,
  },
});
export const useApprovalSecurityEngine = () => {
  const [userData, setUserData] = useAtom(userDataAtom);
  const [rules, setRules] = useAtom(rulesAtom);
  const [currentTx, setCurrentTx] = useAtom(currentTxAtom);

  const updateCurrentTx = React.useCallback(
    (payload: Partial<State['currentTx']>) => {
      setCurrentTx(prev => {
        return {
          ...prev,
          ...payload,
        };
      });
    },
    [setCurrentTx],
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
  const unProcessRule = React.useCallback(
    (id: string) => {
      setCurrentTx(prev => {
        return {
          ...prev,
          processedRules: prev.processedRules.filter(i => i !== id),
        };
      });
    },
    [setCurrentTx],
  );
  const processRule = React.useCallback(
    (id: string) => {
      setCurrentTx(prev => {
        return {
          ...prev,
          processedRules: [...prev.processedRules, id],
        };
      });
    },
    [setCurrentTx],
  );
  const init = React.useCallback(() => {
    setUserData(apiSecurityEngine.getSecurityEngineUserData());
    setRules(apiSecurityEngine.getSecurityEngineRules());
  }, [setRules, setUserData]);

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
