jest.mock('@/constant', () => ({
  APP_VERSIONS: {
    forSentry: '0.0.0-test',
  },
}));

jest.mock('@/constant/env', () => ({
  SENTRY_DEBUG: false,
  getSentryEnv: () => 'test',
}));

import { shouldDropSentryEvent } from './sentry';

type SentryEvent = Parameters<typeof shouldDropSentryEvent>[0];
type SentryEventHint = NonNullable<Parameters<typeof shouldDropSentryEvent>[1]>;

function makeEvent(message: string): SentryEvent {
  return {
    message,
  };
}

describe('sentry filtering', () => {
  it.each([
    'device is inactive, please activate it first',
    'device not found',
    'Network request failed',
    'Network Error',
    'Network request timed out',
    'Request timeout',
    'Request timed out',
    'Request failed with status code 503',
    'timeout exceeded',
    'AxiosError: timeout exceeded',
    'Failed to connect',
    '[connectFeService] Empty push token, cannot connect to push server',
    "You've already added this chain",
    'Billing is unavailable. This may be a problem with your device, or the Play Store may be down.',
    'Stop loss cancel errorerror: {}',
  ])('drops known noisy exception: %s', message => {
    expect(shouldDropSentryEvent(makeEvent(message))).toBe(true);
  });

  it('drops known noisy exception values', () => {
    expect(
      shouldDropSentryEvent({
        exception: {
          values: [
            {
              type: 'AxiosError',
              value: 'Network Error',
            },
          ],
        },
      }),
    ).toBe(true);
  });

  it('drops errors with http protocol text', () => {
    expect(
      shouldDropSentryEvent(
        makeEvent('Request failed for https://api.rabby.io/v1/test'),
      ),
    ).toBe(true);

    expect(
      shouldDropSentryEvent({
        exception: {
          values: [
            {
              type: 'Error',
              value: 'Request timeout',
              stacktrace: {
                frames: [
                  {
                    filename:
                      '@rabby-wallet/hyperliquid-sdk/dist/client/http-client',
                  },
                ],
              },
            },
          ],
        },
      }),
    ).toBe(true);
  });

  it('drops synthetic event objects captured as exceptions', () => {
    const hint: SentryEventHint = {
      originalException: {
        _bubbles: true,
        _cancelable: true,
        _composed: true,
      },
    };

    expect(
      shouldDropSentryEvent(
        {
          exception: {
            values: [
              {
                type: 'apply',
                value:
                  'Object captured as exception with keys: _bubbles, _cancelable, _composed',
              },
            ],
          },
        },
        hint,
      ),
    ).toBe(true);
  });

  it('keeps unrelated errors', () => {
    expect(
      shouldDropSentryEvent(makeEvent('Unexpected database failure')),
    ).toBe(false);
  });
});
