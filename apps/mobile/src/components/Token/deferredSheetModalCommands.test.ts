import { DeferredSheetModalCommandQueue } from './deferredSheetModalCommands';

describe('DeferredSheetModalCommandQueue', () => {
  it('requests a mount and forwards the first open command after mounting', () => {
    const queue = new DeferredSheetModalCommandQueue();
    const target = {
      toggleShow: jest.fn(),
    };

    expect(queue.handle(true, null)).toBe(true);
    queue.flush(target);

    expect(target.toggleShow).toHaveBeenCalledTimes(1);
    expect(target.toggleShow).toHaveBeenCalledWith(true);
  });

  it('forwards later commands directly to the mounted target', () => {
    const queue = new DeferredSheetModalCommandQueue();
    const target = {
      toggleShow: jest.fn(),
    };

    expect(queue.handle(false, target)).toBe(false);
    expect(queue.handle(true, target)).toBe(false);

    expect(target.toggleShow.mock.calls).toEqual([[false], [true]]);
  });

  it('cancels a pending open when it closes before mounting', () => {
    const queue = new DeferredSheetModalCommandQueue();
    const target = {
      toggleShow: jest.fn(),
    };

    expect(queue.handle(true, null)).toBe(true);
    expect(queue.handle(false, null)).toBe(false);
    queue.flush(target);

    expect(target.toggleShow).not.toHaveBeenCalled();
  });
});
