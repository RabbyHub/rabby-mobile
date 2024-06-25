import React from 'react';
import SecurityLevelTagNoText from '../../SecurityEngine/SecurityLevelTagNoText';
import { Result } from '@rabby-wallet/rabby-security-engine';
import { useApprovalSecurityEngine } from '../../../hooks/useApprovalSecurityEngine';

export interface Props {
  id: string;
  engineResult: Result;
  inSubTable?: boolean;
}

export const SecurityListItemTag: React.FC<Props> = ({
  id,
  engineResult,
  inSubTable,
}) => {
  const { rules, currentTx, userData, openRuleDrawer } =
    useApprovalSecurityEngine();
  const handleClickRule = (id: string) => {
    const rule = rules.find(item => item.id === id);
    if (!rule) return;
    const result = engineResult;
    openRuleDrawer({
      ruleConfig: rule,
      value: result?.value,
      level: result?.level,
      ignored: currentTx.processedRules.includes(id),
    });
  };

  if (!engineResult) return null;

  return (
    <SecurityLevelTagNoText
      enable={engineResult.enable}
      level={
        currentTx.processedRules.includes(id) ? 'proceed' : engineResult.level
      }
      onClick={() => handleClickRule(id)}
      inSubTable={inSubTable}
    />
  );
};
