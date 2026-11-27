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

  it('parses account and approval actions', () => {
    expect(
      parseBizMockAction(
        'rabbymock-debug://go.rabby.io/mobile-mock/?_cmd=account.importFromFile&file=kpi-test-accounts.txt',
        config,
      ),
    ).toMatchObject({
      matched: true,
      action: {
        action: 'account.importFromFile',
        file: 'kpi-test-accounts.txt',
      },
    });
    expect(
      parseBizMockAction(
        'rabbymock-debug://go.rabby.io/mobile-mock/?_cmd=account.select&address=0xabc',
        config,
      ),
    ).toMatchObject({
      matched: true,
      action: { action: 'account.select', address: '0xabc' },
    });
    expect(
      parseBizMockAction(
        'rabbymock-debug://go.rabby.io/mobile-mock/?_cmd=approval.injectFromFile&file=sign-tx&component=SignTx&origin=https%3A%2F%2Fopensea.io',
        config,
      ),
    ).toMatchObject({
      matched: true,
      action: {
        action: 'approval.injectFromFile',
        file: 'sign-tx',
        component: 'SignTx',
        origin: 'https://opensea.io',
      },
    });
    expect(
      parseBizMockAction(
        'rabbymock-debug://go.rabby.io/mobile-mock/?_cmd=approval.rejectAll',
        config,
      ),
    ).toMatchObject({
      matched: true,
      action: { action: 'approval.rejectAll' },
    });
    expect(
      parseBizMockAction(
        'rabbymock-debug://go.rabby.io/mobile-mock/?_cmd=env.setScreenE2E&enabled=1',
        config,
      ),
    ).toMatchObject({
      matched: true,
      action: { action: 'env.setScreenE2E', enabled: true },
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

  it('parses an action.invoke target by id or testID', () => {
    expect(
      parseBizMockAction(
        'rabbymock-debug://go.rabby.io/mobile-mock/?_cmd=action.invoke&id=home.action.swap&payload=%7B%22a%22%3A1%7D&timeoutMs=2000',
        config,
      ),
    ).toMatchObject({
      matched: true,
      action: {
        action: 'action.invoke',
        id: 'home.action.swap',
        payload: { a: 1 },
        timeoutMs: 2000,
      },
    });
    expect(
      parseBizMockAction(
        'rabbymock-debug://go.rabby.io/mobile-mock/?_cmd=action.invoke&testID=home-bottom-swap',
        config,
      ),
    ).toMatchObject({
      matched: true,
      action: {
        action: 'action.invoke',
        testID: 'home-bottom-swap',
      },
    });
  });

  it('requires an id or testID for action.invoke', () => {
    expect(
      parseBizMockAction(
        'rabbymock-debug://go.rabby.io/mobile-mock/?_cmd=action.invoke',
        config,
      ),
    ).toMatchObject({
      matched: true,
      error: { code: 'missing-param' },
    });
  });

  it('parses home.openSingleAddress', () => {
    expect(
      parseBizMockAction(
        'rabbymock-debug://go.rabby.io/mobile-mock/?_cmd=home.openSingleAddress',
        config,
      ),
    ).toMatchObject({
      matched: true,
      action: { action: 'home.openSingleAddress' },
    });
  });

  it('parses account maintenance, approval dump and store pins', () => {
    expect(
      parseBizMockAction(
        'rabbymock-debug://go.rabby.io/mobile-mock/?_cmd=account.remove&address=0xabc',
        config,
      ),
    ).toMatchObject({
      matched: true,
      action: { action: 'account.remove', address: '0xabc' },
    });
    expect(
      parseBizMockAction(
        'rabbymock-debug://go.rabby.io/mobile-mock/?_cmd=account.create',
        config,
      ),
    ).toMatchObject({
      matched: true,
      action: { action: 'account.create' },
    });
    expect(
      parseBizMockAction(
        'rabbymock-debug://go.rabby.io/mobile-mock/?_cmd=approval.dump&name=sign-tx',
        config,
      ),
    ).toMatchObject({
      matched: true,
      action: { action: 'approval.dump', name: 'sign-tx' },
    });
    expect(
      parseBizMockAction(
        'rabbymock-debug://go.rabby.io/mobile-mock/?_cmd=store.pin&store=%7B%22balanceAccounts%22%3A%7B%22totalBalance%22%3A1%7D%7D',
        config,
      ),
    ).toMatchObject({
      matched: true,
      action: {
        action: 'store.pin',
        store: { balanceAccounts: { totalBalance: 1 } },
      },
    });
    expect(
      parseBizMockAction(
        'rabbymock-debug://go.rabby.io/mobile-mock/?_cmd=store.clearPins',
        config,
      ),
    ).toMatchObject({
      matched: true,
      action: { action: 'store.clearPins' },
    });
  });

  it('requires an address for account.remove and a store for store.pin', () => {
    expect(
      parseBizMockAction(
        'rabbymock-debug://go.rabby.io/mobile-mock/?_cmd=account.remove',
        config,
      ),
    ).toMatchObject({
      matched: true,
      error: { code: 'missing-param' },
    });
    expect(
      parseBizMockAction(
        'rabbymock-debug://go.rabby.io/mobile-mock/?_cmd=store.pin',
        config,
      ),
    ).toMatchObject({
      matched: true,
      error: { code: 'missing-param' },
    });
  });

  it('parses dapp actions', () => {
    expect(
      parseBizMockAction(
        'rabbymock-debug://go.rabby.io/mobile-mock/?_cmd=dapp.tabs&op=list&name=tabs',
        config,
      ),
    ).toMatchObject({
      matched: true,
      action: { action: 'dapp.tabs', op: 'list', name: 'tabs' },
    });
    expect(
      parseBizMockAction(
        'rabbymock-debug://go.rabby.io/mobile-mock/?_cmd=dapp.eval&code=1%2B1',
        config,
      ),
    ).toMatchObject({
      matched: true,
      action: { action: 'dapp.eval', code: '1+1' },
    });
    expect(
      parseBizMockAction(
        'rabbymock-debug://go.rabby.io/mobile-mock/?_cmd=dapp.disconnect&origin=https%3A%2F%2Fopensea.io',
        config,
      ),
    ).toMatchObject({
      matched: true,
      action: { action: 'dapp.disconnect', origin: 'https://opensea.io' },
    });
  });

  it('requires params for dapp.eval and dapp.disconnect', () => {
    expect(
      parseBizMockAction(
        'rabbymock-debug://go.rabby.io/mobile-mock/?_cmd=dapp.eval',
        config,
      ),
    ).toMatchObject({ matched: true, error: { code: 'missing-param' } });
    expect(
      parseBizMockAction(
        'rabbymock-debug://go.rabby.io/mobile-mock/?_cmd=dapp.disconnect',
        config,
      ),
    ).toMatchObject({ matched: true, error: { code: 'missing-param' } });
  });

  it('parses history.openLocalDetail', () => {
    expect(
      parseBizMockAction(
        'rabbymock-debug://go.rabby.io/mobile-mock/?_cmd=history.openLocalDetail&address=0xabc',
        config,
      ),
    ).toMatchObject({
      matched: true,
      action: { action: 'history.openLocalDetail', address: '0xabc' },
    });
  });

  it('parses history.seedLocalTx', () => {
    expect(
      parseBizMockAction(
        'rabbymock-debug://go.rabby.io/mobile-mock/?_cmd=history.seedLocalTx&amount=0.0001',
        config,
      ),
    ).toMatchObject({
      matched: true,
      action: { action: 'history.seedLocalTx', amount: '0.0001' },
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
