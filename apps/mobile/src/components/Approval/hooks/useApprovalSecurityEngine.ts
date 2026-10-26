import * as apiSecurityEngine from '@/core/apis/securityEngine';
import {
  Level,
  RuleConfig,
  UserData,
} from '@rabby-wallet/rabby-security-engine/dist/rules';
import { atom, useAtom, useStore } from 'jotai';
import React from 'react';
import { isEqual } from 'lodash';
import {
  getProcessedRulesForScope,
  getSecurityRuleKey,
} from './securityEngineScope';

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
        scope?: string;
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
  const scope = React.useContext(SecurityEngineScopeContext);
  const store = useStore();
  const [userData, setUserData] = useAtom(userDataAtom);
  const [rules, setRules] = useAtom(rulesAtom);
  const [currentTx, setCurrentTx] = useAtom(currentTxAtom);
  const getSnapshot = React.useCallback(
    () => ({
      rules: store.get(rulesAtom),
      userData: store.get(userDataAtom),
      currentTx: store.get(currentTxAtom),
    }),
    [store],
  );
  const scopedCurrentTx = React.useMemo(
    () =>
      scope === undefined
        ? currentTx
        : {
            ...currentTx,
            processedRules: getProcessedRulesForScope(
              currentTx.processedRules,
              scope,
            ),
          },
    [currentTx, scope],
  );

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
      scope?: string;
    }) => {
      updateCurrentTx({
        ruleDrawer: {
          selectRule: { ...rule, scope: rule.scope ?? scope },
          visible: true,
        },
      });
    },
    [updateCurrentTx, scope],
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
    (id: string, ruleScope?: string) => {
      const key = getSecurityRuleKey(id, ruleScope ?? scope);
      setCurrentTx(prev => {
        return {
          ...prev,
          processedRules: prev.processedRules.filter(i => i !== key),
        };
      });
    },
    [setCurrentTx, scope],
  );
  const processRule = React.useCallback(
    (id: string, ruleScope?: string) => {
      const key = getSecurityRuleKey(id, ruleScope ?? scope);
      setCurrentTx(prev => {
        return {
          ...prev,
          processedRules: Array.from(new Set([...prev.processedRules, key])),
        };
      });
    },
    [setCurrentTx, scope],
  );
  const init = React.useCallback(async () => {
    const [nextUserData, nextRules] = await Promise.all([
      apiSecurityEngine.getSecurityEngineUserData(),
      apiSecurityEngine.getSecurityEngineRules(),
    ]);
    // Rows refresh settings on mount. Unchanged settings must not restart the
    // approval evaluation and remount those rows again.
    setUserData(prev => (isEqual(prev, nextUserData) ? prev : nextUserData));
    setRules(prev => (isEqual(prev, nextRules) ? prev : nextRules));
  }, [setRules, setUserData]);

  return {
    userData,
    setUserData,
    rules,
    currentTx: scopedCurrentTx,
    getSnapshot,
    resetCurrentTx,
    openRuleDrawer,
    closeRuleDrawer,
    processAllRules,
    unProcessRule,
    processRule,
    init,
  };
};

const SecurityEngineScopeContext = React.createContext<string | undefined>(
  undefined,
);

export const SecurityEngineScopeProvider = ({
  scope,
  children,
}: {
  scope?: string;
  children?: React.ReactNode;
}) =>
  React.createElement(
    SecurityEngineScopeContext.Provider,
    { value: scope },
    children,
  );
