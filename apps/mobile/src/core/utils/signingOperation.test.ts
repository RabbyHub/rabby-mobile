import { eventBus, EVENTS } from '@/utils/events';
import { listenForSignFinished } from './signingOperation';

test('delivers a result only to its matching live signing operation', () => {
  let activeA = true;
  const listenerA = jest.fn();
  const listenerB = jest.fn();
  const stopA = listenForSignFinished('operation-a', () => activeA, listenerA);
  const stopB = listenForSignFinished('operation-b', () => true, listenerB);

  eventBus.emit(EVENTS.SIGN_FINISHED, {
    success: true,
    data: '0xsignature-a',
    signingOperationId: 'operation-a',
  });
  expect(listenerA).toHaveBeenCalledWith({
    success: true,
    data: '0xsignature-a',
    signingOperationId: 'operation-a',
  });
  expect(listenerB).not.toHaveBeenCalled();

  activeA = false;
  eventBus.emit(EVENTS.SIGN_FINISHED, {
    success: true,
    data: '0xlate-a',
    signingOperationId: 'operation-a',
  });
  expect(listenerA).toHaveBeenCalledTimes(1);
  expect(listenerB).not.toHaveBeenCalled();

  eventBus.emit(EVENTS.SIGN_FINISHED, {
    success: true,
    data: '0xsignature-b',
    signingOperationId: 'operation-b',
  });
  expect(listenerB).toHaveBeenCalledWith({
    success: true,
    data: '0xsignature-b',
    signingOperationId: 'operation-b',
  });

  stopA();
  stopB();
});

test('unmounting one operation does not remove another operation listener', () => {
  const listenerA = jest.fn();
  const listenerB = jest.fn();
  const stopA = listenForSignFinished('operation-a', () => true, listenerA);
  const stopB = listenForSignFinished('operation-b', () => true, listenerB);

  stopA();
  eventBus.emit(EVENTS.SIGN_FINISHED, {
    success: true,
    data: '0xsignature-a',
    signingOperationId: 'operation-a',
  });
  eventBus.emit(EVENTS.SIGN_FINISHED, {
    success: true,
    data: '0xsignature-b',
    signingOperationId: 'operation-b',
  });

  expect(listenerA).not.toHaveBeenCalled();
  expect(listenerB).toHaveBeenCalledTimes(1);
  stopB();
});

test('ignores legacy unscoped completion events', () => {
  const listener = jest.fn();
  const stop = listenForSignFinished('operation-a', () => true, listener);

  eventBus.emit(EVENTS.SIGN_FINISHED, {
    success: true,
    data: '0xunscoped',
  });

  expect(listener).not.toHaveBeenCalled();
  stop();
});
