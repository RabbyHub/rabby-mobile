import type { Result } from '@rabby-wallet/rabby-security-engine';
import Engine from '@rabby-wallet/rabby-security-engine';
import {
  defaultRules,
  Level,
} from '@rabby-wallet/rabby-security-engine/dist/rules';
import { getSecurityRuleKey } from '../../hooks/securityEngineScope';
import {
  getActionSecurityGate,
  hasActionSecurityError,
} from './actionSecurity';

const result = (id: string, level: Level, enable = true): Result => ({
  id,
  level,
  enable,
  value: 0,
  valueDescription: '',
  valueDefine: defaultRules[0].valueDefine,
  threshold: {},
});

describe('action security gate', () => {
  test('the actual 1016 rule blocks the same token-contract recipient alone or inside a batch', async () => {
    const rule = defaultRules.find(item => item.id === '1016')!;
    // This rule reads the already prepared send context and performs no I/O.
    const engine = new Engine(
      [rule],
      {} as ConstructorParameters<typeof Engine>[1],
    );
    const results = await engine.run({
      send: { isTokenContract: true },
    } as Parameters<typeof engine.run>[0]);
    expect(results).toEqual([
      expect.objectContaining({ id: '1016', level: Level.DANGER }),
    ]);
    const risk = { scope: 'recipient', results };
    for (const groups of [[risk], [{ scope: 'other', results: [] }, risk]]) {
      expect(getActionSecurityGate(groups, [], 'transaction')).toMatchObject({
        securityLevel: Level.DANGER,
        hasUnProcessSecurityResult: true,
      });
    }
  });
  test('distinguishes a failed enabled rule from a completed empty evaluation', () => {
    expect(hasActionSecurityError([[], []])).toBe(false);
    expect(
      hasActionSecurityError([[result('failed', Level.ERROR, false)]]),
    ).toBe(false);
    expect(
      hasActionSecurityError([
        [result('safe', Level.SAFE)],
        [result('failed', Level.ERROR)],
      ]),
    ).toBe(true);
  });
  test.each([
    ['transaction', '1016', Level.DANGER],
    ['typedData', '1077', Level.DANGER],
    ['typedData', '1134', Level.FORBIDDEN],
  ] as const)(
    '%s blocks %s in single and multiple actions',
    (mode, id, level) => {
      const riskyAction = {
        scope: 'request:1:0',
        results: [result(id, level)],
      };
      const safeAction = {
        scope: 'request:1:1',
        results: [result('safe', Level.SAFE)],
      };

      for (const groups of [[riskyAction], [safeAction, riskyAction]]) {
        expect(getActionSecurityGate(groups, [], mode)).toMatchObject({
          securityLevel: level,
          hasUnProcessSecurityResult: true,
          pendingRuleKeys: [getSecurityRuleKey(id, riskyAction.scope)],
        });
      }
    },
  );

  test('keeps SAFE relaxation local to an action and preserves true-danger rules', () => {
    const groups = [
      {
        scope: 'request:1:0',
        results: [result('safe', Level.SAFE), result('1077', Level.DANGER)],
      },
    ];
    expect(getActionSecurityGate(groups, [], 'typedData')).toMatchObject({
      securityLevel: Level.DANGER,
      hasUnProcessSecurityResult: false,
    });
    groups[0].results[1] = result('1016', Level.DANGER);
    expect(getActionSecurityGate(groups, [], 'transaction')).toMatchObject({
      hasUnProcessSecurityResult: true,
    });
  });

  test('acknowledging one occurrence cannot acknowledge another action or evaluation', () => {
    const groups = ['request:1:0', 'request:1:1'].map(scope => ({
      scope,
      results: [result('1077', Level.DANGER)],
    }));
    const firstKey = getSecurityRuleKey('1077', groups[0].scope);
    expect(getActionSecurityGate(groups, [firstKey], 'typedData')).toEqual({
      securityLevel: Level.DANGER,
      hasUnProcessSecurityResult: true,
      pendingRuleKeys: [getSecurityRuleKey('1077', groups[1].scope)],
    });
    expect(
      getActionSecurityGate(
        [{ ...groups[0], scope: 'request:2:0' }],
        [firstKey, '1077'],
        'typedData',
      ).hasUnProcessSecurityResult,
    ).toBe(true);
  });

  test('Ignore all acknowledges every current action risk and enables undo', () => {
    const groups = [
      {
        scope: 'request:1:0',
        results: [
          result('1077', Level.DANGER),
          result('disabled', Level.DANGER, false),
        ],
      },
      { scope: 'request:1:1', results: [result('1077', Level.WARNING)] },
    ];
    const { pendingRuleKeys } = getActionSecurityGate(groups, [], 'typedData');
    expect(pendingRuleKeys).toHaveLength(2);
    expect(getActionSecurityGate(groups, pendingRuleKeys, 'typedData')).toEqual(
      {
        securityLevel: undefined,
        hasUnProcessSecurityResult: false,
        pendingRuleKeys: [],
      },
    );
    expect(
      getActionSecurityGate(groups, pendingRuleKeys.slice(0, 1), 'typedData'),
    ).toMatchObject({
      securityLevel: Level.WARNING,
      hasUnProcessSecurityResult: true,
    });
  });

  test('accepts a completed evaluation with no applicable rules', () => {
    expect(
      getActionSecurityGate(
        [{ scope: 'request:1:0', results: [] }],
        [],
        'transaction',
      ),
    ).toEqual({
      securityLevel: undefined,
      hasUnProcessSecurityResult: false,
      pendingRuleKeys: [],
    });
  });
});
