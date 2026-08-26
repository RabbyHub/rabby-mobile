import {
  normalizeBackendApiHost,
  parseBackendApiHostDebugCommand,
} from './backendApiHost';

const DEFAULT_HOST = 'https://app-api.rabby.io';

describe('backendApiHost', () => {
  it('normalizes an HTTP(S) backend host without changing its path', () => {
    expect(normalizeBackendApiHost(' https://office-api.example.test/ ')).toBe(
      'https://office-api.example.test',
    );
    expect(normalizeBackendApiHost('http://10.0.0.2:8080/rabby-api/')).toBe(
      'http://10.0.0.2:8080/rabby-api',
    );
  });

  it.each([
    '',
    'office-api.example.test',
    'ftp://office-api.example.test',
    'https://user:password@office-api.example.test',
    'https://office-api.example.test?token=value',
    'https://office-api.example.test#fragment',
  ])('rejects an unsafe or malformed backend host: %s', value => {
    expect(normalizeBackendApiHost(value)).toBeNull();
  });

  it('parses a set command', () => {
    const result = parseBackendApiHostDebugCommand(
      new URLSearchParams({
        action: 'set',
        host: 'https://office-api.example.test/',
      }),
      DEFAULT_HOST,
    );

    expect(result).toEqual({
      command: {
        action: 'set',
        host: 'https://office-api.example.test',
      },
    });
  });

  it('parses a reset command without requiring a host', () => {
    expect(
      parseBackendApiHostDebugCommand(
        new URLSearchParams({ action: 'reset' }),
        DEFAULT_HOST,
      ),
    ).toEqual({
      command: {
        action: 'reset',
        host: DEFAULT_HOST,
      },
    });
  });

  it('rejects unsupported actions and missing hosts', () => {
    expect(
      parseBackendApiHostDebugCommand(
        new URLSearchParams({ action: 'toggle' }),
        DEFAULT_HOST,
      ),
    ).toEqual({ error: 'Backend API host action must be set or reset' });
    expect(
      parseBackendApiHostDebugCommand(
        new URLSearchParams({ action: 'set' }),
        DEFAULT_HOST,
      ),
    ).toEqual({ error: 'Backend API host must be a valid HTTP(S) URL' });
  });
});
