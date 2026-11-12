import { createLifecycleController } from './lifecycle';

const setup = () => {
  const calls: string[] = [];
  const controller = createLifecycleController({
    pause: () => calls.push('pause'),
    resume: () => calls.push('resume'),
  });
  return { calls, controller };
};

describe('createLifecycleController', () => {
  it('pauses when the app leaves the foreground and resumes when it returns', () => {
    const { calls, controller } = setup();
    controller.setAppActive(false);
    controller.setAppActive(true);
    expect(calls).toEqual(['pause', 'resume']);
  });

  it('stays paused on foreground while the exit dialog is open', () => {
    const { calls, controller } = setup();
    controller.setExitDialogOpen(true);
    controller.setAppActive(false);
    controller.setAppActive(true);
    expect(calls).toEqual(['pause', 'pause', 'pause']);
    controller.setExitDialogOpen(false);
    expect(calls[calls.length - 1]).toBe('resume');
  });
});
