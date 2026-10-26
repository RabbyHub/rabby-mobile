import { INTERNAL_REQUEST_ORIGIN } from '@/constant/internalRequest';
import { getInternalGasLimit } from './getInternalGasLimit';

describe('getInternalGasLimit', () => {
  it.each(['0xe7432', '947250', 947250])(
    'preserves the internally reserved gas limit: %s',
    gas => {
      expect(
        getInternalGasLimit({ origin: INTERNAL_REQUEST_ORIGIN, gas }),
      ).toBe('0xe7432');
    },
  );

  it.each([undefined, 'https://example.com'])(
    'does not reuse gas from an external request: %s',
    origin => {
      expect(getInternalGasLimit({ origin, gas: '0xe7432' })).toBeUndefined();
    },
  );

  it.each([
    undefined,
    '',
    '0x0',
    '-1',
    '1.5',
    'NaN',
    'Infinity',
    'invalid',
    '9007199254740992',
  ])('ignores an unusable internal gas limit: %s', gas => {
    expect(
      getInternalGasLimit({ origin: INTERNAL_REQUEST_ORIGIN, gas }),
    ).toBeUndefined();
  });
});
