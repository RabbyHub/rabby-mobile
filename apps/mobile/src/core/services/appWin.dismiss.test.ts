import { apisAppWin } from './appWin';
import { globalSheetModalEvents } from '@/components/GlobalBottomSheetModal/event';
import { EVENT_NAMES } from '@/components/GlobalBottomSheetModal/types';

// Unit coverage for the real service and EventEmitter; no modal close promise
// is mocked. The component suite separately connects this to the actual host.
describe('legacy modal-specific close completion', () => {
  afterEach(() => {
    globalSheetModalEvents.removeAllListeners(EVENT_NAMES.CLOSED);
  });

  it('keeps waiting when an unrelated modal closes first', async () => {
    const settled = jest.fn();
    const completion = apisAppWin
      .removeGlobalBottomSheetModal('AUTHENTICATION_target')
      .then(settled);
    globalSheetModalEvents.emit(EVENT_NAMES.CLOSED, 'DESCRIPTION_other');
    await Promise.resolve();
    expect(settled).not.toHaveBeenCalled();
    expect(globalSheetModalEvents.listenerCount(EVENT_NAMES.CLOSED)).toBe(1);

    globalSheetModalEvents.emit(EVENT_NAMES.CLOSED, 'AUTHENTICATION_target');
    await completion;
    expect(settled).toHaveBeenCalledWith('AUTHENTICATION_target');
    expect(globalSheetModalEvents.listenerCount(EVENT_NAMES.CLOSED)).toBe(0);
  });

  it('registers before synchronous completion and cleans up the matching listener', async () => {
    const onRemove = (id: string) => {
      globalSheetModalEvents.emit(EVENT_NAMES.CLOSED, id);
    };
    globalSheetModalEvents.on(EVENT_NAMES.REMOVE, onRemove);
    try {
      await expect(
        apisAppWin.removeGlobalBottomSheetModal('AUTHENTICATION_sync'),
      ).resolves.toBe('AUTHENTICATION_sync');
      expect(globalSheetModalEvents.listenerCount(EVENT_NAMES.CLOSED)).toBe(0);
    } finally {
      globalSheetModalEvents.off(EVENT_NAMES.REMOVE, onRemove);
    }
  });
});
