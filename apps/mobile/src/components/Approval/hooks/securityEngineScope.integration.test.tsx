import React from 'react';
import { act, render, cleanup } from '@testing-library/react-native';
import { createStore, Provider } from 'jotai';
import {
  defaultRules,
  Level,
} from '@rabby-wallet/rabby-security-engine/dist/rules';
import {
  SecurityEngineScopeProvider,
  useApprovalSecurityEngine,
} from './useApprovalSecurityEngine';
import { getActionSecurityGate } from '../components/SecurityEngine/actionSecurity';
import { getSecurityRuleKey } from './securityEngineScope';

// JS integration: real Jotai state, scope Providers, row Hooks and scene gate.
// No service or native signing claims are made by this contract.
test('row acknowledgement, undo and Ignore all agree with the scene gate across action/evaluation scopes', () => {
  let scene!: ReturnType<typeof useApprovalSecurityEngine>;
  const rows: Record<string, ReturnType<typeof useApprovalSecurityEngine>> = {};
  function Row({ name }: { name: string }) {
    rows[name] = useApprovalSecurityEngine();
    return null;
  }
  function Scene({ version }: { version: number }) {
    scene = useApprovalSecurityEngine();
    return (
      <>
        {['a', 'b'].map(name => (
          <SecurityEngineScopeProvider key={name} scope={`${version}:${name}`}>
            <Row name={name} />
          </SecurityEngineScopeProvider>
        ))}
      </>
    );
  }
  const store = createStore();
  const view = (version: number) => (
    <Provider store={store}>
      <Scene version={version} />
    </Provider>
  );
  const { rerender } = render(view(1));
  const rule = defaultRules.find(item => item.id === '1016')!;
  const result = {
    id: rule.id,
    enable: true,
    level: Level.DANGER,
    value: true,
    valueDescription: '',
    valueDefine: rule.valueDefine,
    threshold: {},
  };
  const groups = ['a', 'b'].map(name => ({
    scope: `1:${name}`,
    results: [result],
  }));
  const gate = () =>
    getActionSecurityGate(
      groups,
      scene.currentTx.processedRules,
      'transaction',
    );
  try {
    act(() =>
      rows.a.openRuleDrawer({
        ruleConfig: rule,
        ignored: false,
        level: Level.DANGER,
      }),
    );
    expect(scene.currentTx.ruleDrawer.selectRule?.scope).toBe('1:a');
    act(() =>
      scene.processRule(rule.id, scene.currentTx.ruleDrawer.selectRule?.scope),
    );
    expect(rows.a.currentTx.processedRules).toEqual([rule.id]);
    expect(rows.b.currentTx.processedRules).toEqual([]);
    expect(gate().hasUnProcessSecurityResult).toBe(true);
    act(() =>
      scene.processAllRules([
        ...scene.currentTx.processedRules,
        ...gate().pendingRuleKeys,
      ]),
    );
    expect(rows.b.currentTx.processedRules).toEqual([rule.id]);
    expect(gate().hasUnProcessSecurityResult).toBe(false);
    act(() => rows.b.unProcessRule(rule.id));
    expect(gate().pendingRuleKeys).toEqual([
      getSecurityRuleKey(rule.id, '1:b'),
    ]);
    rerender(view(2));
    expect(rows.a.currentTx.processedRules).toEqual([]);
    expect(rows.b.currentTx.processedRules).toEqual([]);
  } finally {
    cleanup();
  }
});
