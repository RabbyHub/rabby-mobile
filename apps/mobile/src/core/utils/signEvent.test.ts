import {
  cancelSignComponentAmounted,
  emitSignComponentAmounted,
  waitSignComponentAmounted,
} from './signEvent';

test('waiting for mount ignores other operations and stops after cancellation', async () => {
  const pendingA = waitSignComponentAmounted('operation-a');
  let settledA = false;
  void pendingA.then(() => {
    settledA = true;
  });

  emitSignComponentAmounted('operation-b');
  await Promise.resolve();
  expect(settledA).toBe(false);

  cancelSignComponentAmounted('operation-a');
  await expect(pendingA).resolves.toBe(false);

  const pendingB = waitSignComponentAmounted('operation-b');
  emitSignComponentAmounted('operation-b');
  await expect(pendingB).resolves.toBe(true);
});

test('a late foreign mount cannot restart a canceled operation', async () => {
  const pendingA = waitSignComponentAmounted('operation-a');
  cancelSignComponentAmounted('operation-a');
  await expect(pendingA).resolves.toBe(false);

  emitSignComponentAmounted('operation-b');
  await expect(pendingA).resolves.toBe(false);
});
