import { isHttpRateLimitedError } from './rateLimitError';

describe('isHttpRateLimitedError', () => {
  it.each([
    { response: { status: 429 } },
    { statusCode: '429' },
    new Error('request failed: HTTP 429'),
    { message: 'Request failed with status code 429' },
    { cause: { response: { status: 429 } } },
  ])('recognizes a rate-limited failure', error => {
    expect(isHttpRateLimitedError(error)).toBe(true);
  });

  it.each([
    null,
    new Error('HTTP 500'),
    { response: { status: 403 } },
    { message: 'address contains 429 but has no HTTP status' },
  ])('does not classify another failure as rate limiting', error => {
    expect(isHttpRateLimitedError(error)).toBe(false);
  });
});
