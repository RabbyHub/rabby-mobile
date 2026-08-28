import {
  getRegressionConfigureEnabled,
  parseRegressionScenarioCommand,
  sanitizeLinkForLogging,
} from './command';

const BASE_URL =
  'rabbygo-regression://go.rabby.io/mobile-regression/test?mode=lifecycle-e2e';

describe('regression scenario command', () => {
  it('parses a typed scenario without exposing fixture contents', () => {
    const now = 1_700_000_000_000;
    const result = parseRegressionScenarioCommand(
      `${BASE_URL}&scenario=wallet-onboarding&action=start&runId=run-1&fixture=wallet-set-a`,
      now,
    );

    expect(result).toEqual({
      matched: true,
      command: expect.objectContaining({
        scenario: 'wallet-onboarding',
        action: 'start',
        runId: 'run-1',
        fixture: 'wallet-set-a',
        expiresAt: now + 5 * 60 * 1000,
      }),
    });
  });

  it.each(['password', 'privateKey', 'mnemonic', 'seed_phrase'])(
    'rejects the sensitive query key %s',
    key => {
      const result = parseRegressionScenarioCommand(
        `${BASE_URL}&scenario=lock-unlock&runId=run-2&${key}=secret`,
      );

      expect(result).toEqual(
        expect.objectContaining({
          matched: true,
          command: null,
          error: expect.stringContaining('Sensitive query parameter'),
        }),
      );
    },
  );

  it('requires a known scenario for executable actions', () => {
    expect(
      parseRegressionScenarioCommand(
        `${BASE_URL}&scenario=unknown&runId=run-3`,
      ),
    ).toEqual(
      expect.objectContaining({
        matched: true,
        command: null,
        error: expect.stringContaining('Unknown lifecycle E2E scenario'),
      }),
    );
  });

  it('allows configure without a scenario and reads its enabled flag', () => {
    const result = parseRegressionScenarioCommand(
      `${BASE_URL}&action=configure&enabled=true`,
    );

    expect(result.matched).toBe(true);
    if (!result.matched || !result.command) {
      throw new Error('Expected a configure command');
    }
    expect(getRegressionConfigureEnabled(result.command)).toBe(true);
  });

  it('redacts sensitive and nested URL fields from logs', () => {
    const sanitized = sanitizeLinkForLogging(
      `${BASE_URL}&scenario=dapp-browser&runId=run-4&url=https%3A%2F%2Fexample.com%2Fprivate&fixturePath=%2Ftmp%2Ffixture`,
    );

    expect(sanitized).not.toContain('/tmp/fixture');
    expect(sanitized).not.toContain('example.com');
    expect(sanitized).toContain('%3Credacted%3E');
  });
});
