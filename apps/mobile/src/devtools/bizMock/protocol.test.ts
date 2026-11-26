import { parseBizMockAction } from './protocol';

const config = {
  protocol: 'rabbymock-debug:',
  hostname: 'go.rabby.io',
  pathPrefix: '/mobile-mock/',
};

describe('parseBizMockAction', () => {
  it('parses a state dump action', () => {
    const result = parseBizMockAction(
      'rabbymock-debug://go.rabby.io/mobile-mock/?_cmd=state.dump&name=after-import&runId=r1',
      config,
    );
    expect(result).toMatchObject({
      matched: true,
      meta: { runId: 'r1' },
      action: { action: 'state.dump', name: 'after-import' },
    });
  });

  it('parses a screen open action with inline params', () => {
    const result = parseBizMockAction(
      'rabbymock-debug://go.rabby.io/mobile-mock/?_cmd=screen.open&screen=Home&params=%7B%22a%22%3A1%7D&push=1',
      config,
    );
    expect(result).toMatchObject({
      matched: true,
      action: {
        action: 'screen.open',
        screen: 'Home',
        params: { a: 1 },
        push: true,
      },
    });
  });

  it('rejects unknown commands', () => {
    const result = parseBizMockAction(
      'rabbymock-debug://go.rabby.io/mobile-mock/?_cmd=account.import',
      config,
    );
    expect(result).toMatchObject({
      matched: true,
      error: { code: 'unsupported-command' },
    });
  });

  it('rejects invalid inline json', () => {
    const result = parseBizMockAction(
      'rabbymock-debug://go.rabby.io/mobile-mock/?_cmd=screen.open&screen=Home&params=not-json',
      config,
    );
    expect(result).toMatchObject({
      matched: true,
      error: { code: 'invalid-json' },
    });
  });

  it('does not match a different protocol or path', () => {
    expect(
      parseBizMockAction(
        'rabbygo-debug://go.rabby.io/mobile-debug/?_cmd=state.dump',
        config,
      ),
    ).toEqual({ matched: false });
    expect(
      parseBizMockAction(
        'rabbymock-debug://go.rabby.io/mobile-debug/?_cmd=state.dump',
        config,
      ),
    ).toEqual({ matched: false });
  });
});
