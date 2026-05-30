import { appServiceEvents, makeJsEEClass } from '../_utils';

describe('core service event utilities', () => {
  it('creates typed EventEmitter classes with removable subscriptions', () => {
    const { EventEmitter } = makeJsEEClass<{
      changed: (value: string) => void;
    }>();
    const ee = new EventEmitter();
    const listener = jest.fn();

    const subscription = ee.subscribe('changed', listener);
    ee.emit('changed', 'first');
    subscription.remove();
    ee.emit('changed', 'second');

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith('first');
  });

  it('exposes shared app service events with the same subscribe contract', () => {
    const listener = jest.fn();
    const account = {
      address: '0x0000000000000000000000000000000000000001',
    } as any;

    const subscription = appServiceEvents.subscribe(
      'currentAccountChanged',
      listener,
    );
    appServiceEvents.emit('currentAccountChanged', account);
    subscription.remove();
    appServiceEvents.emit('currentAccountChanged', {
      address: '0x0000000000000000000000000000000000000002',
    } as any);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(account);
  });
});
