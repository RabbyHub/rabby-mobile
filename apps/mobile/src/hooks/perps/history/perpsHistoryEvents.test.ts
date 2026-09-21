import {
  publishPerpsProHistoryEvent,
  subscribePerpsProHistoryEvents,
} from './perpsHistoryEvents';

describe('Perps Pro history event bridge', () => {
  it('fans out only while subscribed and cleanup is idempotent', () => {
    const listener = jest.fn();
    const cleanup = subscribePerpsProHistoryEvents(listener);
    const event = {
      accountAddress: '0x1111111111111111111111111111111111111111',
      isSnapshot: false,
      items: [],
      kind: 'fills' as const,
    };
    publishPerpsProHistoryEvent(event);
    expect(listener).toHaveBeenCalledWith(event);

    cleanup();
    cleanup();
    publishPerpsProHistoryEvent(event);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
