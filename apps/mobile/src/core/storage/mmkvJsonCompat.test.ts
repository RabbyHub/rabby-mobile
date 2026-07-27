import {
  parseMmkvJsonValue,
  readZustandPersistedState,
  unwrapDuplicatedJsonString,
} from './mmkvJsonCompat';

describe('MMKV JSON compatibility', () => {
  it('keeps an ordinary JSON string encoded', () => {
    expect(unwrapDuplicatedJsonString(JSON.stringify('value'))).toBe(
      JSON.stringify('value'),
    );
  });

  it('preserves the existing behavior for duplicated primitive values', () => {
    const encodedNumber = JSON.stringify(JSON.stringify(1));

    expect(unwrapDuplicatedJsonString(encodedNumber)).toBe(encodedNumber);
  });

  it('unwraps one duplicated JSON encoding layer', () => {
    const encoded = JSON.stringify(
      JSON.stringify({
        state: {
          enabled: true,
        },
        version: 0,
      }),
    );

    expect(parseMmkvJsonValue(encoded)).toEqual({
      state: {
        enabled: true,
      },
      version: 0,
    });
  });

  it('reads current Zustand and legacy state shapes', () => {
    expect(
      readZustandPersistedState(
        JSON.stringify({
          state: {
            enabled: true,
          },
          version: 0,
        }),
      ),
    ).toEqual({
      enabled: true,
    });
    expect(
      readZustandPersistedState(
        JSON.stringify({
          enabled: false,
        }),
      ),
    ).toEqual({
      enabled: false,
    });
  });

  it('rejects malformed and non-object values', () => {
    expect(readZustandPersistedState('not-json')).toBeNull();
    expect(readZustandPersistedState(JSON.stringify(['value']))).toBeNull();
  });
});
