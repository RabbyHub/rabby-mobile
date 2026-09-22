import {
  fetchUpgradePrompt,
  getAutoUpgradePromptDecision,
  resolveUpgradePrompt,
} from './upgradePrompt';

const PROMPT_URL =
  'https://download.rabby.io/downloads/wallet-mobile-config/upgrade-prompt.json';

function jsonResponse(
  body: unknown,
  ok = true,
  contentType = 'application/json',
) {
  return {
    ok,
    headers: { get: () => contentType },
    json: async () => body,
  };
}

describe('resolveUpgradePrompt', () => {
  const config = {
    both: {
      '0.6.90': true,
      '0.6.91': false,
      '0.6.95': 'yes',
    },
    ios: {
      '0.6.90': false,
      '0.6.92': true,
      '0.6.95': true,
    },
    android: null,
    extra: { '0.6.90': false },
  };

  it('keeps an explicit both flag ahead of the platform flag', () => {
    expect(resolveUpgradePrompt(config, 'ios', '0.6.90')).toBe(true);
    expect(resolveUpgradePrompt(config, 'ios', '0.6.91')).toBe(false);
  });

  it('reads the platform flag when both does not define that version', () => {
    expect(resolveUpgradePrompt(config, 'ios', '0.6.92')).toBe(true);
    expect(resolveUpgradePrompt(config, 'android', '0.6.92')).toBe(false);
  });

  it('ignores a bad entry and still uses a later valid flag', () => {
    expect(resolveUpgradePrompt(config, 'ios', '0.6.95')).toBe(true);
  });

  it('treats a missing version on a valid file as false', () => {
    expect(resolveUpgradePrompt(config, 'ios', '0.6.94')).toBe(false);
    expect(resolveUpgradePrompt({}, 'android', '0.6.90')).toBe(false);
  });

  it('returns undefined for an unusable document or a non-boolean entry', () => {
    expect(resolveUpgradePrompt([], 'ios', '0.6.90')).toBeUndefined();
    expect(resolveUpgradePrompt(null, 'ios', '0.6.90')).toBeUndefined();
    expect(resolveUpgradePrompt(config, 'ios', '')).toBeUndefined();
    expect(
      resolveUpgradePrompt({ both: { '1.0.0': 'yes' } }, 'ios', '1.0.0'),
    ).toBeUndefined();
  });
});

describe('getAutoUpgradePromptDecision', () => {
  const ready = {
    couldUpgrade: true,
    alreadyPrompted: false,
    autoPrompt: true as boolean | undefined,
    changelogValid: true,
  };

  it('shows only when every check passes', () => {
    expect(getAutoUpgradePromptDecision(ready)).toEqual({ willShow: true });
  });

  it('reports the first blocking reason', () => {
    expect(
      getAutoUpgradePromptDecision({ ...ready, couldUpgrade: false }),
    ).toEqual({ willShow: false, reason: 'not-higher' });
    expect(
      getAutoUpgradePromptDecision({ ...ready, alreadyPrompted: true }),
    ).toEqual({ willShow: false, reason: 'already-handled' });
    expect(
      getAutoUpgradePromptDecision({ ...ready, autoPrompt: false }),
    ).toEqual({ willShow: false, reason: 'config-off' });
    expect(
      getAutoUpgradePromptDecision({ ...ready, autoPrompt: undefined }),
    ).toEqual({ willShow: false, reason: 'config-missing' });
    expect(
      getAutoUpgradePromptDecision({ ...ready, changelogValid: false }),
    ).toEqual({ willShow: false, reason: 'changelog-invalid' });
  });
});

describe('fetchUpgradePrompt', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns undefined when the URL cannot be read', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse('missing', false)) as never;

    await expect(
      fetchUpgradePrompt(PROMPT_URL, 'ios', '0.6.92'),
    ).resolves.toBeUndefined();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('treats a valid file that omits this version as false', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({})) as never;

    await expect(
      fetchUpgradePrompt(PROMPT_URL, 'ios', '0.6.92'),
    ).resolves.toBe(false);
  });

  it('returns undefined for a non-object body, an HTML body, or a failed request', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(['nope'])) as never;
    await expect(
      fetchUpgradePrompt(PROMPT_URL, 'android', '0.6.90'),
    ).resolves.toBeUndefined();

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        jsonResponse('<html></html>', true, 'text/html'),
      ) as never;
    await expect(
      fetchUpgradePrompt(PROMPT_URL, 'android', '0.6.90'),
    ).resolves.toBeUndefined();

    global.fetch = jest.fn().mockRejectedValue(new Error('down')) as never;
    await expect(
      fetchUpgradePrompt(PROMPT_URL, 'android', '0.6.90'),
    ).resolves.toBeUndefined();
  });

  it('returns the flag from a readable config', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse({ both: { '0.6.90': false } })) as never;

    await expect(
      fetchUpgradePrompt(PROMPT_URL, 'android', '0.6.90'),
    ).resolves.toBe(false);
  });
});
