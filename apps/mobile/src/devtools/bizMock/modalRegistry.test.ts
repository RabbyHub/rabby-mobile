import type { BottomSheetModalMethods } from '@gorhom/bottom-sheet/lib/typescript/types';

import {
  dismissAllBizMockModals,
  dismissBizMockModal,
  listBizMockModals,
  registerBizMockModal,
  resetBizMockModalsForTests,
  setBizMockModalActive,
  updateBizMockModalInstance,
} from './modalRegistry';

function makeInstance(onDismiss: () => void) {
  return {
    dismiss: jest.fn(() => {
      onDismiss();
    }),
  } as unknown as BottomSheetModalMethods;
}

describe('biz-mock modal registry', () => {
  beforeEach(() => {
    resetBizMockModalsForTests();
  });

  it('dismisses a target modal and waits for it to become inactive', async () => {
    const registered = registerBizMockModal({
      kind: 'standalone',
      testID: 'swap-quotes',
    });
    const instance = makeInstance(() =>
      setBizMockModalActive(registered.registryId, false),
    );
    updateBizMockModalInstance(registered.registryId, instance);
    setBizMockModalActive(registered.registryId, true);

    const result = await dismissBizMockModal({
      testID: 'swap-quotes',
      timeoutMs: 50,
    });

    expect(result).toMatchObject({
      ok: true,
      data: {
        kind: 'standalone',
        testID: 'swap-quotes',
        active: false,
      },
    });
    expect(instance.dismiss).toHaveBeenCalledTimes(1);
  });

  it('targets the latest active standalone modal when no selector is given', async () => {
    const first = registerBizMockModal({ kind: 'standalone' });
    const second = registerBizMockModal({ kind: 'standalone' });
    const firstInstance = makeInstance(() =>
      setBizMockModalActive(first.registryId, false),
    );
    const secondInstance = makeInstance(() =>
      setBizMockModalActive(second.registryId, false),
    );
    updateBizMockModalInstance(first.registryId, firstInstance);
    updateBizMockModalInstance(second.registryId, secondInstance);
    setBizMockModalActive(first.registryId, true);
    setBizMockModalActive(second.registryId, true);

    const result = await dismissBizMockModal({ top: true, timeoutMs: 50 });

    expect(result.ok).toBe(true);
    expect(secondInstance.dismiss).toHaveBeenCalledTimes(1);
    expect(firstInstance.dismiss).not.toHaveBeenCalled();
  });

  it('dismisses all active global and standalone modals', async () => {
    const globalModal = registerBizMockModal({
      kind: 'global-2024',
      id: 'APPROVAL_gBm_1',
      name: 'APPROVAL',
    });
    const standalone = registerBizMockModal({
      kind: 'standalone',
      testID: 'settings-sheet',
    });
    const globalInstance = makeInstance(() =>
      setBizMockModalActive(globalModal.registryId, false),
    );
    const standaloneInstance = makeInstance(() =>
      setBizMockModalActive(standalone.registryId, false),
    );
    updateBizMockModalInstance(globalModal.registryId, globalInstance);
    updateBizMockModalInstance(standalone.registryId, standaloneInstance);
    setBizMockModalActive(globalModal.registryId, true);
    setBizMockModalActive(standalone.registryId, true);

    await expect(dismissAllBizMockModals(50)).resolves.toBe(2);
    expect(listBizMockModals()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'global-2024',
          active: false,
        }),
        expect.objectContaining({
          kind: 'standalone',
          active: false,
        }),
      ]),
    );
  });
});
