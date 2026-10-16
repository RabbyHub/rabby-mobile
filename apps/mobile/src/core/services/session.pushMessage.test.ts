import { BroadcastEvent } from '@/constant/event';
import { Session } from './session';

const makePort = () => {
  const postMessage = jest.fn();
  return { port: { postMessage }, postMessage };
};

describe('Session.pushMessage', () => {
  it('delivers to ports that do not implement the gate', () => {
    const session = new Session({
      origin: 'https://a.test',
      icon: '',
      name: '',
    });
    const pm = makePort();
    session.setPortMessage(pm);

    session.pushMessage(BroadcastEvent.chainChanged, { chainId: '0x1' });

    expect(pm.postMessage).toHaveBeenCalledTimes(1);
    expect(pm.postMessage).toHaveBeenCalledWith(
      {
        name: 'rabby-provider',
        data: {
          method: BroadcastEvent.chainChanged,
          params: { chainId: '0x1' },
        },
      },
      'https://a.test',
    );
  });

  it('drops the push when the gate returns false', () => {
    const session = new Session({
      origin: 'https://a.test',
      icon: '',
      name: '',
    });
    const pm = { ...makePort(), shouldPushMessage: jest.fn(() => false) };
    session.setPortMessage(pm);

    session.pushMessage(BroadcastEvent.chainChanged, { chainId: '0x1' });

    expect(pm.shouldPushMessage).toHaveBeenCalledWith(
      BroadcastEvent.chainChanged,
      { chainId: '0x1' },
    );
    expect(pm.port.postMessage).not.toHaveBeenCalled();
  });

  it('gates each port independently', () => {
    const session = new Session({
      origin: 'https://a.test',
      icon: '',
      name: '',
    });
    const allowed = makePort();
    const blocked = { ...makePort(), shouldPushMessage: () => false };
    session.setPortMessage(allowed);
    session.setPortMessage(blocked);

    session.pushMessage(BroadcastEvent.accountsChanged, []);

    expect(allowed.postMessage).toHaveBeenCalledTimes(1);
    expect(blocked.port.postMessage).not.toHaveBeenCalled();
  });
});
